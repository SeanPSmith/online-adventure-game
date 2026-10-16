/** Fair, independent War deck and pot shuffles. No room/turn-seeded decks.
 * Only animation is client-side; War remains a recreational intermission game.
 */
export function unbiasedIndex(bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0xffffffff) {
    throw new RangeError("Invalid shuffle bound");
  }
  const range = 0x100000000;
  const limit = range - (range % bound);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const word = new Uint32Array(1);
    do { globalThis.crypto.getRandomValues(word); } while (word[0] >= limit);
    return word[0] % bound;
  }
  // Only used in test/older browser environments without Web Crypto.
  return Math.floor(Math.random() * bound);
}

export function shuffleWarCards<T>(cards: readonly T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = unbiasedIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** War occurs only on equal card values; exhausted ties resolve fairly. */
export function resolveWarWinner(playerRank: number, houseRank: number): "player" | "enemy" {
  if (playerRank > houseRank) return "player";
  if (houseRank > playerRank) return "enemy";
  return unbiasedIndex(2) === 0 ? "player" : "enemy";
}
