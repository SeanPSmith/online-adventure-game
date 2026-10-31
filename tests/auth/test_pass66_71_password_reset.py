"""Pass 66.71: password recovery by email. Uses a real temporary SQLite auth store and a fake mailer."""
from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import routes as auth_routes
from app.auth.models import StoredUser
from app.auth.passwords import hash_password, verify_password
from app.auth.password_reset import PasswordResetService, RESET_COOLDOWN, RESET_LIFETIME
from app.auth.providers.base import InvalidCredentialsError, RegistrationError
from app.auth.sessions import hash_session_token
from app.auth.store import SQLiteAuthStore


class FakeClock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture()
def env(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("TOT_NOTIFICATION_EMAIL_FROM", "Quillairo <no-reply@example.com>")
    monkeypatch.setenv("TOT_PUBLIC_BASE_URL", "https://play.example.com/")
    store = SQLiteAuthStore(tmp_path / "auth.sqlite3")
    asyncio.run(store.initialize())
    sent: list[tuple[str, str, str, str]] = []

    async def fake_sender(to, subject, text, html):
        sent.append((to, subject, text, html))

    clock = FakeClock()
    service = PasswordResetService(store=store, sender=fake_sender, clock=clock)

    async def add_user(user_id="u1", email="reader@example.com", username="READER", active=True):
        await store.create_user(StoredUser(
            user_id=user_id, email=email, username=username,
            password_hash=hash_password("old-password-123"),
            created_at=clock(), is_active=active))

    asyncio.run(add_user())
    return store, service, sent, clock, add_user


def token_from(sent) -> str:
    match = re.search(r"#token=([A-Za-z0-9_\-]+)", sent[-1][2])
    assert match, sent[-1][2]
    return match.group(1)


def test_request_sends_one_email_with_fragment_link_and_stores_only_a_hash(env):
    store, service, sent, clock, _ = env
    asyncio.run(service.request_reset("reader@example.com"))
    assert len(sent) == 1 and sent[0][0] == "reader@example.com"
    assert "https://play.example.com/reset-password#token=" in sent[0][2]
    token = token_from(sent)
    assert "?token=" not in sent[0][2]
    with store._connect() as connection:
        rows = connection.execute("SELECT token_hash FROM password_reset_tokens").fetchall()
    assert [r["token_hash"] for r in rows] == [hash_session_token(token)]
    assert token not in rows[0]["token_hash"]


def test_username_lookup_works_and_unknown_or_inactive_accounts_send_nothing(env):
    store, service, sent, clock, add_user = env
    asyncio.run(service.request_reset("reader"))
    assert len(sent) == 1
    asyncio.run(service.request_reset("nobody@example.com"))
    asyncio.run(add_user("u2", "off@example.com", "OFF", active=False))
    asyncio.run(service.request_reset("off@example.com"))
    assert len(sent) == 1


def test_cooldown_blocks_a_second_email_until_it_passes_and_retires_the_old_link(env):
    store, service, sent, clock, _ = env
    asyncio.run(service.request_reset("reader@example.com"))
    first = token_from(sent)
    asyncio.run(service.request_reset("reader@example.com"))
    assert len(sent) == 1
    clock.now += RESET_COOLDOWN + timedelta(seconds=1)
    asyncio.run(service.request_reset("reader@example.com"))
    assert len(sent) == 2
    second = token_from(sent)
    assert first != second
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(service.complete_reset(first, "brand-new-password"))
    asyncio.run(service.complete_reset(second, "brand-new-password"))


def test_complete_reset_changes_password_signs_out_everywhere_and_is_single_use(env):
    store, service, sent, clock, _ = env
    asyncio.run(service.request_reset("reader@example.com"))
    token = token_from(sent)
    from app.auth.sessions import generate_session_token
    new_session = generate_session_token()
    from app.auth.models import AuthSession
    asyncio.run(store.create_session(AuthSession(
        session_id="s1", user_id="u1", token_hash=new_session.token_hash,
        created_at=new_session.created_at, expires_at=new_session.expires_at,
        last_seen_at=new_session.created_at)))
    assert asyncio.run(store.get_session_by_token_hash(new_session.token_hash)) is not None
    asyncio.run(service.complete_reset(token, "brand-new-password"))
    user = asyncio.run(store.get_user_by_id("u1"))
    assert verify_password("brand-new-password", user.password_hash)
    assert not verify_password("old-password-123", user.password_hash)
    assert asyncio.run(store.get_session_by_token_hash(new_session.token_hash)) is None
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(service.complete_reset(token, "another-new-password"))


def test_expired_link_is_rejected(env):
    store, service, sent, clock, _ = env
    asyncio.run(service.request_reset("reader@example.com"))
    token = token_from(sent)
    clock.now += RESET_LIFETIME + timedelta(seconds=1)
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(service.complete_reset(token, "brand-new-password"))


def test_a_weak_password_does_not_spend_the_token(env):
    store, service, sent, clock, _ = env
    asyncio.run(service.request_reset("reader@example.com"))
    token = token_from(sent)
    with pytest.raises(RegistrationError):
        asyncio.run(service.complete_reset(token, "short"))
    asyncio.run(service.complete_reset(token, "brand-new-password"))


def test_unconfigured_email_is_reported_unavailable_and_sends_nothing(env, monkeypatch):
    store, service, sent, clock, _ = env
    monkeypatch.delenv("TOT_NOTIFICATION_EMAIL_FROM")
    assert service.is_available() is False
    asyncio.run(service.request_reset("reader@example.com"))
    assert sent == []


def test_mail_failure_never_raises_to_the_caller(env):
    store, _, _, clock, _ = env

    async def boom(*args):
        raise RuntimeError("SES down")

    asyncio.run(PasswordResetService(store=store, sender=boom, clock=clock).request_reset("reader@example.com"))


def test_http_routes_answer_identically_and_enforce_the_csrf_header(env, monkeypatch):
    store, service, sent, clock, _ = env
    monkeypatch.setattr(auth_routes, "password_reset_service", service)
    app = FastAPI()
    app.include_router(auth_routes.router)
    client = TestClient(app)
    headers = {"X-TOT-Account-Request": "1"}
    assert client.get("/api/auth/password-reset/status").json() == {"available": True}
    assert client.post("/api/auth/password-reset/request", json={"identifier": "reader"}).status_code == 403
    known = client.post("/api/auth/password-reset/request", json={"identifier": "reader"}, headers=headers)
    unknown = client.post("/api/auth/password-reset/request", json={"identifier": "ghost"}, headers=headers)
    assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json()
    assert len(sent) == 1
    token = token_from(sent)
    bad = client.post("/api/auth/password-reset/confirm",
                      json={"token": "x" * 43, "new_password": "brand-new-password"}, headers=headers)
    assert bad.status_code == 400
    ok = client.post("/api/auth/password-reset/confirm",
                     json={"token": token, "new_password": "brand-new-password"}, headers=headers)
    assert ok.status_code == 200
    again = client.post("/api/auth/password-reset/confirm",
                        json={"token": token, "new_password": "brand-new-password"}, headers=headers)
    assert again.status_code == 400


def test_routes_report_503_when_email_is_not_configured(env, monkeypatch):
    store, service, sent, clock, _ = env
    monkeypatch.setattr(auth_routes, "password_reset_service", service)
    monkeypatch.delenv("TOT_PUBLIC_BASE_URL")
    app = FastAPI()
    app.include_router(auth_routes.router)
    client = TestClient(app)
    assert client.get("/api/auth/password-reset/status").json() == {"available": False}
    response = client.post("/api/auth/password-reset/request", json={"identifier": "reader"},
                           headers={"X-TOT-Account-Request": "1"})
    assert response.status_code == 503
