import type { TurnResolvedPayload } from "../../services/game";

/** One server roll has one identity, even while the Director is writing the next scene. */
export function resolvedTurnNumber(receipt: TurnResolvedPayload): number {
  return Number(receipt.resolved_turn_number ?? receipt.turn_number ?? 0);
}

export function receiptKey(receipt: TurnResolvedPayload | null): string {
  if (!receipt) return "";
  const turn = resolvedTurnNumber(receipt);
  return turn > 0 ? `${receipt.room_code}:${turn}` : "";
}

/** A final commit enriches an early receipt; it never replaces or rerolls its checks. */
export function mergeTurnReceipt(
  first: TurnResolvedPayload,
  update: TurnResolvedPayload,
): TurnResolvedPayload {
  if (receiptKey(first) !== receiptKey(update)) return first;
  const firstResults = first.results ?? [];
  const newerResults = update.results ?? [];
  return {
    ...first,
    ...update,
    // Keep the original, already displayed authoritative rolls and player choices.
    results: firstResults.length ? firstResults : newerResults,
    preliminary: Boolean(first.preliminary && update.preliminary),
  };
}

/** Prefer the latest resolved turn, then its committed (non-preliminary) receipt. */
export function latestTurnReceipt(
  roomCode: string,
  gameTurn: number,
  pending: boolean,
  candidates: Array<TurnResolvedPayload | null | undefined>,
): TurnResolvedPayload | null {
  const current = candidates.filter((item): item is TurnResolvedPayload => Boolean(
    item && item.room_code === roomCode && receiptKey(item),
  )).filter((item) => {
    const turn = resolvedTurnNumber(item);
    return turn <= gameTurn && turn >= gameTurn - 1 && (!pending || turn === gameTurn);
  });
  current.sort((a, b) => resolvedTurnNumber(b) - resolvedTurnNumber(a)
    || Number(Boolean(a.preliminary)) - Number(Boolean(b.preliminary)));
  return current[0] ?? null;
}
