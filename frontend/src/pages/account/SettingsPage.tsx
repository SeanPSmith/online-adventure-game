import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  browserNotificationSupport,
  disableWebPush,
  enableWebPush,
  getNotificationSettings,
  readNotificationPreferences,
  requestSmsVerification,
  saveNotificationSettings,
  verifySmsCode,
  writeNotificationPreferences,
  type NotificationChannels,
  type NotificationPreferences,
} from "../../services/notifications";

const EMPTY_CHANNELS: NotificationChannels = {
  pushAvailable: false,
  emailAvailable: false,
  smsAvailable: false,
  emailAddress: "",
};

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "The notification service did not respond.";
}

export function SettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    readNotificationPreferences(),
  );
  const [channels, setChannels] = useState<NotificationChannels>(EMPTY_CHANNELS);
  const [permission, setPermission] = useState(() => browserNotificationSupport().permission);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [status, setStatus] = useState("LOADING ACCOUNT NOTIFICATION SETTINGS...");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getNotificationSettings()
      .then((settings) => {
        if (cancelled) return;
        setPreferences(settings.preferences);
        setChannels(settings.channels);
        setPhoneDraft(settings.preferences.phoneNumber);
        setStatus("");
      })
      .catch((reason) => {
        if (cancelled) return;
        setStatus(`:/ ${errorMessage(reason)}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushSupported = permission !== "unsupported" && channels.pushAvailable;
  const pushStatus = useMemo(() => {
    if (permission === "unsupported") return "NOT SUPPORTED BY THIS BROWSER";
    if (!channels.pushAvailable) return "SERVER PUSH KEY NOT AVAILABLE";
    if (permission === "denied") return "BLOCKED IN BROWSER SITE SETTINGS";
    if (preferences.push && permission === "granted") return "REAL WEB PUSH ENABLED";
    if (permission === "granted") return "PERMISSION GRANTED // DELIVERY DISABLED";
    return "READY TO REQUEST PERMISSION";
  }, [channels.pushAvailable, permission, preferences.push]);

  async function persist(next: NotificationPreferences, success = "PREFERENCES SAVED") {
    setBusy(true);
    setStatus("");
    try {
      const saved = await saveNotificationSettings(next);
      setPreferences(saved.preferences);
      setChannels(saved.channels);
      setStatus(`(^_^)/ ${success}`);
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  function updateLocalInApp(value: boolean) {
    const next = writeNotificationPreferences({ ...preferences, inApp: value });
    setPreferences(next);
    setStatus("(^_^)/ IN-APP PREFERENCE SAVED TO THIS BROWSER");
  }

  async function update<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) {
    await persist({ ...preferences, [key]: value });
  }

  async function enablePush() {
    setBusy(true);
    setStatus("REGISTERING THIS BROWSER FOR WEB PUSH...");
    try {
      const settings = await enableWebPush();
      setPreferences(settings.preferences);
      setChannels(settings.channels);
      setPermission(browserNotificationSupport().permission);
      setStatus("(^_^)/ REAL WEB PUSH ENABLED ON THIS BROWSER");
    } catch (reason) {
      setPermission(browserNotificationSupport().permission);
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const settings = await disableWebPush();
      setPreferences(settings.preferences);
      setChannels(settings.channels);
      setStatus("WEB PUSH DISABLED ON THIS BROWSER");
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendSmsCode() {
    setBusy(true);
    setStatus("SENDING SMS VERIFICATION CODE...");
    try {
      const response = await requestSmsVerification(phoneDraft);
      setStatus(`(^_^)/ ${response.message} ENTER THE 6-DIGIT CODE BELOW.`);
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifySms() {
    setBusy(true);
    setStatus("VERIFYING PHONE...");
    try {
      const settings = await verifySmsCode(verificationCode.trim());
      setPreferences(settings.preferences);
      setChannels(settings.channels);
      setPhoneDraft(settings.preferences.phoneNumber);
      setVerificationCode("");
      setStatus("(^_^)/ PHONE VERIFIED // SMS ALERTS ENABLED");
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="ACCOUNT" title="SETTINGS" />

      <Panel title="REAL-WORLD ADVENTURE NOTIFICATIONS">
        <div className="notification-settings-grid">
          <p className="muted-copy notification-settings-intro">
            In-app notices are local UI. Web Push, email, and SMS are server-delivered channels
            designed for asynchronous co-op when Tales of Two is in another tab—or completely closed.
          </p>

          <div className="notification-setting-row">
            <div>
              <strong>IN-APP ACTIVITY ALERTS</strong>
              <p>Show compact terminal notices while Tales of Two is already open.</p>
              <small>THIS SETTING APPLIES ONLY TO THIS BROWSER.</small>
            </div>
            <label className="terminal-toggle">
              <input
                type="checkbox"
                checked={preferences.inApp}
                onChange={(event) => updateLocalInApp(event.target.checked)}
              />
              <span>{preferences.inApp ? "ON" : "OFF"}</span>
            </label>
          </div>

          <div className="notification-setting-row">
            <div>
              <strong>WEB PUSH // DEVICE PING</strong>
              <p>
                Register this browser with the Tales of Two push worker. Notifications can arrive
                after you close the game page, and tapping one routes back to the relevant room.
              </p>
              <small>{pushStatus}</small>
            </div>
            <div className="button-row">
              {preferences.push ? (
                <button className="button" type="button" disabled={busy} onClick={() => void disablePush()}>
                  DISABLE PUSH
                </button>
              ) : (
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busy || !pushSupported || permission === "denied"}
                  onClick={() => void enablePush()}
                >
                  ENABLE WEB PUSH
                </button>
              )}
            </div>
          </div>

          <div className="notification-setting-row">
            <div>
              <strong>EMAIL // AMAZON SES</strong>
              <p>
                Send selected adventure events to {channels.emailAddress || "your account email"}.
              </p>
              <small>
                {channels.emailAvailable
                  ? "SES CHANNEL CONFIGURED // OPT-IN"
                  : "SES SENDER NOT CONFIGURED ON THIS ENVIRONMENT"}
              </small>
            </div>
            <label className={`terminal-toggle${channels.emailAvailable ? "" : " is-disabled"}`}>
              <input
                type="checkbox"
                checked={preferences.email}
                disabled={busy || !channels.emailAvailable}
                onChange={(event) => void update("email", event.target.checked)}
              />
              <span>{preferences.email ? "ON" : "OFF"}</span>
            </label>
          </div>

          <div className="notification-setting-row notification-sms-row">
            <div>
              <strong>SMS // AWS</strong>
              <p>
                Optional text alerts. A number must be verified before Tales of Two will send gameplay SMS.
              </p>
              <small>
                {!channels.smsAvailable
                  ? "SMS CHANNEL NOT ENABLED ON THIS ENVIRONMENT"
                  : preferences.phoneVerified
                    ? `VERIFIED // ${preferences.phoneNumber}`
                    : "ENTER E.164 FORMAT, FOR EXAMPLE +14125551212"}
              </small>
            </div>

            {preferences.phoneVerified ? (
              <label className="terminal-toggle">
                <input
                  type="checkbox"
                  checked={preferences.sms}
                  disabled={busy || !channels.smsAvailable}
                  onChange={(event) => void update("sms", event.target.checked)}
                />
                <span>{preferences.sms ? "ON" : "OFF"}</span>
              </label>
            ) : (
              <div className="notification-phone-setup">
                <div className="notification-phone-line">
                  <input
                    className="input"
                    type="tel"
                    value={phoneDraft}
                    disabled={busy || !channels.smsAvailable}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                    placeholder="+14125551212"
                    aria-label="Mobile phone number"
                  />
                  <button
                    className="button"
                    type="button"
                    disabled={busy || !channels.smsAvailable || !phoneDraft.trim()}
                    onClick={() => void sendSmsCode()}
                  >
                    SEND CODE
                  </button>
                </div>
                <div className="notification-phone-line">
                  <input
                    className="input"
                    inputMode="numeric"
                    value={verificationCode}
                    disabled={busy || !channels.smsAvailable}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-DIGIT CODE"
                    aria-label="SMS verification code"
                  />
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={busy || verificationCode.length !== 6}
                    onClick={() => void verifySms()}
                  >
                    VERIFY
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="notification-event-grid notification-event-grid-four">
            <label className="notification-event-option">
              <input
                type="checkbox"
                checked={preferences.roomInvite}
                disabled={busy}
                onChange={(event) => void update("roomInvite", event.target.checked)}
              />
              <span>
                <strong>ROOM INVITE</strong>
                <small>Another Tales of Two account directly invites you to a co-op room.</small>
              </span>
            </label>

            <label className="notification-event-option">
              <input
                type="checkbox"
                checked={preferences.partnerJoined}
                disabled={busy}
                onChange={(event) => void update("partnerJoined", event.target.checked)}
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
                disabled={busy}
                onChange={(event) => void update("partnerLocked", event.target.checked)}
              />
              <span>
                <strong>WAITING ON YOU</strong>
                <small>Your partner locks a choice and the room needs your decision.</small>
              </span>
            </label>

            <label className="notification-event-option">
              <input
                type="checkbox"
                checked={preferences.resultsReady}
                disabled={busy}
                onChange={(event) => void update("resultsReady", event.target.checked)}
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
