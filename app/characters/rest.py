"""Server-owned, time-based recovery for living Heroes between adventures.

A persisted checkpoint makes reads and browser refreshes idempotent. Never use
request-supplied time, and never revive fallen or buried characters here.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import ceil

from app.characters.models import Character

REST_INTERVAL = timedelta(hours=1)
REST_FRACTION = 0.10


def recovered_hp_per_hour(max_health: int) -> int:
    return max(1, ceil(max(1, int(max_health)) * REST_FRACTION))


def _parse_utc(value: str | datetime | None, fallback: datetime) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value, str) else value
        if parsed is None:
            parsed = fallback
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return fallback.replace(tzinfo=timezone.utc) if fallback.tzinfo is None else fallback.astimezone(timezone.utc)


def apply_resting_recovery(character: Character, *, now: datetime) -> bool:
    """Mutate and return True only if the stored record needs to change.

    Recovery is calculated in whole hours, preserving fractional elapsed time.
    Eligibility (not currently in an active room) is checked by the service.
    """
    if character.hero_status not in {"active", "retired"} or not character.is_alive:
        return False
    if character.health >= character.max_health:
        return False
    if now.tzinfo is None:
        raise ValueError("Recovery requires an aware server timestamp")
    now_utc = now.astimezone(timezone.utc)
    baseline = _parse_utc(character.rest_recovered_at, character.updated_at)
    elapsed = (now_utc - baseline).total_seconds()
    hours = max(0, int(elapsed // REST_INTERVAL.total_seconds()))
    if hours < 1:
        return False
    character.health = min(character.max_health, character.health + hours * recovered_hp_per_hour(character.max_health))
    character.rest_recovered_at = (baseline + REST_INTERVAL * hours).isoformat()
    character.updated_at = now_utc
    return True
