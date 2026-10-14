"""Pass 61D: English Kokoro catalog and private, opt-in sample preparation."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from app.narration import routes


ENGLISH = {
    "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky", "am_adam",
    "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx",
    "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily",
    "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
}


def run(awaitable):
    return asyncio.run(awaitable)


def test_full_english_catalog_is_explicit_and_matches_client():
    from pathlib import Path
    import re
    path = Path(__file__).resolve().parents[2] / "frontend/src/services/audioPreferences.ts"
    client_ids = set(re.findall(r'value: "([ab][fm]_[a-z]+)"', path.read_text()))
    assert set(routes.VOICES) == ENGLISH
    assert client_ids == ENGLISH
    assert len(routes.VOICES) == len(set(routes.VOICES)) == 28
    assert routes.SpeechRequest(text="Let there be light", voice="bf_emma").voice == "bf_emma"


def test_preview_missing_never_wakes_gpu(monkeypatch):
    calls = []
    monkeypatch.setattr(routes, "_preview_read", lambda voice: calls.append(("s3", voice)) or None)
    monkeypatch.setattr(routes, "_ensure_awake", lambda **kwargs: (_ for _ in ()).throw(AssertionError("GPU woke for preview")))
    with pytest.raises(HTTPException) as err:
        run(routes.play_voice_preview("am_michael", SimpleNamespace(user_id="player")))
    assert err.value.status_code == 404
    assert calls == [("s3", "am_michael")]
    with pytest.raises(HTTPException) as bad:
        run(routes.play_voice_preview("af_fake", SimpleNamespace(user_id="player")))
    assert bad.value.status_code == 404
    assert calls == [("s3", "am_michael")]


def test_cached_preview_is_private_mp3_and_never_wakes(monkeypatch):
    monkeypatch.setattr(routes, "_preview_read", lambda _: b"already-encoded-mp3")
    monkeypatch.setattr(routes, "_ensure_awake", lambda **kwargs: (_ for _ in ()).throw(AssertionError("unwanted wake")))
    response = run(routes.play_voice_preview("bf_emma", SimpleNamespace(user_id="player")))
    assert response.body == b"already-encoded-mp3"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.media_type == "audio/mpeg"


def test_admin_seed_reuses_archive_and_does_not_generate_again(monkeypatch):
    monkeypatch.setenv("KOKORO_ARCHIVE_BUCKET", "private")
    monkeypatch.setattr(routes, "_preview_read", lambda _: b"mp3")
    monkeypatch.setattr(routes, "_ensure_awake", lambda **kwargs: (_ for _ in ()).throw(AssertionError("unwanted wake")))
    result = run(routes.seed_voice_preview("am_michael", SimpleNamespace(user_id="admin")))
    assert result == {"voice": "am_michael", "cached": True}


def test_admin_seed_uses_only_fixed_passage_and_stores_result(monkeypatch):
    monkeypatch.setenv("KOKORO_ARCHIVE_BUCKET", "private")
    monkeypatch.setenv("KOKORO_BASE_URL", "http://127.0.0.1:8880")
    monkeypatch.setattr(routes, "_preview_read", lambda _: None)
    async def awake(**kwargs):
        assert kwargs == {"wake": True}
        return {"state": "legacy"}
    monkeypatch.setattr(routes, "_ensure_awake", awake)
    monkeypatch.setattr(routes.hosting, "healthy", lambda _: True)
    monkeypatch.setattr(routes.hosting, "begin_generation", lambda: "gen-lease")
    seen = []
    monkeypatch.setattr(routes.hosting, "finish_generation", lambda token: seen.append(("release", token)))
    monkeypatch.setattr(routes, "_read_kokoro", lambda url,text,voice,speed: seen.append((url,text,voice,speed)) or b"mp3")
    monkeypatch.setattr(routes, "_preview_save", lambda voice,audio: seen.append(("save",voice,audio)))
    result = run(routes.seed_voice_preview("am_fenrir", SimpleNamespace(user_id="admin")))
    assert result == {"voice": "am_fenrir", "cached": False}
    assert seen[0] == ("http://127.0.0.1:8880/v1/audio/speech", routes.PREVIEW_TEXT, "am_fenrir", 1.0)
    assert seen[1] == ("save", "am_fenrir", b"mp3")
    assert seen[2] == ("release", "gen-lease")


def test_non_english_and_unknown_preview_seeding_is_rejected(monkeypatch):
    monkeypatch.setattr(routes, "_preview_read", lambda _: (_ for _ in ()).throw(AssertionError("S3 accessed")))
    with pytest.raises(HTTPException) as err:
        run(routes.seed_voice_preview("ef_dora", SimpleNamespace(user_id="admin")))
    assert err.value.status_code == 404


def test_story_archive_can_include_a_participants_personal_voice(monkeypatch):
    from app.narration import archive
    room = SimpleNamespace(code="ABC123", players={"p": SimpleNamespace(user_id="player", is_online=True)})
    session = SimpleNamespace(started=True,completed=False,adventure_id="x",turn_number=1,narrator_voice="am_michael",
                              scene=SimpleNamespace(body="The lantern glows.",choices=[]))
    rec=[]
    async def record(*args): rec.append(args)
    fake = SimpleNamespace(rooms=SimpleNamespace(room_by_code=lambda _:room),
                           game_sessions=SimpleNamespace(get=lambda _: session),
                           store=SimpleNamespace(record_audio_clip=record))
    import sys
    monkeypatch.setitem(sys.modules,"app.main",fake)
    monkeypatch.setenv("KOKORO_ARCHIVE_BUCKET","private")
    monkeypatch.setattr(archive,"save_pending",lambda *args:True)
    payload=routes.SpeechRequest(text="The lantern glows.",voice="af_bella",room_code="ABC123")
    run(routes._remember_room_audio(payload,SimpleNamespace(user_id="player"),payload.text,"hash",b"audio"))
    assert rec and rec[0][-1] == "af_bella"

def test_admin_seed_cannot_wake_gpu_when_archive_missing(monkeypatch):
    monkeypatch.delenv("KOKORO_ARCHIVE_BUCKET", raising=False)
    monkeypatch.setattr(routes, "_ensure_awake", lambda **kw: (_ for _ in ()).throw(AssertionError("GPU woke")))
    with pytest.raises(HTTPException) as err:
        run(routes.seed_voice_preview("af_bella", SimpleNamespace(user_id="admin")))
    assert err.value.status_code == 409

