from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_server_emits_account_scoped_partner_activity_notifications():
    source = (ROOT / "app" / "main.py").read_text()

    assert '"player_notification"' in source
    assert 'kind="partner_joined"' in source
    assert 'kind=("your_turn" if waiting_on_recipient else "partner_locked")' in source
    assert 'kind="results_ready"' in source
    assert '_user_sids.get(' in source


def test_frontend_handles_notifications_globally_and_settings_are_explicit():
    socket_context = (ROOT / "frontend" / "src" / "state" / "GameSocketContext.tsx").read_text()
    settings = (ROOT / "frontend" / "src" / "pages" / "account" / "SettingsPage.tsx").read_text()
    service = (ROOT / "frontend" / "src" / "services" / "notifications.ts").read_text()

    assert 'socket.on("player_notification"' in socket_context
    assert 'player-notification-stack' in socket_context
    assert "requestBrowserNotificationPermission" in settings
    assert "PARTNER LOCKED / YOUR TURN" in settings
    assert "RESULTS READY" in settings
    assert 'Notification.permission !== "granted"' in service
    assert "document.hidden" in service
