/** Browser-local SFX and Kokoro narration preferences (independent toggles). */
export interface AudioPreferences {
  effectsEnabled: boolean;
  masterVolume: number;
  effectsVolume: number;
  arcadeVolume: number;
  narrationEnabled: boolean;
  storyTimeApproved: boolean;
  narrationAutoPlay: boolean;
  narrationAutoChoices: boolean;
  narrationVoice: string;
  narrationSpeed: number;
  narrationVolume: number;
}

export const AUDIO_PREFERENCES_CHANGED = "tot:audio-preferences-changed";
const KEY = "tot:audio-preferences-v1";
export const DEFAULT_AUDIO_PREFERENCES: Readonly<AudioPreferences> = {
  effectsEnabled: false,
  masterVolume: 80,
  effectsVolume: 65,
  arcadeVolume: 55,
  narrationEnabled: false,
  storyTimeApproved: false,
  narrationAutoPlay: false,
  narrationAutoChoices: false,
  narrationVoice: "af_heart",
  narrationSpeed: 1,
  narrationVolume: 80,
};

function percent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

export const KOKORO_VOICES = [
  { value: "af_heart", label: "Heart — warm" },
  { value: "af_bella", label: "Bella — expressive" },
  { value: "af_sky", label: "Sky — bright" },
  { value: "am_michael", label: "Michael — grounded" },
  { value: "bm_george", label: "George — British" },
] as const;

export function normalizeAudioPreferences(value: Partial<AudioPreferences> = {}): AudioPreferences {
  return {
    effectsEnabled: typeof value.effectsEnabled === "boolean"
      ? value.effectsEnabled : DEFAULT_AUDIO_PREFERENCES.effectsEnabled,
    masterVolume: percent(value.masterVolume, DEFAULT_AUDIO_PREFERENCES.masterVolume),
    effectsVolume: percent(value.effectsVolume, DEFAULT_AUDIO_PREFERENCES.effectsVolume),
    arcadeVolume: percent(value.arcadeVolume, DEFAULT_AUDIO_PREFERENCES.arcadeVolume),
    storyTimeApproved: value.storyTimeApproved === true,
    narrationEnabled: value.storyTimeApproved === true && value.narrationEnabled === true,
    narrationAutoPlay: typeof value.narrationAutoPlay === "boolean" ? value.narrationAutoPlay : false,
    narrationAutoChoices: typeof value.narrationAutoChoices === "boolean" ? value.narrationAutoChoices : false,
    narrationVoice: KOKORO_VOICES.some(v => v.value === value.narrationVoice) ? value.narrationVoice! : "af_heart",
    narrationSpeed: typeof value.narrationSpeed === "number" && Number.isFinite(value.narrationSpeed)
      ? Math.max(0.75, Math.min(1.5, value.narrationSpeed)) : 1,
    narrationVolume: percent(value.narrationVolume, 80),
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
