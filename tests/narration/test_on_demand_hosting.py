"""Pass 58B: voice hosting is isolated from the canonical gameplay timeline."""
import asyncio
from types import SimpleNamespace
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.narration import hosting, routes
from tests.support import PROJECT_ROOT


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    routes._cache.clear(); routes._calls.clear(); routes._cache_bytes = 0
    for name in ("KOKORO_BASE_URL", "KOKORO_INSTANCE_ID", "KOKORO_ACTIVITY_TABLE", "KOKORO_CACHE_BUCKET"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(routes, "_authorize_scene_speech", lambda *args: None)


def user():
    return SimpleNamespace(user_id="private-player")


def speech(**kwargs):
    return asyncio.run(routes.synthesize_speech(routes.SpeechRequest(**kwargs), user()))


def test_no_aws_when_unconfigured(monkeypatch):
    assert hosting.configured() is False
    assert asyncio.run(routes.narration_status(user=user()))["available"] is False


def test_status_never_wakes_sleeping_ec2(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.55:8880")
    calls = []
    async def touch(*, wake):
        calls.append(wake)
        return {"state": "stopped"}
    monkeypatch.setattr(routes, "_ensure_awake", touch)
    data = asyncio.run(routes.narration_status(user=user()))
    assert data["available"] is True and data["state"] == "sleeping"
    assert calls == [False]


def test_cache_hit_does_not_start_ec2(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.55:8880")
    calls = []
    monkeypatch.setattr(routes, "_shared_audio", lambda key: b"cached-audio")
    async def touch(*, wake):
        calls.append(wake)
        return {"state": "stopped"}
    monkeypatch.setattr(routes, "_ensure_awake", touch)
    assert speech(text="Old tale from cache.").body == b"cached-audio"
    assert calls == []


def test_cache_key_ignores_playback_speed(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.55:8880")
    monkeypatch.setattr(routes.hosting, "healthy", lambda endpoint: True)
    monkeypatch.setattr(routes, "_shared_audio", lambda key: None)
    monkeypatch.setattr(routes, "_store_shared_audio", lambda *args: None)
    calls = []
    async def touch(*, wake):
        return {"state": "running"}
    monkeypatch.setattr(routes, "_ensure_awake", touch)
    def read(*args):
        calls.append(args)
        return b"generated"
    monkeypatch.setattr(routes, "_read_kokoro", read)
    assert speech(text="The same passage.", speed=0.8).body == b"generated"
    assert speech(text="The same passage.", speed=1.3).body == b"generated"
    assert len(calls) == 1
    assert calls[0][-1] == 1.0


def test_miss_starts_and_queues_without_blocking_game(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.55:8880")
    monkeypatch.setattr(routes, "_shared_audio", lambda key: None)
    calls = []
    async def touch(*, wake):
        calls.append(wake)
        return {"state": "pending"}
    monkeypatch.setattr(routes, "_ensure_awake", touch)
    with pytest.raises(HTTPException) as exc:
        speech(text="New chapter.")
    assert exc.value.status_code == 503
    assert exc.value.headers["Retry-After"] == "6"
    assert calls == [True]


def test_heartbeat_never_wakes(monkeypatch):
    calls = []
    async def touch(*, wake):
        calls.append(wake)
        return {"state": "stopped"}
    monkeypatch.setattr(routes, "_ensure_awake", touch)
    data = asyncio.run(routes.narration_heartbeat(user=user()))
    assert data["state"] == "stopped" and calls == [False]


def test_watchdog_uses_monthly_quota_and_idle_check():
    # Import the Lambda's pure accounting function without needing AWS credentials.
    import importlib.util
    p = PROJECT_ROOT / "infra/narrator/watchdog.py"
    spec = importlib.util.spec_from_file_location("narrator_watchdog_test", p)
    assert spec and spec.loader
    import sys
    # boto3 is part of the AWS Lambda runtime and frontend backend requirements.
    if importlib.util.find_spec("boto3") is None:
        pytest.skip("AWS SDK not installed in local test environment")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    now = int(datetime(2026, 10, 10, tzinfo=timezone.utc).timestamp())
    idle = mod.reconcile({"month": "2026-10", "used_seconds": 200,
                          "last_probe_epoch": now - 300, "last_request_epoch": now - 1850}, now, True)
    assert idle["should_stop"] and idle["used_seconds"] == 500
    renewed = mod.reconcile({"month": "2026-10", "used_seconds": 100,
                             "last_probe_epoch": now - 300, "last_request_epoch": now - 10}, now, True)
    assert not renewed["should_stop"]
    quota = mod.reconcile({"month": "2026-10", "used_seconds": 216000,
                           "last_probe_epoch": now, "last_request_epoch": now}, now, True)
    assert quota["quota_exhausted"]


def test_gameplay_not_importing_or_waiting_for_inference():
    for filename in ("app/game/session.py", "app/generation/director.py"):
        source = (PROJECT_ROOT / filename).read_text()
        assert "narration.hosting" not in source
        assert "start_instances" not in source
