"""Author Studio reachability and permissions: keep private routes private."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.models import User
from app.authoring import routes as author_routes
from app.authoring.service import AuthorAccessPolicy

ROOT = Path(__file__).resolve().parents[2]


def _user(*permissions: str) -> User:
    return User(
        user_id="test-author-1",
        email="test@example.org",
        username="writer",
        created_at=datetime.now(timezone.utc),
        permissions=permissions,
    )


@pytest.mark.parametrize("permissions,expected", [
    (("admin",), True),
    (("author",), True),
    ((), False),
    (("player",), False),
])
def test_author_policy_admin_inherits_author_without_making_every_player_author(
    permissions, expected,
):
    assert AuthorAccessPolicy().allows(_user(*permissions)) is expected


@pytest.mark.asyncio
async def test_explicit_denial_still_blocks_admin(monkeypatch):
    assert not await author_routes.user_can_access_author_console(
        _user("admin", "author_denied")
    )


@pytest.mark.parametrize("permissions,expected_status,target", [
    (None, 303, "/login?returnTo=%2Fauthor-console"),
    ((), 303, "/account/author?access=required"),
    (("admin",), 200, None),
    (("author",), 200, None),
    (("admin", "author_denied"), 303, "/account/author?access=required"),
])
def test_studio_route_redirect_and_access(monkeypatch, permissions, expected_status, target):
    async def authenticate_session(_):
        return None if permissions is None else _user(*permissions)

    async def user_has_authored_documents(_):
        return False

    monkeypatch.setattr(author_routes.auth_service, "authenticate_session", authenticate_session)
    monkeypatch.setattr(author_routes.authoring_store, "user_has_authored_documents", user_has_authored_documents)
    app = FastAPI()
    app.include_router(author_routes.router)
    client = TestClient(app, follow_redirects=False)
    response = client.get("/author-console")
    assert response.status_code == expected_status
    if target:
        assert response.headers["location"] == target
        assert response.headers.get("cache-control") == "no-store"
    else:
        assert "Quillairo" in response.text
        assert response.headers.get("cache-control") == "no-store"


def test_document_navigation_and_roles_are_reused_across_shells():
    landing = (ROOT / "frontend/src/pages/author/AuthorPage.tsx").read_text()
    role = (ROOT / "frontend/src/services/author.ts").read_text()
    login = (ROOT / "frontend/src/pages/auth/LoginPage.tsx").read_text()
    assert '<a className="inkbound-author-enter" href="/author-console">' in landing
    assert 'to="/author-console"' not in landing
    assert 'canUseAuthorStudio(user?.permissions)' in landing
    assert 'permissions.includes("admin")' in role
    assert 'permissions.includes("author_denied")' in role
    assert 'requestedReturn === "/author-console"' in login
    for path in (
        "frontend/src/layouts/GameLayout.tsx",
        "frontend/src/layouts/AccountLayout.tsx",
        "frontend/src/pages/game/GameHomePage.tsx",
    ):
        assert 'canUseAuthorStudio(user?.permissions)' in (ROOT / path).read_text()
