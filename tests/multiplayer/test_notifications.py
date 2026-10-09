from __future__ import annotations
from tests.support import PROJECT_ROOT

import sqlite3
from pathlib import Path

from app.notifications.store import NotificationPreferences, NotificationStore


ROOT = PROJECT_ROOT


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_web_push_worker_is_real_closed_page_delivery_surface() -> None:
    worker = read("frontend/public/notification-sw.js")

    assert 'addEventListener("push"' in worker
    assert "showNotification" in worker
    assert 'addEventListener("notificationclick"' in worker
    assert "clients.openWindow" in worker
    assert "visibilityState" in worker


def test_settings_exposes_real_push_email_sms_and_event_preferences() -> None:
    page = read("frontend/src/pages/account/SettingsPage.tsx")
    service = read("frontend/src/services/notifications.ts")

    assert "ENABLE WEB PUSH" in page
    assert "EMAIL // AMAZON SES" in page
    assert "SMS // AWS" in page
    assert "ROOM INVITE" in page
    assert "WAITING ON YOU" in page
    assert 'navigator.serviceWorker.register("/notification-sw.js"' in service
    assert "registration.pushManager.subscribe" in service
    assert "/api/notifications/push-subscriptions" in service


def test_room_invites_can_target_an_existing_account_without_replacing_share_links() -> None:
    component = read("frontend/src/components/game/RoomInviteButton.tsx")
    main = read("app/main.py")
    game_types = read("frontend/src/services/game.ts")

    assert "PING ACCOUNT" in component
    assert "USERNAME OR EMAIL" in component
    assert '"send_room_invite"' in component
    assert "async def send_room_invite" in main
    assert 'kind="room_invite"' in main
    assert "get_user_by_identifier" in main
    assert "send_room_invite:" in game_types


def test_external_notifications_do_not_block_authoritative_gameplay() -> None:
    main = read("app/main.py")
    service = read("app/notifications/service.py")

    assert "notification_service.queue_delivery(" in main
    assert "asyncio.create_task(self.deliver" in service
    assert "External notification networks must never sit on the authoritative" in service


def test_aws_notification_channels_are_opt_in_and_infrastructure_gated() -> None:
    backend = read("infra/lib/backend-stack.ts")
    staging = read("infra/config/staging.ts")
    helper = read("scripts/aws/deploy-notification-infra-staging.sh")
    requirements = read("requirements-aws.txt")

    assert 'actions: ["sns:Publish"]' in backend
    assert 'actions: ["ses:SendEmail", "ses:SendRawEmail"]' in backend
    assert "TOT_SMS_ENABLED" in backend
    assert "TOT_NOTIFICATION_EMAIL_FROM" in backend
    assert "notificationSmsEnabled: true" in staging
    assert "TOT_NOTIFICATION_EMAIL_FROM" in helper
    assert "pywebpush==2.5.0" in requirements
    assert "boto3" in requirements


def test_notification_store_persists_preferences_and_push_subscriptions(tmp_path: Path) -> None:
    database = tmp_path / "notifications.sqlite3"
    connection = sqlite3.connect(database)
    connection.execute(
        """
        CREATE TABLE users (
            user_id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    connection.execute(
        "INSERT INTO users (user_id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        ("u-1", "player@example.com", "player", "hash", "2026-10-05T00:00:00+00:00"),
    )
    connection.commit()
    connection.close()

    store = NotificationStore(database)
    store._initialize_sync()
    preferences = NotificationPreferences(
        push_enabled=True,
        email_enabled=False,
        sms_enabled=False,
        room_invite=True,
        partner_joined=True,
        partner_locked=True,
        results_ready=False,
    )
    store._save_preferences_sync("u-1", preferences)
    saved = store._get_preferences_sync("u-1")

    assert saved.push_enabled is True
    assert saved.results_ready is False

    store._upsert_push_subscription_sync(
        "sub-1",
        "u-1",
        "https://push.example/subscription",
        "p256dh",
        "auth",
        "pytest",
    )
    subscriptions = store._list_push_subscriptions_sync("u-1")
    assert len(subscriptions) == 1
    assert subscriptions[0]["endpoint"] == "https://push.example/subscription"
    assert subscriptions[0]["keys"] == {"p256dh": "p256dh", "auth": "auth"}
