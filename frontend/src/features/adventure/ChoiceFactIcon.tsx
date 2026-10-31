/** Pass 66.69: small stroke icons for the facts printed on each choice card.
 * Purely presentational and decorative (aria-hidden): the adjacent text always carries the meaning.
 * Original geometric marks, drawn in currentColor so every Inkscape paper theme stays legible.
 */
import type { ReactElement } from "react";

export type ChoiceFactKind = "skill" | "dc" | "odds" | "reward";

const PATHS: Record<ChoiceFactKind, ReactElement> = {
  skill: <><circle cx="8" cy="5" r="2.4" /><path d="M3.2 13.5c.6-2.6 2.4-4 4.8-4s4.2 1.4 4.8 4" /></>,
  dc: <path d="M4 2.5h8M4 13.5h8M5 2.5c0 3 3 3.6 3 5.5s-3 2.5-3 5.5M11 2.5c0 3-3 3.6-3 5.5s3 2.5 3 5.5" />,
  odds: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.6" /><circle cx="8" cy="8" r=".7" fill="currentColor" /></>,
  reward: <path d="M8 1.8l1.5 4.7 4.7 1.5-4.7 1.5L8 14.2l-1.5-4.7L1.8 8l4.7-1.5z" />,
};

export function ChoiceFactIcon({ kind }: { kind: ChoiceFactKind }) {
  return <svg className="ibl-fact-icon" viewBox="0 0 16 16" width="15" height="15" fill="none"
    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{PATHS[kind]}</svg>;
}
