import asyncio
import re

import pytest

from app.database import DatabaseConnection
from app.persistence.store import SQLiteStateStore
from tests.adventures import test_history as history_fixture


@pytest.mark.parametrize("character_id", [None, "hero-1", "", "hero-'quoted"])
def test_history_postgres_parameters_have_column_type_context(monkeypatch, character_id):
    """Exercise the real query through the PostgreSQL SQL adapter."""
    calls = []

    class Cursor:
        def fetchall(self):
            return []

    class Connection:
        def execute(self, sql, params):
            calls.append((sql, params))
            # PostgreSQL cannot infer the type of a standalone bind IS NULL.
            assert not re.search(r"%s\s+IS\s+NULL", sql, re.I)
            return Cursor()

        def commit(self):
            pass

    store = SQLiteStateStore()
    monkeypatch.setattr(store, "_connect", lambda: DatabaseConnection("postgres", Connection(), ()))
    assert store._list_completed_adventures_sync("user-1", character_id) == []
    sql, params = calls[0]
    assert "player.user_id = %s" in sql
    assert params == (("user-1",) if character_id is None else ("user-1", character_id))
    assert ("player.character_id = %s" in sql) == (character_id is not None)
    assert sql.count("%s") == len(params)


def test_history_filter_preserves_owner_scope_and_account_library(tmp_path):
    store = SQLiteStateStore(tmp_path / "history.sqlite3")
    asyncio.run(store.initialize())
    room, session = history_fixture.AdventureHistoryTests().build_room_and_session()
    asyncio.run(store.record_completed_adventure(room, session))
    assert len(store._list_completed_adventures_sync("user-1", "hero-1")) == 1
    assert store._list_completed_adventures_sync("user-1", "hero-2") == []
    assert store._list_completed_adventures_sync("stranger", None) == []
    assert store._list_completed_adventures_sync("user-1", "") == []
    assert len(asyncio.run(store.list_player_library("user-1"))["completed"]) == 1
