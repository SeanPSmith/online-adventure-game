from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.auth.models import AuthSession, StoredUser
from app.auth.passwords import hash_password
from app.auth.store import SQLiteAuthStore


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_account_center_is_single_tabbed_self_service_surface() -> None:
    page = read("frontend/src/pages/account/AccountPage.tsx")
    router = read("frontend/src/router.tsx")
    game_layout = read("frontend/src/layouts/GameLayout.tsx")
    account_layout = read("frontend/src/layouts/AccountLayout.tsx")

    for label in ("PROFILE", "PREFERENCES", "NOTIFICATIONS", "SECURITY", "BILLING"):
        assert label.lower() in page.lower()

    assert "SAVE PROFILE" in page
    assert "CHANGE PASSWORD" in page
    assert "SIGN OUT OTHER DEVICES" in page
    assert "DELETE ACCOUNT PERMANENTLY" in page
    assert "ACCESS & AI USAGE // PLAYTEST" in page
    assert "NO PAYMENT METHOD REQUIRED" in page
    assert '<Navigate to="/account?tab=preferences" replace />' in router
    assert 'to="/settings"' not in game_layout
    assert 'to="/settings"' not in account_layout


def test_existing_notification_and_story_preferences_live_inside_account_center() -> None:
    page = read("frontend/src/pages/account/AccountPage.tsx")
    settings = read("frontend/src/pages/account/SettingsPage.tsx")

    assert '<SettingsPage section="preferences" />' in page
    assert '<SettingsPage section="notifications" />' in page
    assert "ENABLE WEB PUSH" in settings
    assert "EMAIL // AMAZON SES" in settings
    assert "SMS // AWS" in settings
    assert "WORD-BY-WORD STORY REVEAL" in settings


def test_account_api_has_real_profile_security_and_delete_endpoints() -> None:
    routes = read("app/auth/routes.py")
    service = read("frontend/src/services/auth.ts")

    assert '@router.patch(\n    "/profile"' in routes
    assert '@router.post(\n    "/password"' in routes
    assert '@router.get(\n    "/security"' in routes
    assert '"/sessions/logout-others"' in routes
    assert '@router.delete(\n    "/account"' in routes
    assert 'X-TOT-Account-Request' in routes

    assert '"/api/auth/profile"' in service
    assert '"/api/auth/password"' in service
    assert '"/api/auth/security"' in service
    assert '"/api/auth/sessions/logout-others"' in service
    assert '"/api/auth/account"' in service


@pytest.mark.asyncio
async def test_auth_store_profile_sessions_and_account_deletion_are_durable(tmp_path: Path) -> None:
    database = tmp_path / "account.sqlite3"
    store = SQLiteAuthStore(database)
    await store.initialize()

    now = datetime.now(timezone.utc)
    user = StoredUser(
        user_id="user-42",
        email="old@example.com",
        username="oldname",
        password_hash=hash_password("very-secure-password"),
        created_at=now,
        is_active=True,
    )
    await store.create_user(user)
    await store.update_user_identity("user-42", "new@example.com", "newname")

    refreshed = await store.get_user_by_id("user-42")
    assert refreshed is not None
    assert refreshed.email == "new@example.com"
    assert refreshed.username == "newname"

    for session_id in ("session-current", "session-other"):
        await store.create_session(
            AuthSession(
                session_id=session_id,
                user_id="user-42",
                token_hash=f"hash-{session_id}",
                created_at=now,
                expires_at=now + timedelta(days=7),
                last_seen_at=now,
            )
        )

    removed = await store.delete_user_sessions_except("user-42", "session-current")
    assert removed == 1
    sessions = await store.list_user_sessions("user-42")
    assert [session.session_id for session in sessions] == ["session-current"]

    with store._connect() as connection:
        connection.execute(
            """
            CREATE TABLE author_documents (
                document_id TEXT PRIMARY KEY,
                created_by_user_id TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO author_documents (document_id, created_by_user_id) VALUES (?, ?)",
            ("world-1", "user-42"),
        )

    await store.delete_user_account("user-42")
    assert await store.get_user_by_id("user-42") is None

    with store._connect() as connection:
        row = connection.execute(
            "SELECT created_by_user_id FROM author_documents WHERE document_id = ?",
            ("world-1",),
        ).fetchone()

    assert row is not None
    assert str(row["created_by_user_id"]).startswith("deleted:")

    # Deleted-account tombstones must not be treated as legacy authors on
    # subsequent startup, which would violate the user_permissions FK.
    store._initialize_sync()
