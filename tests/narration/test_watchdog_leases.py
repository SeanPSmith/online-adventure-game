"""Pass 58B hotfix: watchdog cannot cut off ongoing inference or manual tests."""
import asyncio
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.narration import hosting, routes

ROOT = Path(__file__).resolve().parents[2]


def load_watchdog():
    spec = importlib.util.spec_from_file_location("watchdog_under_test", ROOT / "infra/narrator/watchdog.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_manual_hold_prevents_idle_shutdown_but_expires():
    w = load_watchdog()
    now = 1791670000
    base = {"month": w.month_of(now), "last_request_epoch": now - 1900,
            "last_probe_epoch": now - 300, "manual_lease_until_epoch": now + 1800}
    protected = w.reconcile(base, now, True)
    assert protected["maintenance_active"]
    assert not protected["should_stop"]
    base["manual_lease_until_epoch"] = now - 1
    assert w.reconcile(base, now, True)["should_stop"]


def test_live_generation_prevents_idle_and_quota_stop():
    w = load_watchdog()
    now = 1791670000
    base = {"month": w.month_of(now), "used_seconds": w.LIMIT,
            "last_probe_epoch": now, "last_request_epoch": now - 1900}
    result = w.reconcile(base, now, True, generation_active=True)
    assert result["quota_exhausted"] and not result["should_stop"]
    assert w.reconcile(base, now, True)["should_stop"]


def test_scans_paginate_and_ignores_expired_lease():
    w = load_watchdog()
    class Table:
        def __init__(self): self.calls = 0
        def scan(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return {"Items": [], "LastEvaluatedKey": {"id": "generation#old"}}
            assert "ExclusiveStartKey" in kwargs
            return {"Items": [{"id": "generation#live"}]}
    table = Table()
    assert w.active_generation(table, 1234)
    assert table.calls == 2
    assert not w.active_generation(SimpleNamespace(scan=lambda **kw: {"Items": []}), 1234)


def test_job_lease_is_durable_and_cleared(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.10:8880")
    monkeypatch.setenv("KOKORO_INSTANCE_ID", "i-test")
    monkeypatch.setenv("KOKORO_ACTIVITY_TABLE", "test-leases")
    events = []
    class Table:
        def put_item(self, **kwargs): events.append(("put", kwargs["Item"]))
        def delete_item(self, **kwargs): events.append(("delete", kwargs["Key"]))
    fake = SimpleNamespace(resource=lambda service: SimpleNamespace(Table=lambda name: Table()))
    import boto3
    monkeypatch.setattr(boto3, "resource", fake.resource)
    job = hosting.begin_generation()
    assert job.startswith("generation#")
    assert events[0][1]["expires_at_epoch"] > 0
    hosting.finish_generation(job)
    assert events[1][1]["id"] == job


def test_game_speech_lease_around_generation(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.10:8880")
    routes._cache.clear()
    routes._calls.clear()
    routes._cache_bytes = 0
    events = []
    async def ready(*, wake): return {"state": "running"}
    monkeypatch.setattr(routes, "_ensure_awake", ready)
    monkeypatch.setattr(routes.hosting, "healthy", lambda endpoint: True)
    monkeypatch.setattr(routes, "_shared_audio", lambda key: None)
    monkeypatch.setattr(routes, "_store_shared_audio", lambda *args: None)
    monkeypatch.setattr(routes.hosting, "begin_generation", lambda: events.append("start") or "generation#test")
    monkeypatch.setattr(routes.hosting, "finish_generation", lambda job: events.append("stop"))
    monkeypatch.setattr(routes, "_read_kokoro", lambda *args: events.append("read") or b"hello")
    user = SimpleNamespace(user_id="lease-user")
    result = asyncio.run(routes.synthesize_speech(routes.SpeechRequest(text="The dragon waits."), user))
    assert result.body == b"hello"
    assert events == ["start", "read", "stop"]


def test_failed_synthesis_always_releases_lease(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.10:8880")
    routes._cache.clear(); routes._calls.clear(); routes._cache_bytes = 0
    async def ready(*, wake): return {"state": "running"}
    monkeypatch.setattr(routes, "_ensure_awake", ready)
    monkeypatch.setattr(routes.hosting, "healthy", lambda endpoint: True)
    monkeypatch.setattr(routes, "_shared_audio", lambda key: None)
    monkeypatch.setattr(routes, "_store_shared_audio", lambda *args: None)
    events = []
    monkeypatch.setattr(routes.hosting, "begin_generation", lambda: "generation#test")
    monkeypatch.setattr(routes.hosting, "finish_generation", lambda job: events.append(job))
    def broken(*args): raise TimeoutError("too slow")
    monkeypatch.setattr(routes, "_read_kokoro", broken)
    with pytest.raises(Exception) as exc:
        asyncio.run(routes.synthesize_speech(routes.SpeechRequest(text="The flooded bridge."), SimpleNamespace(user_id="user-2")))
    assert getattr(exc.value, "status_code", None) == 502
    assert events == ["generation#test"]

@pytest.mark.parametrize("lease_active,manual_active,should_stop", [
    (True, False, False),
    (False, True, False),
    (False, False, True),
])
def test_handler_never_stops_an_active_generation_or_manual_hold(
    monkeypatch, lease_active, manual_active, should_stop,
):
    w = load_watchdog()
    now = 1791670000
    monkeypatch.setattr(w.time, "time", lambda: now)
    w.INSTANCE_ID = "i-test"
    w.TABLE_NAME = "table-test"
    w.LIMIT = 216000
    w.IDLE = 1800
    state = {"id": "narrator", "month": w.month_of(now), "used_seconds": 0,
             "last_probe_epoch": now - 300, "last_request_epoch": now - 4000,
             "manual_lease_until_epoch": now + 900 if manual_active else now - 1}
    class Table:
        def get_item(self, **kwargs): return {"Item": state.copy()}
        def update_item(self, **kwargs): return {}
        def scan(self, **kwargs):
            return {"Items": [{"id": "generation#fresh"}]} if lease_active else {"Items": []}
    instance = {"State": {"Name": "running"},
                "LaunchTime": datetime.fromtimestamp(now - 3600, timezone.utc)}
    calls = []
    class EC2:
        def describe_instances(self, **kwargs):
            return {"Reservations": [{"Instances": [instance]}]}
        def stop_instances(self, **kwargs): calls.append(kwargs)
    monkeypatch.setattr(w.boto3, "client", lambda name: EC2())
    monkeypatch.setattr(w.boto3, "resource", lambda name: SimpleNamespace(Table=lambda name: Table()))
    response = w.handler({}, None)
    assert bool(calls) == should_stop
    assert (response["status"] == "stopping") == should_stop


def test_long_synthesis_renews_the_expiring_lease(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.10:8880")
    monkeypatch.setenv("KOKORO_INSTANCE_ID", "i-test")
    monkeypatch.setenv("KOKORO_ACTIVITY_TABLE", "test-leases")
    calls = []
    class Table:
        def update_item(self, **kwargs): calls.append(kwargs)
    import boto3
    monkeypatch.setattr(boto3, "resource", lambda svc: SimpleNamespace(Table=lambda name: Table()))
    hosting.renew_generation("generation#still-working")
    assert calls[0]["Key"]["id"] == "generation#still-working"
    assert calls[0]["ConditionExpression"] == "attribute_exists(id)"
    assert calls[0]["ExpressionAttributeValues"][":expires"] > 0
