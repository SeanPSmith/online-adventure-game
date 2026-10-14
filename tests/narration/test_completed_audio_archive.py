"""Pass 61C.1: completed-story audio must never wake inference or leak across users."""
from __future__ import annotations

import asyncio
import io
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.narration import archive, routes
from app.persistence.store import SQLiteStateStore
from tests.adventures.test_history import AdventureHistoryTests


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.calls = []

    def put_object(self, *, Bucket, Key, Body, ContentType, ServerSideEncryption):
        assert ContentType == "audio/mpeg" and ServerSideEncryption == "AES256"
        self.objects[(Bucket, Key)] = Body
        self.calls.append(("put", Key))

    def copy_object(self, *, Bucket, Key, CopySource, ServerSideEncryption, ContentType, MetadataDirective):
        self.objects[(Bucket, Key)] = self.objects[(CopySource["Bucket"], CopySource["Key"])]
        self.calls.append(("copy", Key))

    def delete_object(self, *, Bucket, Key):
        self.objects.pop((Bucket, Key), None)

    def get_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise KeyError("not found")
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def archive_store(tmp_path, monkeypatch):
    store = SQLiteStateStore(tmp_path / "state.sqlite3")
    run(store.initialize())
    fake = FakeS3()
    monkeypatch.setenv("KOKORO_ARCHIVE_BUCKET", "private-archive")
    import boto3
    monkeypatch.setattr(boto3, "client", lambda service: fake if service == "s3" else None)
    return store, fake


def test_permitted_scene_text_only_and_no_raw_prose_in_keys():
    scene = SimpleNamespace(body="The bells ring. They cross the bridge.",
                            choices=[SimpleNamespace(label="Open the door")])
    assert archive.identify(scene, "The bells ring. They cross the bridge.") == (0, "story")
    assert archive.identify(scene, "Option 1. Open the door") == (1, "choice")
    assert archive.identify(scene, "An arbitrary unapproved passage") is None
    identity = archive.clip_id(2, 0, "some-shared-cache-key")
    assert len(identity) == 40 and "bridge" not in identity
    assert "bridge" not in archive._key("CODE:adventure", identity, completed=True)


def test_pending_promoted_to_completed_and_kept_out_of_temporary_prefix(archive_store):
    store, s3 = archive_store
    room, session = AdventureHistoryTests().build_room_and_session()
    history = "ABC123:generated_story"
    clip_id = archive.clip_id(1, 0, "key")
    assert archive.save_pending(history, clip_id, b"mp3-audio") is True
    run(store.record_audio_clip(history, clip_id, 1, 0, "story", "af_bella"))
    assert archive.promote(store, history) == 1
    assert archive.promote(store, history) == 0
    assert ("private-archive", archive._key(history, clip_id, completed=False)) not in s3.objects
    assert archive.read_completed(history, clip_id, 100) == b"mp3-audio"
    assert archive.read_completed(history, clip_id, 3) is None
    run(store.record_completed_adventure(room, session))
    owner = run(store.completed_audio_clips(history, "user-1"))
    assert len(owner) == 1 and owner[0]["archived"] == 1
    assert run(store.completed_audio_clips(history, "user-2")) is not None
    assert run(store.completed_audio_clips(history, "stranger")) is None
    assert all("ABC123" not in key for _, key in s3.calls)


def test_archive_endpoints_enforce_owner_and_do_not_infer(archive_store, monkeypatch):
    store, _ = archive_store
    room, session = AdventureHistoryTests().build_room_and_session()
    run(store.record_completed_adventure(room, session))
    monkeypatch.setitem(sys.modules, "app.main", SimpleNamespace(store=store))
    history = "ABC123:generated_story"
    with pytest.raises(HTTPException) as denied:
        run(routes.list_archived_narration(history, SimpleNamespace(user_id="stranger")))
    assert denied.value.status_code == 404
    with pytest.raises(HTTPException) as denied_audio:
        run(routes.play_archived_narration(history, "unknown", SimpleNamespace(user_id="user-1")))
    assert denied_audio.value.status_code == 404
    assert run(routes.list_archived_narration(history, SimpleNamespace(user_id="user-1"))) == {"clips": []}


