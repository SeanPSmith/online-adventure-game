"""Pass 66.71: email password recovery.

Security properties
  * Tokens are 256-bit random values, stored only as SHA-256 hashes, single use, 30-minute lifetime.
  * The request endpoint answers identically whether or not an account exists, and the lookup, token
    creation and email delivery run after the response is sent, so neither the body nor the response
    time reveals which identifiers are registered.
  * A per-account cooldown stops the endpoint being used to flood someone's inbox.
  * A successful reset signs the account out everywhere and retires every other outstanding token.
  * The link carries the token in the URL fragment, which browsers never send to servers or in Referer.
Email is sent through the same SES configuration the notification service uses
(TOT_NOTIFICATION_EMAIL_FROM, TOT_PUBLIC_BASE_URL). If either is missing the feature reports itself
unavailable instead of pretending to send.
"""
from __future__ import annotations

import asyncio
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from app.auth.passwords import hash_password
from app.auth.providers.base import InvalidCredentialsError
from app.auth.providers.local import local_auth_provider
from app.auth.sessions import hash_session_token
from app.auth.store import auth_store

logger = logging.getLogger(__name__)

RESET_TOKEN_BYTES = 32
RESET_LIFETIME = timedelta(minutes=30)
RESET_COOLDOWN = timedelta(seconds=60)
RESET_PATH = "/reset-password"

EmailSender = Callable[[str, str, str, str], Awaitable[None]]


def _html_escape(value: str) -> str:
    return (str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


async def send_via_ses(to_address: str, subject: str, text_body: str, html_body: str) -> None:
    import boto3  # imported lazily: only needed when a real email is sent

    sender = os.getenv("TOT_NOTIFICATION_EMAIL_FROM", "").strip()
    region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
    client = boto3.client("sesv2", region_name=region)

    def send() -> None:
        client.send_email(
            FromEmailAddress=sender,
            Destination={"ToAddresses": [to_address]},
            Content={"Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": text_body, "Charset": "UTF-8"},
                         "Html": {"Data": html_body, "Charset": "UTF-8"}},
            }},
        )

    await asyncio.to_thread(send)


class PasswordResetService:
    def __init__(self, store=auth_store, sender: EmailSender = send_via_ses, clock=None) -> None:
        self.store = store
        self.sender = sender
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    @staticmethod
    def is_available() -> bool:
        return bool(os.getenv("TOT_NOTIFICATION_EMAIL_FROM", "").strip()
                    and os.getenv("TOT_PUBLIC_BASE_URL", "").strip())

    @staticmethod
    def reset_link(token: str) -> str:
        base = os.getenv("TOT_PUBLIC_BASE_URL", "").strip().rstrip("/")
        return f"{base}{RESET_PATH}#token={token}"

    async def request_reset(self, identifier: str) -> None:
        """Never raises and never reveals whether the account exists."""

        try:
            if not self.is_available():
                logger.warning("Password reset requested but email delivery is not configured.")
                return
            user = await self.store.get_user_by_identifier(str(identifier or "").strip())
            if user is None or not user.is_active or not user.email:
                return
            now = self.clock()
            latest = await self.store.latest_password_reset_created_at(user.user_id)
            if latest and now - datetime.strptime(latest, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
                    tzinfo=timezone.utc) < RESET_COOLDOWN:
                return
            token = secrets.token_urlsafe(RESET_TOKEN_BYTES)
            await self.store.create_password_reset_token(
                user_id=user.user_id, token_hash=hash_session_token(token),
                created_at=now, expires_at=now + RESET_LIFETIME)
            link = self.reset_link(token)
            minutes = int(RESET_LIFETIME.total_seconds() // 60)
            text = (f"Someone asked to reset the password for your Quillairo account.\n\n"
                    f"Choose a new password here (the link works once and expires in {minutes} minutes):\n{link}\n\n"
                    "If this wasn't you, ignore this email. Your password has not changed.")
            html = ("<div style='font-family:Georgia,serif;max-width:560px'>"
                    "<h2>Reset your Quillairo password</h2>"
                    "<p>Someone asked to reset the password for your Quillairo account.</p>"
                    f"<p><a href='{_html_escape(link)}'>Choose a new password</a></p>"
                    f"<p>The link works once and expires in {minutes} minutes.</p>"
                    "<p style='opacity:.7'>If this wasn't you, ignore this email. Your password has not changed.</p></div>")
            await self.sender(user.email, "Reset your Quillairo password", text, html)
        except Exception:  # noqa: BLE001 - the caller must never learn anything from a failure
            logger.exception("Password reset request failed")

    async def complete_reset(self, token: str, new_password: str) -> None:
        # Validate the new password first so a typo does not spend the single-use token.
        password = local_auth_provider.validate_password(new_password)
        token_hash = hash_session_token(str(token or "").strip())
        user_id = await self.store.consume_password_reset_token(token_hash=token_hash, now=self.clock())
        if user_id is None:
            raise InvalidCredentialsError("This reset link is invalid or has expired. Request a new one.")
        user = await self.store.get_user_by_id(user_id)
        if user is None or not user.is_active:
            raise InvalidCredentialsError("This reset link is invalid or has expired. Request a new one.")
        await self.store.update_password_hash(user_id, hash_password(password))
        await self.store.delete_user_password_reset_tokens(user_id)
        await self.store.delete_user_sessions(user_id)


password_reset_service = PasswordResetService()
