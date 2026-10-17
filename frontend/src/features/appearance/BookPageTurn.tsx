import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useAppearance } from "./AppearanceContext";
import "./bookPageTurn.css";

function librarySection(path: string): boolean {
  return path === "/game" || path.startsWith("/game/heroes") || path.startsWith("/game/adventures") ||
    path.startsWith("/game/chronicles") || path.startsWith("/game/graveyard") || path.startsWith("/game/rulebook") ||
    path.startsWith("/game/arcade") || path.startsWith("/account");
}
/** A 360ms decorative overlay AFTER navigation, never wrapping live game DOM.
 * All routes, focus, socket events and content loading remain unchanged.
 * Avoids a persistent 3D/WebGL scene on older computers and touch devices.
 */
export function BookPageTurn() {
  const { pathname } = useLocation();
  const { preferences } = useAppearance();
  const lastPath = useRef(pathname);
  const [sequence, setSequence] = useState(0);
  useEffect(() => {
    const from = lastPath.current;
    lastPath.current = pathname;
    if (from === pathname || !librarySection(from) || !librarySection(pathname) || preferences.reducedMotion) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setSequence((previous) => previous + 1);
  }, [pathname, preferences.reducedMotion]);
  return sequence ? <div key={sequence} className="p64-page-turn" aria-hidden="true" onAnimationEnd={(event) => {
    if (event.target === event.currentTarget) setSequence(0);
  }}><div className="p64-page-turn-sheet" /><div className="p64-page-turn-gilt" /></div> : null;
}