def test_cache_audio_is_unaffected_when_archive_upload_fails(monkeypatch):
    # Archiving is explicitly optional, not allowed to break speech playback.
    monkeypatch.setenv("KOKORO_ARCHIVE_BUCKET", "private-archive")
    monkeypatch.setenv("KOKORO_BASE_URL", "http://127.0.0.1:8880")
    monkeypatch.setitem(sys.modules, "app.main", SimpleNamespace(rooms=SimpleNamespace(room_by_code=lambda _: None)))
    monkeypatch.setattr(routes.hosting, "healthy", lambda endpoint: True)
    monkeypatch.setattr(routes, "_read_kokoro", lambda *args: b"audio")
    routes._cache.clear()
    routes._calls.clear()
    routes._cache_bytes = 0
    response = run(routes.synthesize_speech(
        routes.SpeechRequest(text="Once upon a time", voice="af_bella", room_code="NOPE"),
        SimpleNamespace(user_id="user-1"),
    ))
    assert response.body == b"audio"


def test_authenticated_live_scene_is_saved_and_arbitrary_text_is_rejected(archive_store, monkeypatch):
    store, s3 = archive_store
    session = SimpleNamespace(
        started=True, completed=False, adventure_id="generated_story", turn_number=3,
        narrator_voice="am_michael",
        scene=SimpleNamespace(body="The gates finally opened.", choices=[]),
    )
    room = SimpleNamespace(code="ABC123", players={
        "player": SimpleNamespace(user_id="user-1", is_online=True),
    })
    main_stub = SimpleNamespace(
        rooms=SimpleNamespace(room_by_code=lambda code: room if code == "ABC123" else None),
        game_sessions=SimpleNamespace(get=lambda code: session if code == "ABC123" else None),
        store=store,
    )
    monkeypatch.setitem(sys.modules, "app.main", main_stub)
    payload = routes.SpeechRequest(text="The gates finally opened.", voice="am_michael", room_code="ABC123")
    run(routes._remember_room_audio(payload, SimpleNamespace(user_id="stranger"), payload.text, "key", b"mp3"))
    assert store._pending_audio_clips_sync("ABC123:generated_story") == []
    run(routes._remember_room_audio(payload, SimpleNamespace(user_id="user-1"), "not the scene", "key", b"mp3"))
    assert store._pending_audio_clips_sync("ABC123:generated_story") == []
    run(routes._remember_room_audio(payload, SimpleNamespace(user_id="user-1"), payload.text, "key", b"mp3"))
    assert len(store._pending_audio_clips_sync("ABC123:generated_story")) == 1
    assert len(s3.objects) == 1
    session.completed = True
    run(routes._remember_room_audio(payload, SimpleNamespace(user_id="user-1"), payload.text, "key", b"mp3"))
    assert store._pending_audio_clips_sync("ABC123:generated_story") == []
    assert len(s3.objects) == 1


def test_completed_audio_replay_reads_s3_without_waking_gpu(archive_store, monkeypatch):
    store, _ = archive_store
    room, session = AdventureHistoryTests().build_room_and_session()
    history = "ABC123:generated_story"
    clip = archive.clip_id(2, 0, "replay-clip")
    assert archive.save_pending(history, clip, b"original-michael-mp3")
    run(store.record_audio_clip(history, clip, 2, 0, "story", "am_michael"))
    run(store.record_completed_adventure(room, session))
    monkeypatch.setitem(sys.modules, "app.main", SimpleNamespace(store=store))
    # The reader must use archived bytes; never depend on _ensure_awake.
    async def forbidden(*args, **kwargs):
        raise AssertionError("archive replay must not wake EC2")
    monkeypatch.setattr(routes, "_ensure_awake", forbidden)
    listing = run(routes.list_archived_narration(history, SimpleNamespace(user_id="user-2")))
    assert len(listing["clips"]) == 1
    assert listing["clips"][0]["voice"] == "am_michael"
    response = run(routes.play_archived_narration(history, clip, SimpleNamespace(user_id="user-2")))
    assert response.body == b"original-michael-mp3"
    assert response.headers["cache-control"] == "private, no-store"
