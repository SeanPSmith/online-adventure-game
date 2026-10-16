"""Regression for staging's psycopg ProgrammingError on literal LIKE %repair%.

PostgreSQL itself is not required: emulate Psycopg's placeholder parsing over a
populated SQLite database, exercising the real PostgreSQL SQL translation path.
"""
from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone

import pytest

from app.admin import operations as operations_module
from app.admin.operations import OperationsStore
from app.auth.models import StoredUser
from app.auth.store import SQLiteAuthStore
from app.database import DatabaseConnection
from app.persistence.store import SQLiteStateStore
from app.usage.store import AIUsageStore


class _StrictPsycopgSQLite:
    """Reject non-placeholder percent escapes exactly where psycopg would fail."""

    def __init__(self, path, statements):
        self.database = sqlite3.connect(path)
        self.database.row_factory = sqlite3.Row
        self.statements = statements

    def execute(self, query, params=()):
        self.statements.append((query, tuple(params)))
        # Psycopg's percent interpolation applies even inside SQL literals.
        if re.search(r"%(?![sbt%])", query):
            raise AssertionError(f"Non-placeholder percent sign in PostgreSQL query: {query!r}")
        return self.database.execute(query.replace("%s", "?"), params)

    def commit(self):
        self.database.commit()

    def rollback(self):
        self.database.rollback()

    def close(self):
        self.database.close()


@pytest.mark.asyncio
async def test_admin_operations_snapshot_uses_bound_repair_pattern_on_postgres(tmp_path, monkeypatch):
    database_path = tmp_path / "ops-postgres-placeholder.sqlite3"
    for store in (
        SQLiteAuthStore(database_path),
        SQLiteStateStore(database_path),
        AIUsageStore(database_path),
        OperationsStore(database_path),
    ):
        await store.initialize()

    auth = SQLiteAuthStore(database_path)
    await auth.create_user(
        StoredUser(
            user_id="test-player", email="player@example.com", username="test-player",
            password_hash="x", created_at=datetime.now(timezone.utc),
        )
    )
    usage = AIUsageStore(database_path)
    for name in ("director_story", "director_json_repair"):
        event_id = await usage.begin_event(
            user_id="test-player", room_code="ROOM01", adventure_id="adventure",
            generated_adventure_id=None, surface="live_adventure", operation=name,
            provider="openai", model="gpt-5.6-sol", reserved_cost_microusd=1000,
        )
        await usage.finish_event(
            event_id=event_id, status="succeeded", input_tokens=50,
            output_tokens=25, estimated_cost_microusd=500, latency_ms=250,
        )

    statements = []

    def postgres_like_connection(path):
        assert path == database_path
        return DatabaseConnection(
            "postgres", _StrictPsycopgSQLite(path, statements), (sqlite3.IntegrityError,),
        )

    monkeypatch.setattr(operations_module, "connect_database", postgres_like_connection)
    result = await OperationsStore(database_path).snapshot()

    assert result["metrics"]["requests"] == 2
    assert result["metrics"]["repairs"] == 1
    assert result["metrics"]["repair_call_share"] == 50.0
    aggregate = [(sql, params) for sql, params in statements if "AS repairs" in sql]
    assert len(aggregate) == 1
    assert "operation LIKE %s" in aggregate[0][0]
    assert "'%repair%'" not in aggregate[0][0]
    assert aggregate[0][1] == ("%repair%", result["period_key"])
