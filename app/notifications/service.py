from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import re
import secrets
import uuid

from datetime import datetime, timedelta, timezone

from app.auth.store import auth_store
from app.notifications.store import NotificationPreferences, notification_store


PHONE_PATTERN = re.compile(r"^\+[1-9][0-9]{7,14}$")
VAPID_PRIVATE_CONFIG = "web_push_vapid_private_der"
VAPID_PUBLIC_CONFIG = "web_push_vapid_public_key"


class NotificationService:
    def __init__(self) -> None:
        self._delivery_tasks: set[asyncio.Task] = set()

    async def initialize(self) -> None:
        await notification_store.initialize()
        await self._ensure_vapid_keys()

    def queue_delivery(self, *, user_id: str, payload: dict) -> None:
        # External notification networks must never sit on the authoritative
        # turn-resolution path. Socket/UI state is emitted immediately; real
        # push/email/SMS delivery runs independently and logs its own errors.
        task = asyncio.create_task(self.deliver(user_id=user_id, payload=payload))
        self._delivery_tasks.add(task)
        task.add_done_callback(self._finish_delivery_task)

    def _finish_delivery_task(self, task: asyncio.Task) -> None:
        self._delivery_tasks.discard(task)
        try:
            task.result()
        except asyncio.CancelledError:
            pass
        except Exception as error:
            print(
                "[NOTIFICATION DELIVERY ERROR] "
                f"type={type(error).__name__} message={error}"
            )

    async def shutdown(self) -> None:
        if not self._delivery_tasks:
            return
        pending = list(self._delivery_tasks)
        for task in pending:
            if not task.done():
                task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        self._delivery_tasks.clear()

    async def _ensure_vapid_keys(self) -> None:
        existing_private = await notification_store.get_config(VAPID_PRIVATE_CONFIG)
        existing_public = await notification_store.get_config(VAPID_PUBLIC_CONFIG)
        if existing_private and existing_public:
            return

        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric import ec
        except ImportError:
            # Local source-only verification environments may not have the cloud
            # push dependency installed. The deployed backend installs pywebpush,
            # which brings cryptography with it, and will generate the key then.
            return

        private_key = ec.generate_private_key(ec.SECP256R1())
        private_der = private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_raw = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        private_encoded = base64.urlsafe_b64encode(private_der).rstrip(b"=").decode("ascii")
        public_encoded = base64.urlsafe_b64encode(public_raw).rstrip(b"=").decode("ascii")
        await notification_store.set_config(VAPID_PRIVATE_CONFIG, private_encoded)
        await notification_store.set_config(VAPID_PUBLIC_CONFIG, public_encoded)

    async def channel_status(self) -> dict:
        public_key = await notification_store.get_config(VAPID_PUBLIC_CONFIG)
        return {
            "push_available": bool(public_key),
            "email_available": bool(os.getenv("TOT_NOTIFICATION_EMAIL_FROM", "").strip()),
            "sms_available": self._env_flag("TOT_SMS_ENABLED", default=False),
            "vapid_public_key": public_key or "",
        }

    @staticmethod
    def _env_flag(name: str, default: bool = False) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.strip().lower() in {"1", "true", "yes", "on"}

    async def preferences_for(self, user_id: str) -> NotificationPreferences:
        return await notification_store.get_preferences(user_id)

    async def save_preferences(
        self,
        user_id: str,
        *,
        push_enabled: bool,
        email_enabled: bool,
        sms_enabled: bool,
        room_invite: bool,
        partner_joined: bool,
        partner_locked: bool,
        results_ready: bool,
    ) -> NotificationPreferences:
        current = await notification_store.get_preferences(user_id)
        status = await self.channel_status()

        clean = NotificationPreferences(
            push_enabled=bool(push_enabled and status["push_available"]),
            email_enabled=bool(email_enabled and status["email_available"]),
            sms_enabled=bool(
                sms_enabled
                and status["sms_available"]
                and current.phone_verified
                and current.phone_number
            ),
            phone_number=current.phone_number,
            phone_verified=current.phone_verified,
            room_invite=bool(room_invite),
            partner_joined=bool(partner_joined),
            partner_locked=bool(partner_locked),
            results_ready=bool(results_ready),
        )
        await notification_store.save_preferences(user_id, clean)
        return clean

    async def register_push_subscription(
        self,
        *,
        user_id: str,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str,
    ) -> NotificationPreferences:
        normalized_endpoint = endpoint.strip()
        if not normalized_endpoint.startswith("https://"):
            raise ValueError("Push endpoint must use HTTPS.")
        if not p256dh.strip() or not auth.strip():
            raise ValueError("Push subscription keys are incomplete.")

        subscription_id = uuid.uuid5(uuid.NAMESPACE_URL, normalized_endpoint).hex
        await notification_store.upsert_push_subscription(
            subscription_id=subscription_id,
            user_id=user_id,
            endpoint=normalized_endpoint,
            p256dh=p256dh.strip(),
            auth=auth.strip(),
            user_agent=user_agent[:500],
        )
        current = await notification_store.get_preferences(user_id)
        updated = NotificationPreferences(
            **{
                **current.public_data(),
                "push_enabled": True,
            }
        )
        await notification_store.save_preferences(user_id, updated)
        return updated

    async def unregister_push_subscription(self, user_id: str, endpoint: str) -> None:
        if endpoint.strip():
            await notification_store.delete_push_subscription(user_id, endpoint.strip())
        remaining = await notification_store.list_push_subscriptions(user_id)
        if not remaining:
            current = await notification_store.get_preferences(user_id)
            updated = NotificationPreferences(
                **{
                    **current.public_data(),
                    "push_enabled": False,
                }
            )
            await notification_store.save_preferences(user_id, updated)

    async def request_phone_verification(self, user_id: str, phone_number: str) -> None:
        status = await self.channel_status()
        if not status["sms_available"]:
            raise ValueError("SMS delivery is not configured on this environment.")

        normalized = re.sub(r"[\s().-]", "", phone_number.strip())
        if not PHONE_PATTERN.fullmatch(normalized):
            raise ValueError("Use an international phone number such as +14125551212.")

        existing = await notification_store.get_phone_verification(user_id)
        now = datetime.now(timezone.utc)
        if existing is not None:
            sent_at = datetime.fromisoformat(existing["sent_at"])
            if now - sent_at < timedelta(seconds=60):
                raise ValueError("Wait one minute before requesting another verification code.")

        code = f"{secrets.randbelow(1_000_000):06d}"
        code_hash = hashlib.sha256(f"{user_id}:{normalized}:{code}".encode("utf-8")).hexdigest()
        try:
            await self._send_sms(
                normalized,
                f"Tales of Two verification code: {code}. It expires in 10 minutes.",
                transactional=True,
            )
        except Exception as error:
            raise ValueError(
                "AWS could not send the verification text. The SMS account may still be sandboxed or this number may not be eligible yet."
            ) from error
        await notification_store.save_phone_verification(
            user_id=user_id,
            phone_number=normalized,
            code_hash=code_hash,
            expires_at=(now + timedelta(minutes=10)).isoformat(),
            sent_at=now.isoformat(),
        )

    async def verify_phone(self, user_id: str, code: str) -> NotificationPreferences:
        record = await notification_store.get_phone_verification(user_id)
        if record is None:
            raise ValueError("Request a verification code first.")

        if record["attempts"] >= 5:
            raise ValueError("Too many verification attempts. Request a new code.")

        now = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(record["expires_at"])
        if now >= expires_at:
            await notification_store.clear_phone_verification(user_id)
            raise ValueError("That verification code expired. Request a new one.")

        supplied_hash = hashlib.sha256(
            f"{user_id}:{record['phone_number']}:{code.strip()}".encode("utf-8")
        ).hexdigest()
        if not secrets.compare_digest(supplied_hash, record["code_hash"]):
            await notification_store.increment_phone_verification_attempts(user_id)
            raise ValueError("Verification code does not match.")

        current = await notification_store.get_preferences(user_id)
        updated = NotificationPreferences(
            push_enabled=current.push_enabled,
            email_enabled=current.email_enabled,
            sms_enabled=True,
            phone_number=record["phone_number"],
            phone_verified=True,
            room_invite=current.room_invite,
            partner_joined=current.partner_joined,
            partner_locked=current.partner_locked,
            results_ready=current.results_ready,
        )
        await notification_store.save_preferences(user_id, updated)
        await notification_store.clear_phone_verification(user_id)
        return updated

    async def deliver(self, *, user_id: str, payload: dict) -> dict:
        preferences = await notification_store.get_preferences(user_id)
        kind = str(payload.get("kind", ""))
        if not preferences.event_enabled(kind):
            return {"push": 0, "email": 0, "sms": 0}

        counts = {"push": 0, "email": 0, "sms": 0}
        tasks: list[tuple[str, asyncio.Task]] = []

        if preferences.push_enabled:
            tasks.append(("push", asyncio.create_task(self._send_pushes(user_id, payload))))
        if preferences.email_enabled:
            tasks.append(("email", asyncio.create_task(self._send_email(user_id, payload))))
        if preferences.sms_enabled and preferences.phone_verified and preferences.phone_number:
            tasks.append(("sms", asyncio.create_task(self._send_sms_notification(preferences.phone_number, payload))))

        for channel, task in tasks:
            try:
                counts[channel] = int(await task)
            except Exception as error:
                print(
                    "[NOTIFICATION DELIVERY ERROR] "
                    f"channel={channel} user={user_id} "
                    f"type={type(error).__name__} message={error}"
                )

        return counts

    async def _send_pushes(self, user_id: str, payload: dict) -> int:
        private_key = await notification_store.get_config(VAPID_PRIVATE_CONFIG)
        if not private_key:
            return 0

        subscriptions = await notification_store.list_push_subscriptions(user_id)
        if not subscriptions:
            return 0

        try:
            from py_vapid import Vapid
            from pywebpush import WebPushException, webpush
        except ImportError:
            return 0

        vapid = Vapid.from_der(private_key.encode("ascii"))
        contact = os.getenv("TOT_VAPID_CONTACT", "mailto:push@example.com").strip()
        if not contact.startswith(("mailto:", "https://")):
            contact = f"mailto:{contact}"

        data = json.dumps(
            {
                "title": str(payload.get("title", "TALES OF TWO")),
                "message": str(payload.get("message", "")),
                "kind": str(payload.get("kind", "activity")),
                "room_code": str(payload.get("room_code", "")),
                "route": str(payload.get("route", "/game")),
                "tag": str(payload.get("id", uuid.uuid4().hex)),
            }
        )
        delivered = 0

        for subscription in subscriptions:
            endpoint = subscription["endpoint"]
            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info={
                        "endpoint": endpoint,
                        "keys": subscription["keys"],
                    },
                    data=data,
                    vapid_private_key=vapid,
                    vapid_claims={"sub": contact},
                    ttl=300,
                    timeout=5,
                )
                delivered += 1
            except WebPushException as error:
                if getattr(error, "status_code", None) in {404, 410}:
                    await notification_store.delete_push_subscription_by_endpoint(endpoint)
                    continue
                raise

        return delivered

    async def _send_email(self, user_id: str, payload: dict) -> int:
        sender = os.getenv("TOT_NOTIFICATION_EMAIL_FROM", "").strip()
        if not sender:
            return 0
        stored_user = await auth_store.get_user_by_id(user_id)
        if stored_user is None or not stored_user.email:
            return 0

        try:
            import boto3
        except ImportError:
            return 0

        region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
        client = boto3.client("sesv2", region_name=region)
        title = str(payload.get("title", "Tales of Two"))
        message = str(payload.get("message", ""))
        route = str(payload.get("route", "/game"))
        public_base = os.getenv("TOT_PUBLIC_BASE_URL", "").rstrip("/")
        action_url = f"{public_base}{route}" if public_base else ""
        text_body = message + (f"\n\nOpen Tales of Two: {action_url}" if action_url else "")
        html_body = (
            "<div style='font-family:monospace;max-width:640px'>"
            f"<h2>{self._html_escape(title)}</h2>"
            f"<p>{self._html_escape(message)}</p>"
            + (f"<p><a href='{self._html_escape(action_url)}'>OPEN TALES OF TWO</a></p>" if action_url else "")
            + "<p style='opacity:.65'>Manage notification channels in Tales of Two Settings.</p>"
            "</div>"
        )

        def send() -> None:
            client.send_email(
                FromEmailAddress=sender,
                Destination={"ToAddresses": [stored_user.email]},
                Content={
                    "Simple": {
                        "Subject": {"Data": title, "Charset": "UTF-8"},
                        "Body": {
                            "Text": {"Data": text_body, "Charset": "UTF-8"},
                            "Html": {"Data": html_body, "Charset": "UTF-8"},
                        },
                    }
                },
            )

        await asyncio.to_thread(send)
        return 1

    async def _send_sms_notification(self, phone_number: str, payload: dict) -> int:
        message = f"Tales of Two — {payload.get('title', 'UPDATE')}: {payload.get('message', '')}"
        public_base = os.getenv("TOT_PUBLIC_BASE_URL", "").rstrip("/")
        route = str(payload.get("route", ""))
        if public_base and route:
            message += f" {public_base}{route}"
        await self._send_sms(phone_number, message[:600], transactional=True)
        return 1

    async def _send_sms(self, phone_number: str, message: str, *, transactional: bool) -> None:
        if not self._env_flag("TOT_SMS_ENABLED", default=False):
            raise ValueError("SMS delivery is not configured.")
        try:
            import boto3
        except ImportError as error:
            raise RuntimeError("boto3 is required for AWS SMS delivery.") from error

        region = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
        client = boto3.client("sns", region_name=region)
        attributes = {
            "AWS.SNS.SMS.SMSType": {
                "DataType": "String",
                "StringValue": "Transactional" if transactional else "Promotional",
            }
        }
        await asyncio.to_thread(
            client.publish,
            PhoneNumber=phone_number,
            Message=message,
            MessageAttributes=attributes,
        )

    @staticmethod
    def _html_escape(value: str) -> str:
        return (
            str(value)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#39;")
        )


notification_service = NotificationService()
