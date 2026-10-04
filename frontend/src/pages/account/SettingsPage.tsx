import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  browserNotificationSupport,
  readNotificationPreferences,
  requestBrowserNotificationPermission,
  writeNotificationPreferences,
  type NotificationPreferences,
} from "../../services/notifications";

export function SettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    readNotificationPreferences(),
  );
  const [permission, setPermission] = useState(() =>
    browserNotificationSupport().permission,
  );
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (permission !== "granted" && preferences.browser) {
      const next = { ...preferences, browser: false };
      setPreferences(writeNotificationPreferences(next));
    }
  }, [permission, preferences]);

  const browserSupported = permission !== "unsupported";
  const browserStatus = useMemo(() => {
    if (!browserSupported) return "NOT SUPPORTED BY THIS BROWSER";
    if (permission === "granted" && preferences.browser) return "ENABLED";
    if (permission === "granted") return "PERMISSION GRANTED // DISABLED HERE";
    if (permission === "denied") return "BLOCKED IN BROWSER SETTINGS";
    return "PERMISSION NOT REQUESTED";
  }, [browserSupported, permission, preferences.browser]);

  function update<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) {
    const next = writeNotificationPreferences({
      ...preferences,
      [key]: value,
    });
    setPreferences(next);
    setStatus("PREFERENCES SAVED");
  }

  async function enableBrowserAlerts() {
    const result = await requestBrowserNotificationPermission();
    setPermission(result);

    if (result === "granted") {
      const next = writeNotificationPreferences({
        ...preferences,
        browser: true,
      });
      setPreferences(next);
      setStatus("BACKGROUND BROWSER ALERTS ENABLED");
      return;
    }

    if (result === "denied") {
      setStatus("BROWSER ALERTS WERE BLOCKED. CHANGE SITE PERMISSIONS IN YOUR BROWSER TO ENABLE THEM.");
      return;
    }

    setStatus("THIS BROWSER DOES NOT SUPPORT BACKGROUND NOTIFICATIONS HERE.");
  }

  return (
    <>
      <PageTitle eyebrow="ACCOUNT" title="SETTINGS" />

      <Panel title="ADVENTURE NOTIFICATIONS">
        <div className="notification-settings-grid">
          <div className="notification-setting-row">
            <div>
              <strong>IN-APP ACTIVITY ALERTS</strong>
              <p>Show compact notices while Tales of Two is open.</p>
            </div>
            <label className="terminal-toggle">
              <input
                type="checkbox"
                checked={preferences.inApp}
                onChange={(event) => update("inApp", event.target.checked)}
              />
              <span>{preferences.inApp ? "ON" : "OFF"}</span>
            </label>
          </div>

          <div className="notification-setting-row">
            <div>
              <strong>BACKGROUND BROWSER ALERTS</strong>
              <p>
                Alert you when this browser/tab is in the background. This is not yet closed-app push notification delivery.
              </p>
              <small>{browserStatus}</small>
            </div>
            <div className="button-row">
              {permission === "granted" && preferences.browser ? (
                <button className="button" type="button" onClick={() => update("browser", false)}>
                  DISABLE
                </button>
              ) : (
                <button
                  className="button button-primary"
                  type="button"
                  disabled={!browserSupported || permission === "denied"}
                  onClick={() => void enableBrowserAlerts()}
                >
                  ENABLE BROWSER ALERTS
                </button>
              )}
            </div>
          </div>

          <div className="notification-event-grid">
            <label className="notification-event-option">
              <input
                type="checkbox"
                checked={preferences.partnerJoined}
                onChange={(event) => update("partnerJoined", event.target.checked)}
              />
              <span>
                <strong>PARTNER JOINED</strong>
                <small>Your invited partner enters the adventure.</small>
              </span>
            </label>

            <label className="notification-event-option">
              <input
                type="checkbox"
                checked={preferences.partnerLocked}
                onChange={(event) => update("partnerLocked", event.target.checked)}
              />
              <span>
                <strong>PARTNER LOCKED / YOUR TURN</strong>
                <small>Your partner commits a choice and the room is waiting on you.</small>
              </span>
            </label>

            <label className="notification-event-option">
              <input
                type="checkbox"
                checked={preferences.resultsReady}
                onChange={(event) => update("resultsReady", event.target.checked)}
              />
              <span>
                <strong>RESULTS READY</strong>
                <small>The dice and Story Director have finished the turn.</small>
              </span>
            </label>
          </div>

          {status ? <div className="system-notice notification-settings-status">{status}</div> : null}
        </div>
      </Panel>

      <Panel title="MORE PREFERENCES">
        <p className="muted-copy">
          Audio, accessibility, animation/reduced-motion, chat-event visibility, and additional controls can continue to live here as those systems mature.
        </p>
      </Panel>
    </>
  );
}
