"""Authenticated Story Time speech proxy with shared on-demand instance and private cache."""
from __future__ import annotations

import asyncio
from contextlib import suppress
from collections import OrderedDict, defaultdict, deque
import hashlib
import json
import logging
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.notifications.routes import require_user
from app.auth.routes import require_admin_write
from app.narration import hosting, archive

router = APIRouter(prefix="/api/narration", tags=["narration"])
logger = logging.getLogger(__name__)

VOICES = (
    "af_heart", "af_bella", "af_sky", "am_michael", "bm_george",
    "af_alloy", "af_aoede", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_onyx", "am_puck", "am_santa",
    "bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_lewis",
)
MAX_TEXT = 1800
MAX_AUDIO_BYTES = 5 * 1024 * 1024
CACHE_MAX_BYTES = 24 * 1024 * 1024
CACHE_MAX_ITEMS = 48
CACHE_MODEL_VERSION = "kokoro-cpu-v0.8.0"
RATE_WINDOW_SECONDS = 300
RATE_MAX_REQUESTS = 50

_cache: OrderedDict[str, bytes] = OrderedDict()
_cache_bytes = 0
_calls: dict[str, deque[float]] = defaultdict(deque)
_semaphore = asyncio.Semaphore(1)


class RoomHeartbeat(BaseModel):
    room_code: str = Field(min_length=1, max_length=32)
    enabled: bool = True


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    room_code: str | None = Field(default=None, max_length=32)
    voice: str = "af_heart"
    speed: float = Field(default=1.0, ge=0.75, le=1.5)
    kind: str = "story"


def _endpoint() -> str:
    base = os.getenv("KOKORO_BASE_URL", "").strip().rstrip("/")
    if not base:
        return ""
    if not base.startswith(("http://", "https://")):
        return ""  # URL is operator-supplied, never accepted from the browser.
    if base.endswith("/v1"):
        return base + "/audio/speech"
    return base + "/v1/audio/speech"


