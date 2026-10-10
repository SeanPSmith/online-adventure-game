import { useEffect, useMemo, useState } from "react";
import {
  readAudioPreferences, writeAudioPreferences, AUDIO_PREFERENCES_CHANGED,
  type AudioPreferences,
} from "../../services/audioPreferences";
import { activateAudioFromGesture, playSound } from "../../services/audioDirector";
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
import {
  readStoryDisplayPreferences,
  writeStoryDisplayPreferences,
  type StoryDisplayPreferences,
} from "../../services/storyPreferences";

const EMPTY_CHANNELS: NotificationChannels = {
  pushAvailable: false,
  emailAvailable: false,
  smsAvailable: false,
  emailAddress: "",
};

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "The notification service did not respond.";
}

export function SettingsPage({ section = "all" }: { section?: "all" | "notifications" | "preferences" }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    readNotificationPreferences(),
  );
  const [channels, setChannels] = useState<NotificationChannels>(EMPTY_CHANNELS);
  const [permission, setPermission] = useState(() => browserNotificationSupport().permission);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [status, setStatus] = useState("LOADING ACCOUNT NOTIFICATION SETTINGS...");
  const [busy, setBusy] = useState(false);
  const [storyDisplay, setStoryDisplay] = useState<StoryDisplayPreferences>(() =>
    readStoryDisplayPreferences(),
  );
  const [audio, setAudio] = useState<AudioPreferences>(() => readAudioPreferences());

  useEffect(() => {
    const onChange = () => setAudio(readAudioPreferences());
    window.addEventListener(AUDIO_PREFERENCES_CHANGED, onChange);
    return () => window.removeEventListener(AUDIO_PREFERENCES_CHANGED, onChange);
  }, []);

  function setAudioPreference(next: Partial<AudioPreferences>) {
    const saved = writeAudioPreferences(next);
    setAudio(saved);
    if (saved.effectsEnabled) {
      activateAudioFromGesture();
      playSound("ui");
    }
  }

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
      {section === "all" ? <PageTitle eyebrow="ACCOUNT" title="SETTINGS" /> : null}

      {section !== "preferences" ? (
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
      ) : null}

      {section !== "notifications" ? (<>
      <Panel title="AUDIO // YOUR ADVENTURE, YOUR VOLUME">
        <div className="notification-settings-grid">
          <div className="notification-setting-row">
            <div>
              <strong>ENABLE SOUND EFFECTS</strong>
              <p>Short cues for dice, choices, reactions, chapter changes, XP, and Hero outcomes.</p>
              <small>OFF BY DEFAULT. AUDIO UNLOCKS WHEN YOU CLICK OR PRESS A KEY. THIS BROWSER ONLY.</small>
            </div>
            <label className="terminal-toggle">
              <input type="checkbox" checked={audio.effectsEnabled}
                onChange={(event) => setAudioPreference({ effectsEnabled: event.target.checked })} />
              <span>{audio.effectsEnabled ? "ON" : "OFF"}</span>
            </label>
          </div>
          {([
            ["masterVolume", "MASTER VOLUME", "Controls all effects."],
            ["effectsVolume", "STORY & DICE", "Story, QTE, dice, progression, and interface cues."],
            ["arcadeVolume", "ARCADE", "Intermission cabinet cues; game-specific audio will follow."],
          ] as const).map(([key, label, description]) => (
            <label className="audio-setting-slider" key={key}>
              <span><strong>{label}</strong><span>{audio[key]}%</span></span>
              <small>{description}</small>
              <input type="range" min={0} max={100} step={5} value={audio[key]}
                disabled={!audio.effectsEnabled}
                onChange={(event) => setAudioPreference({ ...audio, [key]: Number(event.target.value) })}
                aria-label={label} />
            </label>
          ))}
          <div className="button-row">
            <button className="button" type="button" disabled={!audio.effectsEnabled}
              onClick={() => { activateAudioFromGesture(); playSound("critical"); }}>
              TEST YOUR SOUND
            </button>
          </div>
          <p className="muted-copy">Kokoro story and choice narration will be a separate optional feature in Pass 56. No microphone or voice input is required.</p>
        </div>
      </Panel>

      <Panel title="STORY DISPLAY">
        <div className="notification-settings-grid">
          <div className="notification-setting-row">
            <div>
              <strong>WORD-BY-WORD STORY REVEAL</strong>
              <p>Fade new story prose in one word at a time instead of displaying the whole page at once.</p>
              <small>CLICK THE STORY OR USE REVEAL ALL TO SKIP. REDUCED-MOTION BROWSER SETTINGS ALWAYS WIN.</small>
            </div>
            <label className="terminal-toggle">
              <input
                type="checkbox"
                checked={storyDisplay.wordReveal}
                onChange={(event) => {
                  const next = writeStoryDisplayPreferences({ wordReveal: event.target.checked });
                  setStoryDisplay(next);
                }}
              />
              <span>{storyDisplay.wordReveal ? "ON" : "OFF"}</span>
            </label>
          </div>
        </div>
      </Panel>

      <Panel title="PRESENTATION NOTES">
        <p className="muted-copy">
          Reduced-motion browser settings always override animated story reveal. Effects are optional and never replace visual game feedback.
        </p>
      </Panel>
      </>) : null}
    </>
  );
}
