from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.admin.analytics import AdminAnalyticsService
from app.auth.models import StoredUser
from app.auth.store import SQLiteAuthStore
from app.database import connect_database
from app.generation.store import GeneratedAdventureStore
from app.persistence.store import SQLiteStateStore


@pytest.mark.asyncio
async def test_admin_analytics_aggregates_accounts_history_and_rankings(tmp_path) -> None:
    database_path = tmp_path / "analytics.sqlite3"

    auth = SQLiteAuthStore(database_path)
    state = SQLiteStateStore(database_path)
    generated = GeneratedAdventureStore(database_path)

    await auth.initialize()
    await state.initialize()
    await generated.initialize()

    now = datetime.now(timezone.utc)
    sean = StoredUser(
        user_id="user-1",
        email="sean@example.com",
        username="Sean",
        password_hash="x",
        created_at=now,
    )
    athena = StoredUser(
        user_id="user-2",
        email="athena@example.com",
        username="Athena",
        password_hash="x",
        created_at=now,
    )
    await auth.create_user(sean)
    await auth.create_user(athena)
    await auth.grant_permission("user-1", "author")

    with connect_database(database_path) as connection:
        connection.execute(
            """
            INSERT INTO auth_sessions (
                session_id, user_id, token_hash, created_at, expires_at, last_seen_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                "session-1",
                "user-1",
                "hash-1",
                now.isoformat(),
                (now + timedelta(days=1)).isoformat(),
                now.isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO adventure_history (
                history_id, room_code, adventure_id, adventure_title,
                ending_label, turn_count, final_scene_title, final_resolution,
                recap, story_state_json, director_history_json,
                director_usage_json, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "history-1",
                "ROOM01",
                "superette",
                "Saturday Shift",
                "THE STORE CLOSES",
                12,
                "Closing Time",
                "They made it out.",
                "A weird shift.",
                "{}",
                "[]",
                "{}",
                now.isoformat(),
            ),
        )
        for index, user_id, hero_name in (
            (1, "user-1", "Chippy"),
            (2, "user-2", "Athena"),
        ):
            connection.execute(
                """
                INSERT INTO adventure_history_players (
                    history_id, user_id, character_id, character_name, is_host,
                    checks_total, checks_succeeded, critical_successes,
                    critical_failures, intermission_wins
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "history-1",
                    user_id,
                    f"hero-{index}",
                    hero_name,
                    1 if index == 1 else 0,
                    5,
                    3,
                    1 if index == 1 else 0,
                    0,
                    index,
                ),
            )
        connection.commit()

    snapshot = AdminAnalyticsService(database_path)._database_snapshot_sync(set())

    assert snapshot["accounts"]["registered_users"] == 2
    assert snapshot["accounts"]["authors"] == 1
    assert snapshot["accounts"]["recently_active_users"] == 1
    assert snapshot["totals"]["adventures_completed"] == 1
    assert snapshot["totals"]["turns_completed"] == 12
    assert snapshot["popular_adventures"][0]["adventure_title"] == "Saturday Shift"
    assert snapshot["popular_adventures"][0]["completions"] == 1
    assert {entry["username"] for entry in snapshot["top_players"]} == {"Sean", "Athena"}
    assert snapshot["recent_completions"][0]["turn_count"] == 12
