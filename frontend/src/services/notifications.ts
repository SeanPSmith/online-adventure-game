import { apiFetch } from "./api";
import type {
  PlayerNotificationKind,
} from "./game";

export interface NotificationPreferences {
  inApp: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
  phoneNumber: string;
  phoneVerified: boolean;
  roomInvite: boolean;
  partnerJoined: boolean;
  partnerLocked: boolean;
  resultsReady: boolean;
}

export interface NotificationChannels {
  pushAvailable: boolean;
  emailAvailable: boolean;
  smsAvailable: boolean;
  emailAddress: string;
}

export interface NotificationSettings {
  preferences: NotificationPreferences;
  channels: NotificationChannels;
}

interface ServerPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  phone_number: string;
  phone_verified: boolean;
  room_invite: boolean;
  partner_joined: boolean;
  partner_locked: boolean;
  results_ready: boolean;
}

interface ServerChannels {
  push_available: boolean;
  email_available: boolean;
  sms_available: boolean;
  email_address: string;
}

interface ServerSettings {
  preferences: ServerPreferences;
  channels: ServerChannels;
}

const STORAGE_KEY = "tales-of-two:notification-preferences:v2";
export const NOTIFICATION_SETTINGS_EVENT = "tales-of-two:notification-settings-changed";

const DEFAULTS: NotificationPreferences = {
  inApp: true,
  push: false,
  email: false,
  sms: false,
  phoneNumber: "",
  phoneVerified: false,
  roomInvite: true,
  partnerJoined: true,
  partnerLocked: true,
  resultsReady: false,
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
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeNotificationPreferences(
  preferences: NotificationPreferences,
): NotificationPreferences {
  const clean: NotificationPreferences = {
    inApp: Boolean(preferences.inApp),
    push: Boolean(preferences.push),
    email: Boolean(preferences.email),
    sms: Boolean(preferences.sms),
    phoneNumber: String(preferences.phoneNumber ?? ""),
    phoneVerified: Boolean(preferences.phoneVerified),
    roomInvite: Boolean(preferences.roomInvite),
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

function fromServer(payload: ServerSettings): NotificationSettings {
  const local = readNotificationPreferences();
  const preferences = writeNotificationPreferences({
    inApp: local.inApp,
    push: payload.preferences.push_enabled,
    email: payload.preferences.email_enabled,
    sms: payload.preferences.sms_enabled,
    phoneNumber: payload.preferences.phone_number,
    phoneVerified: payload.preferences.phone_verified,
    roomInvite: payload.preferences.room_invite,
    partnerJoined: payload.preferences.partner_joined,
    partnerLocked: payload.preferences.partner_locked,
    resultsReady: payload.preferences.results_ready,
  });

  return {
    preferences,
    channels: {
      pushAvailable: payload.channels.push_available,
      emailAvailable: payload.channels.email_available,
      smsAvailable: payload.channels.sms_available,
      emailAddress: payload.channels.email_address,
    },
  };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return fromServer(await apiFetch<ServerSettings>("/api/notifications/settings"));
}

export async function saveNotificationSettings(
  preferences: NotificationPreferences,
): Promise<NotificationSettings> {
  // In-app banners are intentionally a local browser preference; every real
  // delivery channel/event preference is authoritative on the account.
  writeNotificationPreferences(preferences);
  const payload = await apiFetch<ServerSettings>("/api/notifications/settings", {
    method: "PUT",
    body: JSON.stringify({
      push_enabled: preferences.push,
      email_enabled: preferences.email,
      sms_enabled: preferences.sms,
      room_invite: preferences.roomInvite,
      partner_joined: preferences.partnerJoined,
      partner_locked: preferences.partnerLocked,
      results_ready: preferences.resultsReady,
    }),
  });
  return fromServer(payload);
}

export function browserNotificationSupport(): {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
} {
  if (
    typeof window === "undefined"
    || !("Notification" in window)
    || !("serviceWorker" in navigator)
    || !("PushManager" in window)
  ) {
    return { supported: false, permission: "unsupported" };
  }
  return { supported: true, permission: Notification.permission };
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

async function notificationWorkerRegistration() {
  await navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function enableWebPush(): Promise<NotificationSettings> {
  const support = browserNotificationSupport();
  if (!support.supported) throw new Error("This browser does not support Web Push.");

  const permission = support.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked in this browser's site permissions."
        : "Notification permission was not granted.",
    );
  }

  const registration = await notificationWorkerRegistration();
  const { public_key: publicKey } = await apiFetch<{ public_key: string }>(
    "/api/notifications/vapid-public-key",
  );
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
    throw new Error("The browser returned an incomplete Push subscription.");
  }

  await apiFetch("/api/notifications/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({
      endpoint: serialized.endpoint,
      keys: serialized.keys,
    }),
  });
  return getNotificationSettings();
}

export async function disableWebPush(): Promise<NotificationSettings> {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await apiFetch("/api/notifications/push-subscriptions", {
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
  }

  return getNotificationSettings();
}

export async function requestSmsVerification(phoneNumber: string) {
  return apiFetch<{ message: string }>("/api/notifications/phone/request-code", {
    method: "POST",
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
}

export async function verifySmsCode(code: string): Promise<NotificationSettings> {
  await apiFetch("/api/notifications/phone/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return getNotificationSettings();
}

export function notificationKindEnabled(
  kind: PlayerNotificationKind,
  preferences: NotificationPreferences,
) {
  if (kind === "room_invite") return preferences.roomInvite;
  if (kind === "partner_joined") return preferences.partnerJoined;
  if (kind === "partner_locked" || kind === "your_turn") return preferences.partnerLocked;
  if (kind === "results_ready") return preferences.resultsReady;
  return true;
}
