from __future__ import annotations

import asyncio

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.database import DatabaseConnection, connect_database


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
DATABASE_PATH = DATA_DIR / "game_state.sqlite3"


DEFAULT_EVENT_PREFERENCES = {
    "room_invite": True,
    "partner_joined": True,
    "partner_locked": True,
    "results_ready": False,
}


@dataclass(frozen=True)
class NotificationPreferences:
    push_enabled: bool = False
    email_enabled: bool = False
    sms_enabled: bool = False
    phone_number: str = ""
    phone_verified: bool = False
    room_invite: bool = True
    partner_joined: bool = True
    partner_locked: bool = True
    results_ready: bool = False

    def event_enabled(self, kind: str) -> bool:
        if kind == "room_invite":
            return self.room_invite
        if kind == "partner_joined":
            return self.partner_joined
        if kind in {"partner_locked", "your_turn"}:
            return self.partner_locked
        if kind == "results_ready":
            return self.results_ready
        return True

    def public_data(self) -> dict:
        return {
            "push_enabled": self.push_enabled,
            "email_enabled": self.email_enabled,
            "sms_enabled": self.sms_enabled,
            "phone_number": self.phone_number,
            "phone_verified": self.phone_verified,
            "room_invite": self.room_invite,
            "partner_joined": self.partner_joined,
            "partner_locked": self.partner_locked,
            "results_ready": self.results_ready,
        }


