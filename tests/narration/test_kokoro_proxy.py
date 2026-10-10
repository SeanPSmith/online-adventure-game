"""Pass 56: Kokoro endpoint guards, caching, auth-independent speech contract."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.narration import routes


@pytest.fixture(autouse=True)
def reset_proxy(monkeypatch):
    routes._cache.clear()
    routes._calls.clear()
    routes._cache_bytes = 0
    monkeypatch.delenv("KOKORO_BASE_URL", raising=False)


def run_speech(**kw):
    return asyncio.run(routes.synthesize_speech(routes.SpeechRequest(**kw), SimpleNamespace(user_id="user-1")))


def test_no_kokoro_endpoint_is_explicitly_unavailable():
    assert asyncio.run(routes.narration_status(user=object()))["available"] is False
    with pytest.raises(HTTPException) as exc:
        run_speech(text="The lantern catches fire.")
    assert exc.value.status_code == 503


def test_only_known_voices_and_kinds_are_allowed(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://localhost:8880")
    assert routes._endpoint() == "http://localhost:8880/v1/audio/speech"
    with pytest.raises(HTTPException) as exc:
        run_speech(text="Hello", voice="unknown")
    assert exc.value.status_code == 422
    with pytest.raises(HTTPException) as exc:
        run_speech(text="Hello", kind="microphone")
    assert exc.value.status_code == 422


def test_proxy_caches_same_text_voice_and_speed(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "https://private.example/v1")
    calls = []
    def fake_backend(endpoint, text, voice, speed):
        calls.append((endpoint, text, voice, speed))
        return b"test-mp3-bytes"
    monkeypatch.setattr(routes, "_read_kokoro", fake_backend)
    one = run_speech(text="**Chapter:** Hello.", voice="af_heart", speed=1.0)
    two = run_speech(text="**Chapter:** Hello.", voice="af_heart", speed=1.0)
    three = run_speech(text="**Chapter:** Hello.", voice="af_bella", speed=1.0)
    assert one.body == two.body == three.body == b"test-mp3-bytes"
    assert len(calls) == 2
    assert one.headers["cache-control"] == "private, no-store"
    assert calls[0][0].endswith("/v1/audio/speech")


def test_long_text_invalid_and_controls_removed(monkeypatch):
    assert "voice:" not in routes._normalize_text("Hi [voice:am_michael] there")
    with pytest.raises(Exception):
        routes.SpeechRequest(text="a" * (routes.MAX_TEXT + 1))


def test_rate_limited_requests(monkeypatch):
    monkeypatch.setenv("KOKORO_BASE_URL", "http://localhost:8880")
    monkeypatch.setattr(routes, "_read_kokoro", lambda *args: b"mp3")
    for _ in range(routes.RATE_MAX_REQUESTS):
        run_speech(text="Hello")
    with pytest.raises(HTTPException) as exc:
        run_speech(text="Hello")
    assert exc.value.status_code == 429
