"""Pass 62A.1: paid narrator cannot be used as a general-purpose TTS proxy."""
from __future__ import annotations

import asyncio
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.narration import routes


def run(payload, user_id="owner"):
    return asyncio.run(routes.synthesize_speech(payload, SimpleNamespace(user_id=user_id)))


@pytest.fixture(autouse=True)
def context(monkeypatch):
    routes._cache.clear()
    routes._calls.clear()
    routes._cache_bytes = 0
    monkeypatch.setenv("KOKORO_BASE_URL", "http://10.42.0.1:8880")
    monkeypatch.delenv("KOKORO_CACHE_BUCKET", raising=False)
    monkeypatch.delenv("KOKORO_ARCHIVE_BUCKET", raising=False)
    room = SimpleNamespace(code="ABC123", players={
        "online": SimpleNamespace(user_id="owner", is_online=True),
        "offline": SimpleNamespace(user_id="absent", is_online=False),
    })
    session = SimpleNamespace(started=True, completed=False, scene=SimpleNamespace(
        body="A **barbarian** enters the detective's office. He finds a clue.",
        choices=[SimpleNamespace(label="Demand an explanation"),
                 SimpleNamespace(label="Inspect the desk")],
    ))
    main_stub = SimpleNamespace(
        rooms=SimpleNamespace(room_by_code=lambda code: room if code == "ABC123" else None),
        game_sessions=SimpleNamespace(get=lambda code: session if code == "ABC123" else None),
    )
    monkeypatch.setitem(sys.modules, "app.main", main_stub)
    return room, session


def assert_denied(payload, user_id="owner"):
    with pytest.raises(HTTPException) as exc:
        run(payload, user_id)
    assert exc.value.status_code == 403


def test_missing_room_is_rejected_even_if_content_is_cached(monkeypatch):
    text = "A barbarian enters the detective's office. He finds a clue."
    key = routes._audio_key(text, "am_michael")
    routes._save_cache(key, b"already-cached")
    async def no_wake(*, wake):
        raise AssertionError("unauthorized request woke EC2")
    monkeypatch.setattr(routes, "_ensure_awake", no_wake)
    monkeypatch.setattr(routes, "_shared_audio", lambda _: (_ for _ in ()).throw(AssertionError("S3 accessed")))
    assert_denied(routes.SpeechRequest(text=text, voice="am_michael"))
    assert_denied(routes.SpeechRequest(text=text, voice="am_michael", room_code="INVALID"))
    assert routes._cache[key] == b"already-cached"
    assert not routes._calls


def test_room_code_does_not_grant_membership(context):
    text = "A barbarian enters the detective's office. He finds a clue."
    payload = routes.SpeechRequest(text=text, room_code="ABC123")
    assert_denied(payload, "intruder")
    assert_denied(payload, "absent")


def test_no_unrevealed_story_content(context):
    _, session = context
    payload = routes.SpeechRequest(text="A barbarian enters the detective's office. He finds a clue.", room_code="ABC123")
    session.started = False
    assert_denied(payload)
    session.started = True
    session.scene = None
    assert_denied(payload)


def test_arbitrary_prose_and_kind_spoof_are_rejected(context):
    assert_denied(routes.SpeechRequest(text="Narrate 1,800 characters of arbitrary spam", room_code="ABC123"))
    assert_denied(routes.SpeechRequest(
        text="A barbarian enters the detective's office. He finds a clue.", room_code="ABC123", kind="choice"))
    assert_denied(routes.SpeechRequest(text="Option 1. Demand an explanation", room_code="ABC123", kind="story"))


def test_valid_scene_and_choice_pass_without_wake_on_cache_hit(monkeypatch):
    text = "A barbarian enters the detective's office. He finds a clue."
    calls = []
    monkeypatch.setattr(routes, "_shared_audio", lambda _: b"cached-audio")
    async def no_wake(*, wake):
        calls.append(wake)
        return {"state": "stopped"}
    monkeypatch.setattr(routes, "_ensure_awake", no_wake)
    story = run(routes.SpeechRequest(text=text, voice="af_bella", room_code="abc123"))
    assert story.body == b"cached-audio"
    choice = run(routes.SpeechRequest(text="Option 2. Inspect the desk", kind="choice", room_code="ABC123"))
    assert choice.body == b"cached-audio"
    assert calls == []


def test_valid_miss_uses_generation_lease(monkeypatch):
    events = []
    monkeypatch.setattr(routes, "_shared_audio", lambda _: None)
    monkeypatch.setattr(routes, "_store_shared_audio", lambda *args: None)
    monkeypatch.setattr(routes.hosting, "healthy", lambda endpoint: True)
    monkeypatch.setattr(routes.hosting, "begin_generation", lambda: events.append("lease") or "generation#one")
    monkeypatch.setattr(routes.hosting, "finish_generation", lambda lease: events.append("release"))
    monkeypatch.setattr(routes, "_read_kokoro", lambda *args: events.append("infer") or b"audio")
    async def ready(*, wake):
        events.append("wake" if wake else "no-wake")
        return {"state": "running"}
    monkeypatch.setattr(routes, "_ensure_awake", ready)
    result = run(routes.SpeechRequest(text="Option 1. Demand an explanation", kind="choice", room_code="ABC123"))
    assert result.body == b"audio"
    assert events == ["wake", "lease", "infer", "release"]
