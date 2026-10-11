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
from app.narration import hosting

router = APIRouter(prefix="/api/narration", tags=["narration"])
logger = logging.getLogger(__name__)

VOICES = ("af_heart", "af_bella", "af_sky", "am_michael", "bm_george")
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
    return hashlib.sha256(json.dumps([CACHE_MODEL_VERSION, text, voice, 1.0]).encode()).hexdigest()


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
    _rate_limit(str(user.user_id))
    # Playback speed is client-side, not part of synthesis, to maximize reuse.
    key = _audio_key(text, payload.voice)
    audio = _cache.get(key)
    if audio is not None:
        _cache.move_to_end(key)
        return _audio_response(audio, source="memory", started=started, voice=payload.voice)
    audio = await asyncio.to_thread(_shared_audio, key)
    if audio is not None:
        _save_cache(key, audio)
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
    return _audio_response(audio, source=cache_source, started=started,
                           generation_ms=inference_ms, voice=payload.voice)
