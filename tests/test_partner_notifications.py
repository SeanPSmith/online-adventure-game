from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_server_emits_account_scoped_partner_activity_notifications():
    source = (ROOT / "app" / "main.py").read_text()

    assert '"player_notification"' in source
    assert 'kind="partner_joined"' in source
    assert 'kind=("your_turn" if waiting_on_recipient else "partner_locked")' in source
    assert 'kind="results_ready"' in source
    assert 'kind="room_invite"' in source
    assert '_user_sids.get(' in source
    assert "notification_service.queue_delivery(" in source


def test_frontend_handles_notifications_globally_and_settings_are_explicit():
    socket_context = (ROOT / "frontend" / "src" / "state" / "GameSocketContext.tsx").read_text()
    settings = (ROOT / "frontend" / "src" / "pages" / "account" / "SettingsPage.tsx").read_text()
    service = (ROOT / "frontend" / "src" / "services" / "notifications.ts").read_text()
    worker = (ROOT / "frontend" / "public" / "notification-sw.js").read_text()

    assert 'socket.on("player_notification"' in socket_context
    assert 'player-notification-stack' in socket_context
    assert "ENABLE WEB PUSH" in settings
    assert "WAITING ON YOU" in settings
    assert "RESULTS READY" in settings
    assert "EMAIL // AMAZON SES" in settings
    assert "SMS // AWS" in settings
    assert "Notification.requestPermission" in service
    assert "registration.pushManager.subscribe" in service
    assert 'addEventListener("push"' in worker
    assert "showNotification" in worker
