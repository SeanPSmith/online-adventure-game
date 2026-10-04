import type {
  PlayerNotificationKind,
  PlayerNotificationPayload,
} from "./game";

export interface NotificationPreferences {
  inApp: boolean;
  browser: boolean;
  partnerJoined: boolean;
  partnerLocked: boolean;
  resultsReady: boolean;
}

const STORAGE_KEY = "tales-of-two:notification-preferences:v1";
export const NOTIFICATION_SETTINGS_EVENT = "tales-of-two:notification-settings-changed";

const DEFAULTS: NotificationPreferences = {
  inApp: true,
  browser: false,
  partnerJoined: true,
  partnerLocked: true,
  resultsReady: true,
};

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

export function readNotificationPreferences(): NotificationPreferences {
  const target = safeWindow();
  if (!target) return { ...DEFAULTS };

  try {
    const raw = target.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      ...DEFAULTS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeNotificationPreferences(
  preferences: NotificationPreferences,
): NotificationPreferences {
  const clean: NotificationPreferences = {
    inApp: Boolean(preferences.inApp),
    browser: Boolean(preferences.browser),
    partnerJoined: Boolean(preferences.partnerJoined),
    partnerLocked: Boolean(preferences.partnerLocked),
    resultsReady: Boolean(preferences.resultsReady),
  };

  const target = safeWindow();
  if (target) {
    target.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    target.dispatchEvent(new CustomEvent(NOTIFICATION_SETTINGS_EVENT));
  }

  return clean;
}

export function browserNotificationSupport(): {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
} {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { supported: false, permission: "unsupported" };
  }

  return {
    supported: true,
    permission: Notification.permission,
  };
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}

export function notificationKindEnabled(
  kind: PlayerNotificationKind,
  preferences: NotificationPreferences,
) {
  if (kind === "partner_joined") return preferences.partnerJoined;
  if (kind === "partner_locked" || kind === "your_turn") {
    return preferences.partnerLocked;
  }
  if (kind === "results_ready") return preferences.resultsReady;
  return true;
}

export function deliverBrowserNotification(
  payload: PlayerNotificationPayload,
  preferences = readNotificationPreferences(),
) {
  if (!preferences.browser || !notificationKindEnabled(payload.kind, preferences)) {
    return false;
  }

  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  // Do not throw system chrome on top of the game while the player is already
  // actively looking at it. The in-product notice remains available instead.
  if (!document.hidden && document.hasFocus()) return false;

  const notification = new Notification(payload.title, {
    body: payload.message,
    tag: `tales-of-two:${payload.kind}:${payload.room_code}`,
  });

  notification.onclick = () => {
    window.focus();
    if (payload.route) window.location.assign(payload.route);
    notification.close();
  };

  return true;
}
