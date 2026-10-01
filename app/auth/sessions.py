from __future__ import annotations

import hashlib
import secrets

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


SESSION_COOKIE_NAME = "tot_session"

SESSION_LIFETIME = timedelta(
    days=30
)

SESSION_TOKEN_BYTES = 32


@dataclass(frozen=True)
class NewSessionToken:
    plain_token: str
    token_hash: str
    created_at: datetime
    expires_at: datetime


def utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def generate_session_token(
    lifetime: timedelta = SESSION_LIFETIME,
) -> NewSessionToken:

    plain_token = secrets.token_urlsafe(
        SESSION_TOKEN_BYTES
    )

    token_hash = hash_session_token(
        plain_token
    )

    created_at = utc_now()

    expires_at = (
        created_at
        + lifetime
    )

    return NewSessionToken(
        plain_token=plain_token,
        token_hash=token_hash,
        created_at=created_at,
        expires_at=expires_at,
    )


def hash_session_token(
    plain_token: str,
) -> str:

    token_bytes = plain_token.encode(
        "utf-8"
    )

    return hashlib.sha256(
        token_bytes
    ).hexdigest()