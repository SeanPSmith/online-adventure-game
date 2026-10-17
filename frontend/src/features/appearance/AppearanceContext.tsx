import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../state/AuthContext";
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppearancePreferences } from "./themeContract";
import { findTheme, importThemeJSON, INCLUDED_IDS, parseThemePack, type ThemePack, type ThemeTarget } from "./themePacks";

type AppearanceContextValue = {
  preferences: AppearancePreferences;
  updateAppearance: (change: Partial<AppearancePreferences>) => void;
  installedThemes: readonly ThemePack[];
  libraryTheme: ThemePack | null;
  readerTheme: ThemePack | null;
  installTheme: (json: string, equip?: boolean) => ThemePack;
  equipTheme: (id: string | null, target: ThemeTarget) => void;
  removeTheme: (id: string) => void;
};
const Context = createContext<AppearanceContextValue | null>(null);
function storageKey(userId: string) { return `tot:appearance:v1:${userId}`; }
function packKey(userId: string) { return `tot:themes:v1:${userId}`; }
function safeLoad(id: string): AppearancePreferences {
  if (!id || typeof window === "undefined") return { ...DEFAULT_APPEARANCE };
  try { return normalizeAppearance(JSON.parse(window.localStorage.getItem(storageKey(id)) || "null")); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}
type LocalThemes = { packs: ThemePack[]; library: string | null; reader: string | null };
const EMPTY: LocalThemes = { packs: [], library: null, reader: null };
function safeThemes(id: string): LocalThemes {
  if (!id || typeof window === "undefined") return { ...EMPTY, packs: [] };
  try {
    const raw = window.localStorage.getItem(packKey(id));
    if (!raw || raw.length > 200_000) return { ...EMPTY, packs: [] };
    const source: unknown = JSON.parse(raw);
    if (!source || typeof source !== "object" || Array.isArray(source)) return { ...EMPTY, packs: [] };
    const input = source as Record<string, unknown>;
    const packs: ThemePack[] = [];
    for (const candidate of Array.isArray(input.packs) ? input.packs.slice(0, 24) : []) {
      try {
        const pack = parseThemePack(candidate);
        if (!INCLUDED_IDS.has(pack.id) && !packs.some((item) => item.id === pack.id)) packs.push(pack);
      } catch { /* Reject invalid saved packs. */ }
    }
    const findActive = (target: ThemeTarget) => {
      const candidate = input[target];
      const selected = typeof candidate === "string" ? findTheme(candidate, packs) : null;
      return selected?.target === target ? selected.id : null;
    };
    return { packs, library: findActive("library"), reader: findActive("reader") };
  } catch { return { ...EMPTY, packs: [] }; }
}
/** Local visual customization; never represents skin ownership, purchases, or gameplay authority. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const id = user?.user_id || "";
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => safeLoad(id));
  const [local, setLocal] = useState<LocalThemes>(() => safeThemes(id));
  useEffect(() => { setPreferences(safeLoad(id)); setLocal(safeThemes(id)); }, [id]);
  const saveLocal = (next: LocalThemes) => {
    if (!id) return;
    try {
      window.localStorage.setItem(packKey(id), JSON.stringify(next));
    } catch { throw new Error("Could not save themes in this browser. Check storage permissions or space."); }
    setLocal(next);
  };
  const value = useMemo<AppearanceContextValue>(() => ({
    preferences,
    updateAppearance: (change) => {
      if (!id) return;
      const next = normalizeAppearance({ ...preferences, ...change });
      setPreferences(next);
      try { window.localStorage.setItem(storageKey(id), JSON.stringify(next)); } catch { /* Optional local storage. */ }
    },
    installedThemes: local.packs,
    libraryTheme: (findTheme(local.library, local.packs)?.target === "library" ? findTheme(local.library, local.packs) : null),
    readerTheme: (findTheme(local.reader, local.packs)?.target === "reader" ? findTheme(local.reader, local.packs) : null),
    installTheme: (json, equip = false) => {
      if (!id) throw new Error("Sign in before installing themes.");
      const pack = importThemeJSON(json, local.packs);
      saveLocal({ ...local, packs: [...local.packs, pack], [pack.target]: equip ? pack.id : local[pack.target] });
      return pack;
    },
    equipTheme: (themeId, target) => {
      if (!id) throw new Error("Sign in to equip a theme.");
      if (themeId && findTheme(themeId, local.packs)?.target !== target) throw new Error("That theme is not available for this page type.");
      saveLocal({ ...local, [target]: themeId });
    },
    removeTheme: (themeId) => {
      if (INCLUDED_IDS.has(themeId)) throw new Error("Included themes cannot be removed.");
      saveLocal({ packs: local.packs.filter((pack) => pack.id !== themeId),
        library: local.library === themeId ? null : local.library,
        reader: local.reader === themeId ? null : local.reader });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [preferences, id, local]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppearance() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("AppearanceProvider is required");
  return ctx;
}