class NotificationStore:
    def __init__(self, database_path: Path = DATABASE_PATH) -> None:
        self.database_path = database_path

    def _connect(self) -> DatabaseConnection:
        return connect_database(self.database_path)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize_sync)

    def _initialize_sync(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS notification_preferences (
                    user_id TEXT PRIMARY KEY,
                    push_enabled INTEGER NOT NULL DEFAULT 0,
                    email_enabled INTEGER NOT NULL DEFAULT 0,
                    sms_enabled INTEGER NOT NULL DEFAULT 0,
                    phone_number TEXT NOT NULL DEFAULT '',
                    phone_verified INTEGER NOT NULL DEFAULT 0,
                    room_invite INTEGER NOT NULL DEFAULT 1,
                    partner_joined INTEGER NOT NULL DEFAULT 1,
                    partner_locked INTEGER NOT NULL DEFAULT 1,
                    results_ready INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    subscription_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    user_agent TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
                ON push_subscriptions(user_id)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS notification_config (
                    config_key TEXT PRIMARY KEY,
                    config_value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS notification_phone_verifications (
                    user_id TEXT PRIMARY KEY,
                    phone_number TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    sent_at TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
                )
                """
            )
            connection.commit()

    async def get_preferences(self, user_id: str) -> NotificationPreferences:
        return await asyncio.to_thread(self._get_preferences_sync, user_id)

    def _get_preferences_sync(self, user_id: str) -> NotificationPreferences:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    push_enabled,
                    email_enabled,
                    sms_enabled,
                    phone_number,
                    phone_verified,
                    room_invite,
                    partner_joined,
                    partner_locked,
                    results_ready
                FROM notification_preferences
                WHERE user_id = ?
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()

        if row is None:
            return NotificationPreferences()

        return NotificationPreferences(
            push_enabled=bool(row["push_enabled"]),
            email_enabled=bool(row["email_enabled"]),
            sms_enabled=bool(row["sms_enabled"]),
            phone_number=str(row["phone_number"] or ""),
            phone_verified=bool(row["phone_verified"]),
            room_invite=bool(row["room_invite"]),
            partner_joined=bool(row["partner_joined"]),
            partner_locked=bool(row["partner_locked"]),
            results_ready=bool(row["results_ready"]),
        )

    async def save_preferences(self, user_id: str, preferences: NotificationPreferences) -> None:
        await asyncio.to_thread(self._save_preferences_sync, user_id, preferences)

    def _save_preferences_sync(self, user_id: str, preferences: NotificationPreferences) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO notification_preferences (
                    user_id,
                    push_enabled,
                    email_enabled,
                    sms_enabled,
                    phone_number,
                    phone_verified,
                    room_invite,
                    partner_joined,
                    partner_locked,
                    results_ready,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    push_enabled = excluded.push_enabled,
                    email_enabled = excluded.email_enabled,
                    sms_enabled = excluded.sms_enabled,
                    phone_number = excluded.phone_number,
                    phone_verified = excluded.phone_verified,
                    room_invite = excluded.room_invite,
                    partner_joined = excluded.partner_joined,
                    partner_locked = excluded.partner_locked,
                    results_ready = excluded.results_ready,
                    updated_at = excluded.updated_at
                """,
                (
                    user_id,
                    int(preferences.push_enabled),
                    int(preferences.email_enabled),
                    int(preferences.sms_enabled),
                    preferences.phone_number,
                    int(preferences.phone_verified),
                    int(preferences.room_invite),
                    int(preferences.partner_joined),
                    int(preferences.partner_locked),
                    int(preferences.results_ready),
                    now,
                ),
            )
            connection.commit()

    async def upsert_push_subscription(
        self,
        *,
        subscription_id: str,
        user_id: str,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str,
    ) -> None:
        await asyncio.to_thread(
            self._upsert_push_subscription_sync,
            subscription_id,
            user_id,
            endpoint,
            p256dh,
            auth,
            user_agent,
        )

    def _upsert_push_subscription_sync(
        self,
        subscription_id: str,
        user_id: str,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: str,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO push_subscriptions (
                    subscription_id,
                    user_id,
                    endpoint,
                    p256dh,
                    auth,
                    user_agent,
                    created_at,
                    last_seen_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(endpoint) DO UPDATE SET
                    subscription_id = excluded.subscription_id,
                    user_id = excluded.user_id,
                    p256dh = excluded.p256dh,
                    auth = excluded.auth,
                    user_agent = excluded.user_agent,
                    last_seen_at = excluded.last_seen_at
                """,
                (
                    subscription_id,
                    user_id,
                    endpoint,
                    p256dh,
                    auth,
                    user_agent,
                    now,
                    now,
                ),
            )
            connection.commit()

    async def list_push_subscriptions(self, user_id: str) -> list[dict]:
        return await asyncio.to_thread(self._list_push_subscriptions_sync, user_id)

    def _list_push_subscriptions_sync(self, user_id: str) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT subscription_id, endpoint, p256dh, auth, user_agent
                FROM push_subscriptions
                WHERE user_id = ?
                ORDER BY created_at ASC
                """,
                (user_id,),
            ).fetchall()

        return [
            {
                "subscription_id": str(row["subscription_id"]),
                "endpoint": str(row["endpoint"]),
                "keys": {
                    "p256dh": str(row["p256dh"]),
                    "auth": str(row["auth"]),
                },
                "user_agent": str(row["user_agent"] or ""),
            }
            for row in rows
        ]

    async def delete_push_subscription(self, user_id: str, endpoint: str) -> None:
        await asyncio.to_thread(self._delete_push_subscription_sync, user_id, endpoint)

    def _delete_push_subscription_sync(self, user_id: str, endpoint: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
                (user_id, endpoint),
            )
            connection.commit()

    async def delete_push_subscription_by_endpoint(self, endpoint: str) -> None:
        await asyncio.to_thread(self._delete_push_subscription_by_endpoint_sync, endpoint)

    def _delete_push_subscription_by_endpoint_sync(self, endpoint: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM push_subscriptions WHERE endpoint = ?",
                (endpoint,),
            )
            connection.commit()

    async def get_config(self, key: str) -> str | None:
        return await asyncio.to_thread(self._get_config_sync, key)

    def _get_config_sync(self, key: str) -> str | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT config_value FROM notification_config WHERE config_key = ? LIMIT 1",
                (key,),
            ).fetchone()
        return None if row is None else str(row["config_value"])

    async def set_config(self, key: str, value: str) -> None:
        await asyncio.to_thread(self._set_config_sync, key, value)

    def _set_config_sync(self, key: str, value: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO notification_config (config_key, config_value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(config_key) DO UPDATE SET
                    config_value = excluded.config_value,
                    updated_at = excluded.updated_at
                """,
                (key, value, now),
            )
            connection.commit()

    async def save_phone_verification(
        self,
        *,
        user_id: str,
        phone_number: str,
        code_hash: str,
        expires_at: str,
        sent_at: str,
    ) -> None:
        await asyncio.to_thread(
            self._save_phone_verification_sync,
            user_id,
            phone_number,
            code_hash,
            expires_at,
            sent_at,
        )

    def _save_phone_verification_sync(
        self,
        user_id: str,
        phone_number: str,
        code_hash: str,
        expires_at: str,
        sent_at: str,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO notification_phone_verifications (
                    user_id, phone_number, code_hash, expires_at, sent_at, attempts
                )
                VALUES (?, ?, ?, ?, ?, 0)
                ON CONFLICT(user_id) DO UPDATE SET
                    phone_number = excluded.phone_number,
                    code_hash = excluded.code_hash,
                    expires_at = excluded.expires_at,
                    sent_at = excluded.sent_at,
                    attempts = 0
                """,
                (user_id, phone_number, code_hash, expires_at, sent_at),
            )
            connection.commit()

    async def get_phone_verification(self, user_id: str) -> dict | None:
        return await asyncio.to_thread(self._get_phone_verification_sync, user_id)

    def _get_phone_verification_sync(self, user_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT phone_number, code_hash, expires_at, sent_at, attempts
                FROM notification_phone_verifications
                WHERE user_id = ?
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "phone_number": str(row["phone_number"]),
            "code_hash": str(row["code_hash"]),
            "expires_at": str(row["expires_at"]),
            "sent_at": str(row["sent_at"]),
            "attempts": int(row["attempts"] or 0),
        }

    async def increment_phone_verification_attempts(self, user_id: str) -> None:
        await asyncio.to_thread(self._increment_phone_verification_attempts_sync, user_id)

    def _increment_phone_verification_attempts_sync(self, user_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE notification_phone_verifications
                SET attempts = attempts + 1
                WHERE user_id = ?
                """,
                (user_id,),
            )
            connection.commit()

    async def clear_phone_verification(self, user_id: str) -> None:
        await asyncio.to_thread(self._clear_phone_verification_sync, user_id)

    def _clear_phone_verification_sync(self, user_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM notification_phone_verifications WHERE user_id = ?",
                (user_id,),
            )
            connection.commit()


notification_store = NotificationStore()
