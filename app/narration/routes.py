"""Authenticated, bounded proxy for a separately deployed Kokoro-FastAPI service.

The game never loads model weights or exposes the inference service to players.
No audio/text is persisted to disk: the small in-process LRU is ephemeral.
"""
from __future__ import annotations

import asyncio
from collections import OrderedDict, defaultdict, deque
import hashlib
import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.notifications.routes import require_user

router = APIRouter(prefix="/api/narration", tags=["narration"])

VOICES = ("af_heart", "af_bella", "af_sky", "am_michael", "bm_george")
MAX_TEXT = 1800
MAX_AUDIO_BYTES = 5 * 1024 * 1024
CACHE_MAX_BYTES = 24 * 1024 * 1024
CACHE_MAX_ITEMS = 48
RATE_WINDOW_SECONDS = 300
RATE_MAX_REQUESTS = 50

_cache: OrderedDict[str, bytes] = OrderedDict()
_cache_bytes = 0
_calls: dict[str, deque[float]] = defaultdict(deque)
_semaphore = asyncio.Semaphore(2)


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


@router.get("/status")
async def narration_status(user=Depends(require_user)):
    return {"available": bool(_endpoint()), "provider": "kokoro", "voices": list(VOICES), "max_text_length": MAX_TEXT}


@router.post("/speech")
async def synthesize_speech(payload: SpeechRequest, user=Depends(require_user)):
    endpoint = _endpoint()
    if not endpoint:
        raise HTTPException(503, "The narrator is not connected yet. Please try again later.")
    if payload.voice not in VOICES or payload.kind not in {"story", "choice"}:
        raise HTTPException(422, "Unsupported narration option.")
    text = _normalize_text(payload.text)
    if not text:
        raise HTTPException(422, "Nothing to narrate.")
    _rate_limit(str(user.user_id))
    key = hashlib.sha256(json.dumps(["kokoro-v1", text, payload.voice, payload.speed]).encode()).hexdigest()
    audio = _cache.get(key)
    if audio is not None:
        _cache.move_to_end(key)
    else:
        async with _semaphore:
            # Check again in case another request filled the cache while waiting.
            audio = _cache.get(key)
            if audio is None:
                try:
                    audio = await asyncio.to_thread(_read_kokoro, endpoint, text, payload.voice, payload.speed)
                except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
                    raise HTTPException(502, "The narrator could not prepare this passage. Try again.") from exc
                _save_cache(key, audio)
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
