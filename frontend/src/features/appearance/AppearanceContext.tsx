import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../state/AuthContext";
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppearancePreferences } from "./themeContract";

type AppearanceContextValue = {
  preferences: AppearancePreferences;
  updateAppearance: (change: Partial<AppearancePreferences>) => void;
};
const Context = createContext<AppearanceContextValue | null>(null);
function storageKey(userId: string) { return `tot:appearance:v1:${userId}`; }
function safeLoad(id: string): AppearancePreferences {
  if (!id) return { ...DEFAULT_APPEARANCE };
  try { return normalizeAppearance(JSON.parse(window.localStorage.getItem(storageKey(id)) || "null")); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}
/** Appearance is local to this browser and authenticated player, NEVER gameplay or purchase authority. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const id = user?.user_id || "";
  const [preferences, setPreferences] = useState<AppearancePreferences>(() => safeLoad(id));
  useEffect(() => { setPreferences(safeLoad(id)); }, [id]);
  const value = useMemo<AppearanceContextValue>(() => ({
    preferences,
    updateAppearance: (change) => {
      if (!id) return;
      const next = normalizeAppearance({ ...preferences, ...change });
      setPreferences(next);
      try { window.localStorage.setItem(storageKey(id), JSON.stringify(next)); } catch { /* browser storage optional */ }
    },
  }), [preferences, id]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppearance() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("AppearanceProvider is required");
  return ctx;
}
