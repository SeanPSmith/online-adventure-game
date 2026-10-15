"""Pass 62A.2: shared quotas cannot be bypassed by backend replicas."""
import asyncio
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.narration import metering, routes


class ConditionalError(Exception):
    response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class TransactionError(Exception):
    response = {"Error": {"Code": "TransactionCanceledException"}}


class RateTable:
    def __init__(self):
        self.rows = {}
        self.calls = []

    def update_item(self, **kw):
        self.calls.append(kw)
        key = kw["Key"]["id"]
        current = self.rows.get(key, 0)
        if "ConditionExpression" in kw and current >= kw["ExpressionAttributeValues"][":cap"]:
            raise ConditionalError
        self.rows[key] = current + 1

    def get_item(self, **kw):
        return {"Item": {}}


def test_rate_limit_is_global_by_account_and_fixed_window(monkeypatch):
    table = RateTable()
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "shared")
    monkeypatch.setenv("STORY_TIME_WINDOW_REQUEST_LIMIT", "2")
    monkeypatch.setattr(metering, "_table", lambda: table)
    metering.admit_request("user1", now=300)
    metering.admit_request("user1", now=301)
    with pytest.raises(metering.LimitReached):
        metering.admit_request("user1", now=302)
    metering.admit_request("user2", now=302)
    metering.admit_request("user1", now=600)
    assert len(table.rows) == 3
    assert not any("user1" in key for key in table.rows)


def test_rate_failure_blocks_instead_of_using_process_memory(monkeypatch):
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "shared")
    class Down:
        def update_item(self, **kw):
            raise ConnectionError("AWS request failed")
    monkeypatch.setattr(metering, "_table", lambda: Down())
    with pytest.raises(metering.MeterUnavailable):
        metering.admit_request("user1")


def test_global_and_user_generation_are_one_transaction(monkeypatch):
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "meter")
    actions = []
    class Client:
        def transact_write_items(self, **kw):
            actions.append(kw)
    monkeypatch.setitem(sys.modules, "boto3", SimpleNamespace(client=lambda _: Client()))
    metering.admit_generation("customer", 123, now=1700000000)
    data = actions[0]["TransactItems"]
    assert len(data) == 2
    assert all(row["Update"]["TableName"] == "meter" for row in data)
    assert "GLOBAL" in data[1]["Update"]["Key"]["id"]["S"]
    assert "customer" not in data[0]["Update"]["Key"]["id"]["S"]
    assert all("ConditionExpression" in row["Update"] for row in data)


def test_transaction_conflict_does_not_allow_partial_spend(monkeypatch):
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "meter")
    class Client:
        def transact_write_items(self, **kw):
            raise TransactionError
    monkeypatch.setitem(sys.modules, "boto3", SimpleNamespace(client=lambda _: Client()))
    with pytest.raises(metering.LimitReached):
        metering.admit_generation("customer", 500)


def test_preflight_prevents_gpu_wake_for_exhausted_user(monkeypatch):
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "meter")
    class Table:
        def get_item(self, **kw):
            return {"Item": {"jobs": 300, "chars": 100}}
    monkeypatch.setattr(metering, "_table", lambda: Table())
    with pytest.raises(metering.LimitReached):
        metering.preflight_generation("customer", 100)


def test_report_only_includes_privacy_limited_user_aggregate(monkeypatch):
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "meter")
    now = 1700000000
    today = metering._day(now)
    monkeypatch.setattr(metering, "_rows_for_day", lambda d: (
        [{"id": f"usage#{d}#GLOBAL", "account_id": "GLOBAL", "generated": 11, "requests": 22},
         {"id": f"usage#{d}#digest", "account_id": "user1", "generated": 11, "requests": 22}]
        if d == today else []))
    report = metering.admin_snapshot(days=7, now=now)
    assert report["totals"]["generated"] == 11
    assert report["top_users"][0]["today_generated"] == 11
    assert report["top_users"][0]["user_id"] == "user1"
    assert "story" not in str(report)


def test_cached_speech_meter_denial_does_not_access_cache_or_gpu(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "https://private.example/v1")
    monkeypatch.setattr(metering, "enabled", lambda: True)
    monkeypatch.setattr(routes, "_authorize_scene_speech", lambda *args: None)
    monkeypatch.setattr(metering, "admit_request", lambda user: (_ for _ in ()).throw(metering.LimitReached("quota")))
    monkeypatch.setattr(routes, "_shared_audio", lambda key: (_ for _ in ()).throw(AssertionError("shared S3 reached")))
    monkeypatch.setattr(routes, "_ensure_awake", lambda **kw: (_ for _ in ()).throw(AssertionError("GPU touched")))
    with pytest.raises(HTTPException) as error:
        asyncio.run(routes.synthesize_speech(routes.SpeechRequest(text="A safe story", room_code="ABC123"),
                                                 SimpleNamespace(user_id="user1")))
    assert error.value.status_code == 429


def test_new_voice_generation_requires_atomic_quota(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "https://private.example/v1")
    monkeypatch.setattr(metering, "enabled", lambda: True)
    monkeypatch.setattr(routes, "_authorize_scene_speech", lambda *args: None)
    monkeypatch.setattr(metering, "admit_request", lambda *a: None)
    monkeypatch.setattr(metering, "preflight_generation", lambda *a: None)
    monkeypatch.setattr(metering, "admit_generation", lambda *a: (_ for _ in ()).throw(metering.LimitReached("cap")))
    monkeypatch.setattr(routes, "_shared_audio", lambda key: None)
    monkeypatch.setattr(routes, "_read_kokoro", lambda *a: (_ for _ in ()).throw(AssertionError("infer")))
    monkeypatch.setattr(routes.hosting, "healthy", lambda endpoint: True)
    async def awake(*, wake):
        return {"state": "running"}
    monkeypatch.setattr(routes, "_ensure_awake", awake)
    with pytest.raises(HTTPException) as error:
        asyncio.run(routes.synthesize_speech(routes.SpeechRequest(text="New voice story", room_code="ABC123"),
                                                 SimpleNamespace(user_id="user1")))
    assert error.value.status_code == 429


def test_denial_signals_emit_at_most_once_per_account_window(monkeypatch):
    monkeypatch.setenv("STORY_TIME_METER_TABLE", "meter")
    events = []
    class Table:
        ids = set()
        def put_item(self, **kw):
            key = kw["Item"]["id"]
            if key in self.ids:
                raise ConditionalError
            self.ids.add(key)
    table = Table()
    monkeypatch.setattr(metering, "_table", lambda: table)
    monkeypatch.setattr(metering, "record_result", lambda *a, **kw: events.append((a, kw)))
    metering.record_denial("user1", "rate", now=600)
    metering.record_denial("user1", "rate", now=601)
    metering.record_denial("user1", "generation", now=601)
    assert len(events) == 2
    assert all(x[0][1] == "denied" for x in events)
    assert all("user1" not in k for k in table.ids)


def test_backend_cdk_grants_transactional_dynamodb_admission():
    from pathlib import Path
    stack = (Path(__file__).resolve().parents[2] / "infra/lib/backend-stack.ts").read_text()
    assert 'narrationMeter.grant(taskDefinition.taskRole, "dynamodb:TransactWriteItems")' in stack
    assert 'STORY_TIME_METER_TABLE: narrationMeter.tableName' in stack
    assert 'indexName: "DayIndex"' in stack
