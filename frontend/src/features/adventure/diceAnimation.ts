/**
 * DISPLAY ONLY: intermediate D20 faces while the authoritative roll resolves.
 *
 * Never use this function for gameplay, outcomes, HP, critical checks, or
 * server actions. The only actual roll is the committed TurnResult.check.roll.
 */
export function cosmeticD20Face(): number {
  return Math.floor(Math.random() * 20) + 1;
}