def _normalize_text(raw: str) -> str:
    # Strip markup and Kokoro control commands from generated prose.
    cleaned = re.sub(r"<[^>]*>", " ", raw)
    cleaned = re.sub(r"\[(?:voice|rate|pause):[^\]]+\]", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _rate_limit(user_id: str) -> None:
    now = time.monotonic()
    recent = _calls[user_id]
    while recent and now - recent[0] >= RATE_WINDOW_SECONDS:
        recent.popleft()
    if len(recent) >= RATE_MAX_REQUESTS:
        raise HTTPException(429, "Narration is busy for this account. Try again in a few minutes.")
    recent.append(now)
    if len(_calls) > 5000:
        for key in list(_calls):
            if key != user_id and (not _calls[key] or now - _calls[key][-1] > RATE_WINDOW_SECONDS):
                del _calls[key]


def _read_kokoro(endpoint: str, text: str, voice: str, speed: float) -> bytes:
    body = json.dumps({
        "model": "kokoro", "input": text, "voice": voice,
        "speed": speed, "response_format": "mp3",
    }).encode("utf-8")
    request = Request(endpoint, data=body, method="POST", headers={"Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urlopen(request, timeout=90) as response:
        content_type = response.headers.get("Content-Type", "").lower()
        if not content_type.startswith(("audio/", "application/octet-stream")):
            raise ValueError("Kokoro did not return audio.")
        audio = response.read(MAX_AUDIO_BYTES + 1)
        if not audio or len(audio) > MAX_AUDIO_BYTES:
            raise ValueError("Kokoro's audio response was empty or too large.")
        return audio


def _save_cache(key: str, audio: bytes) -> None:
    global _cache_bytes
    if len(audio) > CACHE_MAX_BYTES:
        return
    previous = _cache.pop(key, None)
    if previous:
        _cache_bytes -= len(previous)
    _cache[key] = audio
    _cache_bytes += len(audio)
    while len(_cache) > CACHE_MAX_ITEMS or _cache_bytes > CACHE_MAX_BYTES:
        _, evicted = _cache.popitem(last=False)
        _cache_bytes -= len(evicted)


def _shared_audio(key: str) -> bytes | None:
    bucket = os.getenv("KOKORO_CACHE_BUCKET", "").strip()
    if not bucket:
        return None
    try:
        import boto3
        from botocore.exceptions import ClientError
        result = boto3.client("s3").get_object(Bucket=bucket, Key=f"story-time/{key}.mp3")
        data = result["Body"].read(MAX_AUDIO_BYTES + 1)
        return data if 0 < len(data) <= MAX_AUDIO_BYTES else None
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
            return None
        # A cache outage must not invalidate an otherwise working narration request.
        return None
    except Exception:
        # Network outages in the optional S3 cache must not stop narration.
        return None


def _store_shared_audio(key: str, audio: bytes) -> None:
    bucket = os.getenv("KOKORO_CACHE_BUCKET", "").strip()
    if not bucket:
        return
    try:
        import boto3
        boto3.client("s3").put_object(Bucket=bucket, Key=f"story-time/{key}.mp3",
            Body=audio, ContentType="audio/mpeg", ServerSideEncryption="AES256")
    except Exception:
        # S3 cache is optional; do not turn a successful speech response into an error.
        pass


def _audio_key(text: str, voice: str) -> str:
    # Client playback rate never affects synthesis or the shared cache.
    # CPU v0.8 and GPU v0.9 are not interchangeable, even when voices and
    # MP3 byte lengths appear identical. Prevent cross-model cache poisoning.
    version = os.getenv("KOKORO_CACHE_VERSION", CACHE_MODEL_VERSION).strip() or CACHE_MODEL_VERSION
    return hashlib.sha256(json.dumps([version, text, voice, 1.0]).encode()).hexdigest()


def _audio_response(audio: bytes, *, source: str = "generated", started: float | None = None,
                    generation_ms: int | None = None, voice: str = "") -> Response:
    """Expose server/cache latency, never spoken text, account IDs or cache keys."""
    elapsed = round((time.perf_counter() - started) * 1000) if started is not None else 0
    headers = {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Story-Time-Cache": source,
        "X-Story-Time-Server-Ms": str(elapsed),
    }
    if generation_ms is not None:
        headers["X-Story-Time-Inference-Ms"] = str(generation_ms)
    logger.info("story_time_audio cache=%s server_ms=%d inference_ms=%s voice=%s bytes=%d",
                source, elapsed, generation_ms if generation_ms is not None else "-", voice, len(audio))
    return Response(content=audio, media_type="audio/mpeg", headers=headers)


async def _ensure_awake(*, wake: bool) -> dict:
    if not hosting.configured():
        return {"state": "legacy"} if _endpoint() else {"state": "unconfigured"}
    try:
        return await asyncio.to_thread(hosting.touch, wake=wake)
    except Exception:
        return {"state": "unavailable"}


@router.get("/status")
async def narration_status(user=Depends(require_user)):
    endpoint = _endpoint()
    if not endpoint:
        return {"available": False, "state": "unconfigured", "voices": list(VOICES), "max_text_length": MAX_TEXT}
    host = await _ensure_awake(wake=False)
    state = host["state"]
    if state in {"budget_exhausted", "unavailable", "unconfigured"}:
        return {"available": False, "state": state, "voices": list(VOICES), "max_text_length": MAX_TEXT}
    # Do not wake EC2 just because the player opened Settings or entered a game.
    # S3 audio already cached remains available while compute sleeps.
    return {"available": True,
            "state": "sleeping" if state == "stopped" else ("starting" if state == "pending" else "ready"),
            "voices": list(VOICES), "max_text_length": MAX_TEXT}


@router.post("/heartbeat")
async def narration_heartbeat(payload: RoomHeartbeat | None = None, user=Depends(require_user)):
    """Wake/maintain only an authenticated participant in a live room.

    Missing room_code is intentionally a legacy no-wake heartbeat. A random
    authenticated account must never be able to keep the GPU running.
    """
    if payload is None:
        host = await _ensure_awake(wake=False)
        return {"state": host["state"]}
    room_code = payload.room_code.strip().upper()
    from app import main  # lazy import: main registers this router
    room = main.rooms.room_by_code(room_code)
    if room is None or not any(
        str(p.user_id) == str(user.user_id) and p.is_online
        for p in room.players.values()
    ):
        raise HTTPException(403, "An active adventure membership is required for Story Time.")
    if not hosting.configured():
        return {"state": "legacy" if _endpoint() else "unconfigured"}
    try:
        return await asyncio.to_thread(hosting.lease_room, room_code, str(user.user_id), enabled=payload.enabled)
    except Exception:
        logger.exception("Story Time room lease renewal failed")
        return {"state": "unavailable"}


# Prepared once by an administrator, stored in the non-expiring private
# archive bucket. Player previews NEVER call hosting.touch or Kokoro.
PREVIEW_TEXT = (
    "Beyond the ancient gates, a silver lantern flickered. "
    "Your companions exchanged a wary glance as the forgotten kingdom stirred beneath the stars."
)
PREVIEW_VERSION = "kokoro-v0.9-gpu-english-v1"


def _preview_key(voice: str) -> str:
    return f"previews/{PREVIEW_VERSION}/{voice}.mp3"


def _preview_read(voice: str) -> bytes | None:
    bucket = os.getenv("KOKORO_ARCHIVE_BUCKET", "").strip()
    if not bucket:
        return None
    try:
        import boto3
        from botocore.exceptions import ClientError
        obj = boto3.client("s3").get_object(Bucket=bucket, Key=_preview_key(voice))
        audio = obj["Body"].read(MAX_AUDIO_BYTES + 1)
        return audio if 0 < len(audio) <= MAX_AUDIO_BYTES else None
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") not in {"NoSuchKey", "404"}:
            logger.warning("voice_preview_read_error voice=%s", voice)
        return None
    except Exception:
        return None


def _preview_save(voice: str, audio: bytes) -> None:
    bucket = os.getenv("KOKORO_ARCHIVE_BUCKET", "").strip()
    if not bucket:
        raise RuntimeError("The private voice preview archive is not configured.")
    import boto3
    boto3.client("s3").put_object(
        Bucket=bucket, Key=_preview_key(voice), Body=audio,
        ContentType="audio/mpeg", ServerSideEncryption="AES256",
    )


@router.get("/previews/{voice}")
async def play_voice_preview(voice: str, user=Depends(require_user)):
    if voice not in VOICES:
        raise HTTPException(404, "Unknown narrator voice.")
    audio = await asyncio.to_thread(_preview_read, voice)
    if audio is None:
        raise HTTPException(404, "This voice sample has not been prepared yet.")
    return _audio_response(audio, source="s3", voice=voice)


@router.post("/previews/seed/{voice}")
async def seed_voice_preview(voice: str, admin=Depends(require_admin_write)):
    """Explicit admin-only one-time generation; no player can wake GPU for previews."""
    if voice not in VOICES:
        raise HTTPException(404, "Unknown narrator voice.")
    if not os.getenv("KOKORO_ARCHIVE_BUCKET", "").strip():
        raise HTTPException(409, "The private sample archive has not been configured.")
    if await asyncio.to_thread(_preview_read, voice) is not None:
        return {"voice": voice, "cached": True}
    endpoint = _endpoint()
    if not endpoint:
        raise HTTPException(503, "Voice service is not configured.")
    host = await _ensure_awake(wake=True)
    if host["state"] not in {"running", "legacy"} or not await asyncio.to_thread(hosting.healthy, endpoint):
        raise HTTPException(503, "GPU is awakening; retry this preview in a few seconds.",
                            headers={"Retry-After": "6"})
    async with _semaphore:
        if await asyncio.to_thread(_preview_read, voice) is not None:
            return {"voice": voice, "cached": True}
        try:
            lease = await asyncio.to_thread(hosting.begin_generation)
        except Exception as exc:
            raise HTTPException(503, "Voice generation is temporarily unavailable.") from exc
        try:
            audio = await asyncio.to_thread(_read_kokoro, endpoint, PREVIEW_TEXT, voice, 1.0)
            await asyncio.to_thread(_preview_save, voice, audio)
        except Exception as exc:
            logger.warning("voice_preview_seed_failed voice=%s type=%s", voice, type(exc).__name__)
            raise HTTPException(502, "Unable to prepare this voice preview.") from exc
        finally:
            await asyncio.to_thread(hosting.finish_generation, lease)
    return {"voice": voice, "cached": False}


@router.get("/archive/{history_id}")
async def list_archived_narration(history_id: str, user=Depends(require_user)):
    from app.main import store
    clips = await store.completed_audio_clips(history_id, str(user.user_id))
    if clips is None:
        raise HTTPException(404, "Chronicle not found.")
    # Retry interrupted promotion on demand, without ever waking the narrator.
    await asyncio.to_thread(archive.promote, store, history_id)
    clips = await store.completed_audio_clips(history_id, str(user.user_id))
    return {"clips": [{k: c[k] for k in ("clip_id", "turn_number", "position", "kind", "voice")}
                      for c in clips if c["archived"]]}


@router.get("/archive/{history_id}/{clip_id}")
async def play_archived_narration(history_id: str, clip_id: str, user=Depends(require_user)):
    from app.main import store
    clips = await store.completed_audio_clips(history_id, str(user.user_id))
    if clips is None or not any(c["clip_id"] == clip_id and c["archived"] for c in clips):
        raise HTTPException(404, "Archived audio not found.")
    audio = await asyncio.to_thread(archive.read_completed, history_id, clip_id, MAX_AUDIO_BYTES)
    if audio is None:
        raise HTTPException(404, "Archived audio is unavailable.")
    return _audio_response(audio, source="s3")


async def _remember_room_audio(payload: SpeechRequest, user, text: str,
                               key: str, audio: bytes) -> None:
    """Untrusted browser room codes are never enough to claim a story clip."""
    if not payload.room_code or not os.getenv("KOKORO_ARCHIVE_BUCKET"):
        return
    try:
        from app.main import rooms, game_sessions, store
        room = rooms.room_by_code(payload.room_code.strip().upper())
        if room is None or not any(str(p.user_id) == str(user.user_id) and p.is_online
                                   for p in room.players.values()):
            return
        session = game_sessions.get(room.code)
        if (session is None or not session.started or payload.voice not in VOICES):
            return
        matched = archive.identify(session.scene, text)
        if matched is None:
            return
        position, kind = matched
        history_id = f"{room.code}:{session.adventure_id}"
        value = archive.clip_id(int(session.turn_number), position, key)
        # Save pending bytes first; never create a manifest for missing audio.
        saved = await asyncio.to_thread(archive.save_pending, history_id, value, audio)
        if not saved:
            return
        await store.record_audio_clip(history_id, value, int(session.turn_number),
                                      position, kind, payload.voice)
        if session.completed:
            await asyncio.to_thread(archive.promote, store, history_id)
    except Exception as exc:
        logger.warning("story_time_archive_write_skipped type=%s", type(exc).__name__)


def _authorize_scene_speech(payload: SpeechRequest, user, text: str) -> None:
    """Fail closed before even looking up shared cache or waking paid inference.

    The room code is an untrusted locator, not authorization. Only a current,
    server-committed scene read by an online member may be voiced. This also
    prevents an account from synthesizing arbitrary text through our GPU.
    Prepared voice previews and completed Chronicle playback have separate
    authenticated, no-inference endpoints and are unaffected.
    """
    code = (payload.room_code or "").strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{6}", code):
        raise HTTPException(403, "Join an active adventure to use Story Time narration.")
    from app.main import rooms, game_sessions  # Lazy import after application startup.
    room = rooms.room_by_code(code)
    if room is None or not any(
        str(member.user_id) == str(user.user_id) and member.is_online
        for member in room.players.values()
    ):
        raise HTTPException(403, "An active adventure membership is required for narration.")
    session = game_sessions.get(code)
    if session is None or not session.started or session.scene is None:
        raise HTTPException(403, "There is no revealed adventure passage to narrate.")
    match = archive.identify(session.scene, text)
    if match is None or match[1] != payload.kind:
        raise HTTPException(403, "Only the current adventure passage may be narrated.")


@router.post("/speech")
async def synthesize_speech(payload: SpeechRequest, user=Depends(require_user)):
    started = time.perf_counter()
    endpoint = _endpoint()
    if not endpoint:
        raise HTTPException(503, "The narrator is not connected yet. Please try again later.")
    if payload.voice not in VOICES or payload.kind not in {"story", "choice"}:
        raise HTTPException(422, "Unsupported narration option.")
    text = _normalize_text(payload.text)
    if not text:
        raise HTTPException(422, "Nothing to narrate.")
    # Admission MUST precede memory/S3 cache reads, rate accounting and GPU wake.
    _authorize_scene_speech(payload, user, text)
    _rate_limit(str(user.user_id))
    # Playback speed is client-side, not part of synthesis, to maximize reuse.
    key = _audio_key(text, payload.voice)
    audio = _cache.get(key)
    if audio is not None:
        _cache.move_to_end(key)
        await _remember_room_audio(payload, user, text, key, audio)
        return _audio_response(audio, source="memory", started=started, voice=payload.voice)
    audio = await asyncio.to_thread(_shared_audio, key)
    if audio is not None:
        _save_cache(key, audio)
        await _remember_room_audio(payload, user, text, key, audio)
        return _audio_response(audio, source="s3", started=started, voice=payload.voice)
    host = await _ensure_awake(wake=True)
    if host["state"] in {"unavailable", "budget_exhausted", "unconfigured"}:
        raise HTTPException(503, "The storyteller is not available. Continue reading for now.")
    if host["state"] not in {"running", "legacy"} or not await asyncio.to_thread(hosting.healthy, endpoint):
        raise HTTPException(503, "The storyteller is awakening. Continue reading for now.",
                            headers={"Retry-After": "6"})
    async with _semaphore:
        cache_source = "generated"
        inference_ms = None
        audio = _cache.get(key)
        if audio is not None:
            cache_source = "memory"
        if audio is None:
            audio = await asyncio.to_thread(_shared_audio, key)
            if audio is not None:
                cache_source = "s3"
        if audio is None:
            try:
                lease = await asyncio.to_thread(hosting.begin_generation)
            except Exception as exc:
                raise HTTPException(503, "The narrator is preparing to retry. Continue reading for now.") from exc
            async def keep_lease_alive():
                # A long or streamed generation can run beyond the first lease.
                # On worker crash, heartbeats stop and the lease expires naturally.
                while True:
                    await asyncio.sleep(45)
                    try:
                        await asyncio.to_thread(hosting.renew_generation, lease)
                    except Exception:
                        # Losing a lease is a health issue, not a reason to break
                        # the ongoing optional narration response mid-stream.
                        pass

            renewal = asyncio.create_task(keep_lease_alive()) if lease else None
            try:
                try:
                    inference_started = time.perf_counter()
                    audio = await asyncio.to_thread(_read_kokoro, endpoint, text, payload.voice, 1.0)
                    inference_ms = round((time.perf_counter() - inference_started) * 1000)
                except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
                    raise HTTPException(502, "The narrator could not prepare this passage. Try again.") from exc
            finally:
                if renewal:
                    renewal.cancel()
                    with suppress(asyncio.CancelledError):
                        await renewal
                await asyncio.to_thread(hosting.finish_generation, lease)
            await asyncio.to_thread(_store_shared_audio, key, audio)
        _save_cache(key, audio)
    await _remember_room_audio(payload, user, text, key, audio)
    return _audio_response(audio, source=cache_source, started=started,
                           generation_ms=inference_ms, voice=payload.voice)
