/** Browser-local audio preferences. Narration is a separate, future Kokoro service. */
export interface AudioPreferences {
  effectsEnabled: boolean;
  masterVolume: number;
  effectsVolume: number;
  arcadeVolume: number;
}

export const AUDIO_PREFERENCES_CHANGED = "tot:audio-preferences-changed";
const KEY = "tot:audio-preferences-v1";
export const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences> = {
  effectsEnabled: false,
  masterVolume: 80,
  effectsVolume: 65,
  arcadeVolume: 55,
};

function percent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

export function normalizeAudioPreferences(value: Partial<AudioPreferences> = {}): AudioPreferences {
  return {
    effectsEnabled: typeof value.effectsEnabled === "boolean"
      ? value.effectsEnabled : DEFAULT_AUDIO_PREFERENCES.effectsEnabled,
    masterVolume: percent(value.masterVolume, DEFAULT_AUDIO_PREFERENCES.masterVolume),
    effectsVolume: percent(value.effectsVolume, DEFAULT_AUDIO_PREFERENCES.effectsVolume),
    arcadeVolume: percent(value.arcadeVolume, DEFAULT_AUDIO_PREFERENCES.arcadeVolume),
  };
}

let volatilePreferences = normalizeAudioPreferences();

export function readAudioPreferences(): AudioPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeAudioPreferences(JSON.parse(raw) as Partial<AudioPreferences>) : { ...volatilePreferences };
  } catch {
    return { ...volatilePreferences };
  }
}

export function writeAudioPreferences(value: Partial<AudioPreferences>): AudioPreferences {
  const next = normalizeAudioPreferences({ ...readAudioPreferences(), ...value });
  volatilePreferences = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* In-memory controls still work. */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUDIO_PREFERENCES_CHANGED, { detail: next }));
  }
  return next;
}
