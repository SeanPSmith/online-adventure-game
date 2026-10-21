/** Inkbound paper and ink — one player-scoped setting shared by /game and Account. */
import { useCallback, useEffect, useState } from "react";

export type InkPaper = "chalk" | "ivory" | "cream" | "navy" | "phosphor" | "midnight";
export const INKBOUND_PAPERS: ReadonlyArray<{ id: InkPaper; name: string; description: string }> = [
  { id: "chalk", name: "White", description: "Cool white paper · graphite ink" },
  { id: "ivory", name: "Ivory", description: "Soft off-white · charcoal ink" },
  { id: "cream", name: "Cream", description: "Warm cream paper · dark espresso ink" },
  { id: "navy", name: "Midnight blue", description: "Deep blue paper · pearl ink" },
  { id: "phosphor", name: "Green phosphor", description: "Deep forest green · luminous ink" },
  { id: "midnight", name: "Midnight black", description: "Near-black paper · silver-white ink" },
];

export const INKBOUND_PAPER_EVENT = "tot:inkbound:paper-changed";
export function inkPaperStorageKey(userId: string): string {
  return `tot:inkbound:paper:${userId}`;
}

export function normalizeInkPaper(value: string | null): InkPaper | null {
  // Preserve the user's previous selection after retiring the tan parchment option.
  if (value === "parchment") return "cream";
  return INKBOUND_PAPERS.some((candidate) => candidate.id === value) ? value as InkPaper : null;
}

export function readInkboundPaper(userId: string): InkPaper {
  if (!userId || typeof window === "undefined") return "ivory";
  try { return normalizeInkPaper(window.localStorage.getItem(inkPaperStorageKey(userId))) ?? "ivory"; }
  catch { return "ivory"; }
}

export function writeInkboundPaper(userId: string, value: InkPaper): void {
  if (!userId || typeof window === "undefined") return;
  try { window.localStorage.setItem(inkPaperStorageKey(userId), value); }
  catch { /* Private browsing may disallow storage; the current page still updates. */ }
  window.dispatchEvent(new CustomEvent(INKBOUND_PAPER_EVENT, { detail: { userId, value } }));
}

export function useInkboundPaper(userId: string): [InkPaper, (next: InkPaper) => void] {
  const [paper, setPaper] = useState<InkPaper>(() => readInkboundPaper(userId));
  useEffect(() => {
    setPaper(readInkboundPaper(userId));
    if (typeof window === "undefined" || !userId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === inkPaperStorageKey(userId)) setPaper(normalizeInkPaper(event.newValue) ?? "ivory");
    };
    const onLocalChange = (event: Event) => {
      const detail = (event as CustomEvent<{userId: string; value: InkPaper}>).detail;
      if (detail?.userId === userId) setPaper(detail.value);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(INKBOUND_PAPER_EVENT, onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(INKBOUND_PAPER_EVENT, onLocalChange);
    };
  }, [userId]);
  const changePaper = useCallback((next: InkPaper) => {
    setPaper(next);
    writeInkboundPaper(userId, next);
  }, [userId]);
  return [paper, changePaper];
}
