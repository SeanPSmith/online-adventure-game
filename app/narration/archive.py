"""Private, completed-adventure MP3 archive; never invokes or wakes Kokoro.

All S3 keys are opaque and do not contain narrator text, account IDs, or room
codes. Pending objects expire after 30 days; completed objects do not.
"""
from __future__ import annotations

import hashlib
import logging
import os


logger = logging.getLogger(__name__)


def _bucket() -> str:
    return os.getenv("KOKORO_ARCHIVE_BUCKET", "").strip()


def _prefix(history_id: str) -> str:
    return hashlib.sha256(history_id.encode("utf-8")).hexdigest()


def _key(history_id: str, clip_id: str, *, completed: bool) -> str:
    return f"{'completed' if completed else 'pending'}/{_prefix(history_id)}/{clip_id}.mp3"


def identify(scene, text: str) -> tuple[int, str] | None:
    """Only archive text that matches the server's currently revealed scene."""
    from app.narration import prefetch
    from app.narration.routes import _normalize_text
    body = str(getattr(scene, "body", "") or "")
    chunks = prefetch.split_passage(body)
    for i, chunk in enumerate(chunks):
        if _normalize_text(chunk) == text:
            return i, "story"
    position = len(chunks)
    for option, choice in enumerate(getattr(scene, "choices", []) or []):
        label = str(getattr(choice, "label", "") or "")
        for chunk in prefetch.split_passage(f"Option {option + 1}. {label}"):
            if _normalize_text(chunk) == text:
                return position, "choice"
            position += 1
    return None


def clip_id(turn_number: int, position: int, audio_key: str) -> str:
    return hashlib.sha256(f"{turn_number}:{position}:{audio_key}".encode()).hexdigest()[:40]


def save_pending(history_id: str, clip_id_value: str, audio: bytes) -> bool:
    if not _bucket():
        return False
    try:
        import boto3
        boto3.client("s3").put_object(
            Bucket=_bucket(), Key=_key(history_id, clip_id_value, completed=False),
            Body=audio, ContentType="audio/mpeg", ServerSideEncryption="AES256",
        )
        return True
    except Exception as exc:
        logger.warning("story_time_archive_pending_failed type=%s", type(exc).__name__)
        return False


def promote(store, history_id: str) -> int:
    """Idempotent: copy pending MP3, commit DB marker, then best-effort delete."""
    if not _bucket():
        return 0
    import boto3
    client = boto3.client("s3")
    promoted = 0
    for item in store._pending_audio_clips_sync(history_id):
        pending = _key(history_id, item, completed=False)
        completed = _key(history_id, item, completed=True)
        try:
            client.copy_object(
                Bucket=_bucket(), Key=completed,
                CopySource={"Bucket": _bucket(), "Key": pending},
                ServerSideEncryption="AES256", ContentType="audio/mpeg",
                MetadataDirective="REPLACE",
            )
            store._mark_audio_archived_sync(history_id, item)
            promoted += 1
            try:
                client.delete_object(Bucket=_bucket(), Key=pending)
            except Exception:
                pass  # 30-day lifecycle handles leftover pending objects.
        except Exception as exc:
            logger.warning("story_time_archive_copy_failed type=%s", type(exc).__name__)
    return promoted


def read_completed(history_id: str, clip_id_value: str, max_bytes: int) -> bytes | None:
    if not _bucket():
        return None
    try:
        import boto3
        result = boto3.client("s3").get_object(
            Bucket=_bucket(), Key=_key(history_id, clip_id_value, completed=True),
        )
        data = result["Body"].read(max_bytes + 1)
        return data if 0 < len(data) <= max_bytes else None
    except Exception:
        return None
