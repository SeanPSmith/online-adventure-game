from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.auth.models import StoredUser
from app.auth.store import SQLiteAuthStore


@pytest.mark.asyncio
async def test_admin_user_listing_and_author_toggle(tmp_path):
    store = SQLiteAuthStore(tmp_path / "auth.sqlite3")
    await store.initialize()

    now = datetime.now(timezone.utc)

    sean = StoredUser(
        user_id="sean-id",
        email="sean@example.com",
        username="SeanSteezy",
        password_hash="x",
        created_at=now,
    )
    athena = StoredUser(
        user_id="athena-id",
        email="athena@example.com",
        username="Princess_Athena",
        password_hash="x",
        created_at=now,
    )

    await store.create_user(sean)
    await store.create_user(athena)
    await store.grant_permission("sean-id", "admin")
    await store.grant_permission("sean-id", "author")
    await store.grant_permission("sean-id", "publish")

    matches = await store.list_users("princess")
    assert [user.username for user in matches] == ["Princess_Athena"]

    await store.grant_permission("athena-id", "author")
    await store.grant_permission("athena-id", "publish")

    athena_after = await store.get_user_by_id("athena-id")
    assert athena_after is not None
    assert set(athena_after.permissions) == {"author", "publish"}

    await store.revoke_permission("athena-id", "author")
    await store.revoke_permission("athena-id", "publish")

    athena_final = await store.get_user_by_id("athena-id")
    assert athena_final is not None
    assert athena_final.permissions == ()
