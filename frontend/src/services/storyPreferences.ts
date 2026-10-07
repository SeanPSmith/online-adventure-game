export interface StoryDisplayPreferences {
  wordReveal: boolean;
}

const STORAGE_KEY = "tot:story-display";
const DEFAULTS: StoryDisplayPreferences = {
  wordReveal: true,
};

export function readStoryDisplayPreferences(): StoryDisplayPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<StoryDisplayPreferences>;
    return {
      wordReveal: typeof parsed.wordReveal === "boolean" ? parsed.wordReveal : DEFAULTS.wordReveal,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeStoryDisplayPreferences(
  preferences: StoryDisplayPreferences,
): StoryDisplayPreferences {
  const normalized = { wordReveal: Boolean(preferences.wordReveal) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The preference remains usable for this render even when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent("tot:story-display-changed", { detail: normalized }));
  return normalized;
}
