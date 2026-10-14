/** Browser playback preferences for hosted Story Time and independent SFX. */
export interface AudioPreferences {
  effectsEnabled: boolean;
  masterVolume: number;
  effectsVolume: number;
  arcadeVolume: number;
  narrationEnabled: boolean;
  storyTimeApproved: boolean;
  narrationAutoPlay: boolean;
  narrationAutoChoices: boolean;
  narrationDramaticPacing: boolean;
  narrationVoice: string;
  narrationSpeed: number;
  narrationVolume: number;
}

/** Fixed playback speeds. Never send playback rate to synthesis: one cached file serves all rates. */
export const NARRATION_PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function normalizeNarrationSpeed(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return NARRATION_PLAYBACK_SPEEDS.reduce((nearest, candidate) =>
    Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest,
  1 as number);
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
  narrationDramaticPacing: true,
  narrationVoice: "af_heart",
  narrationSpeed: 1,
  narrationVolume: 80,
};

function percent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

/** Kokoro v1.0 English voices: full model catalogue, with initial five featured. */
export const KOKORO_VOICES = [
  { value: "af_heart", label: "Heart — warm", accent: "American", gender: "Female", featured: true },
  { value: "af_bella", label: "Bella — expressive", accent: "American", gender: "Female", featured: true },
  { value: "af_sky", label: "Sky — bright", accent: "American", gender: "Female", featured: true },
  { value: "am_michael", label: "Michael — grounded", accent: "American", gender: "Male", featured: true },
  { value: "bm_george", label: "George — British", accent: "British", gender: "Male", featured: true },
  { value: "af_alloy", label: "Alloy", accent: "American", gender: "Female", featured: false },
  { value: "af_aoede", label: "Aoede", accent: "American", gender: "Female", featured: false },
  { value: "af_jessica", label: "Jessica", accent: "American", gender: "Female", featured: false },
  { value: "af_kore", label: "Kore", accent: "American", gender: "Female", featured: false },
  { value: "af_nicole", label: "Nicole", accent: "American", gender: "Female", featured: false },
  { value: "af_nova", label: "Nova", accent: "American", gender: "Female", featured: false },
  { value: "af_river", label: "River", accent: "American", gender: "Female", featured: false },
  { value: "af_sarah", label: "Sarah", accent: "American", gender: "Female", featured: false },
  { value: "am_adam", label: "Adam", accent: "American", gender: "Male", featured: false },
  { value: "am_echo", label: "Echo", accent: "American", gender: "Male", featured: false },
  { value: "am_eric", label: "Eric", accent: "American", gender: "Male", featured: false },
  { value: "am_fenrir", label: "Fenrir", accent: "American", gender: "Male", featured: false },
  { value: "am_liam", label: "Liam", accent: "American", gender: "Male", featured: false },
  { value: "am_onyx", label: "Onyx", accent: "American", gender: "Male", featured: false },
  { value: "am_puck", label: "Puck", accent: "American", gender: "Male", featured: false },
  { value: "am_santa", label: "Santa", accent: "American", gender: "Male", featured: false },
  { value: "bf_alice", label: "Alice", accent: "British", gender: "Female", featured: false },
  { value: "bf_emma", label: "Emma", accent: "British", gender: "Female", featured: false },
  { value: "bf_isabella", label: "Isabella", accent: "British", gender: "Female", featured: false },
  { value: "bf_lily", label: "Lily", accent: "British", gender: "Female", featured: false },
  { value: "bm_daniel", label: "Daniel", accent: "British", gender: "Male", featured: false },
  { value: "bm_fable", label: "Fable", accent: "British", gender: "Male", featured: false },
  { value: "bm_lewis", label: "Lewis", accent: "British", gender: "Male", featured: false },
] as const;

export function narratorVoiceLabel(id: string): string {
  return KOKORO_VOICES.find(voice => voice.value === id)?.label ?? "Heart";
}


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
    narrationDramaticPacing: value.narrationDramaticPacing !== false,
    narrationVoice: KOKORO_VOICES.some(v => v.value === value.narrationVoice) ? value.narrationVoice! : "af_heart",
    narrationSpeed: normalizeNarrationSpeed(value.narrationSpeed),
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
