"""Best-effort pre-generation of FINALIZED chapter audio for opted-in rooms.

No narration data is sent to any client by this module. The normal game
snapshot/reveal gate remains authoritative. Workers are process-local; S3 is
shared, so missing work after a deploy is simply regenerated on demand.

The GPU pilot is isolated: this code still talks to the configured narrator.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
import hashlib
import logging
import re
from contextlib import suppress

from app.narration import hosting, routes

logger = logging.getLogger(__name__)
# Match frontend splitPassage() and keep each inference below the 90s proxy
# timeout on today's slower CPU. Later streaming can reuse this chunk boundary.
CHUNK_CHARACTERS = 280
MAX_CHUNKS = 24
MAX_PENDING = 48


def split_passage(text: str, max_length: int = CHUNK_CHARACTERS) -> list[str]:
    value = re.sub(r"\*\*|__|`|^#{1,6}\s", "", text, flags=re.M)
    remaining = re.sub(r"\s+", " ", value).strip()
    parts = []
    while len(remaining) > max_length:
        at = remaining.rfind(". ", 0, max_length + 1)
        if at < max_length / 2:
            at = remaining.rfind(" ", 0, max_length + 1)
        if at < max_length / 2:
            at = max_length
        elif remaining[at:at + 2] == ". ":
            at += 1
        parts.append(remaining[:at].strip())
        remaining = remaining[at:].strip()
    if remaining:
        parts.append(remaining)
    return parts


@dataclass(frozen=True)
class Passage:
    room: str
    voice: str
    text: str


_pending: asyncio.Queue[Passage] | None = None
_worker: asyncio.Task | None = None
_scheduled: set[str] = set()


def _work_key(job: Passage) -> str:
    return hashlib.sha256(f"{job.room}\0{job.voice}\0{job.text}".encode()).hexdigest()


def schedule_committed_scene(room_code: str, scene, voice: str) -> None:
    """Do not await any AWS/inference call from the canonical gameplay path."""
    global _worker, _pending
    if not hosting.configured() or voice not in routes.VOICES:
        return
    text = str(getattr(scene, "body", "") or "").strip()
    if not text:
        return
    chunks = split_passage(text)
    if not chunks or len(chunks) > MAX_CHUNKS:
        return  # Avoid unbounded speculative work on malformed giant chapters.
    if _pending is None:
        _pending = asyncio.Queue(maxsize=MAX_PENDING)
    if _worker is None or _worker.done():
        _worker = asyncio.create_task(_run_worker(), name="story-time-prefetch")
    for chunk in chunks:
        job = Passage(room=room_code, voice=voice, text=chunk)
        identity = _work_key(job)
        if identity in _scheduled or _pending.full():
            continue
        _scheduled.add(identity)
        _pending.put_nowait(job)


async def _run_worker() -> None:
    assert _pending is not None
    queue = _pending
    while True:
        job = await queue.get()
        try:
            await _prefetch_one(job)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # The optional narrator must NEVER break Director progression.
            logger.warning("story_time_prefetch_skipped cause=%s", type(exc).__name__)
        finally:
            _scheduled.discard(_work_key(job))
            queue.task_done()
        # Offer foreground speech handlers an opportunity to acquire the shared
        # inference semaphore between background chunks.
        await asyncio.sleep(0.1)


async def _prefetch_one(job: Passage) -> None:
    # The user must still be online with a live opt-in lease when we generate.
    if not await asyncio.to_thread(hosting.has_live_room, job.room):
        return
    text = routes._normalize_text(job.text)
    if not text:
        return
    key = routes._audio_key(text, job.voice)
    if routes._cache.get(key) is not None:
        return
    if await asyncio.to_thread(routes._shared_audio, key) is not None:
        return
    endpoint = routes._endpoint()
    if not endpoint:
        return
    host = await routes._ensure_awake(wake=False)
    if host["state"] not in {"running", "legacy"}:
        return  # Room heartbeat has already requested EC2 startup.
    if not await asyncio.to_thread(hosting.healthy, endpoint):
        return
    async with routes._semaphore:
        # A foreground request may have populated the same passage while we
        # waited. No audio is transmitted to players from this worker.
        if routes._cache.get(key) is not None or await asyncio.to_thread(routes._shared_audio, key) is not None:
            return
        lease = await asyncio.to_thread(hosting.begin_generation)
        async def renew():
            while True:
                await asyncio.sleep(45)
                await asyncio.to_thread(hosting.renew_generation, lease)
        keepalive = asyncio.create_task(renew()) if lease else None
        try:
            audio = await asyncio.to_thread(routes._read_kokoro, endpoint, text, job.voice, 1.0)
            await asyncio.to_thread(routes._store_shared_audio, key, audio)
            routes._save_cache(key, audio)
        finally:
            if keepalive:
                keepalive.cancel()
                with suppress(asyncio.CancelledError):
                    await keepalive
            await asyncio.to_thread(hosting.finish_generation, lease)
