/** Pure, read-only presentation of server-owned Hero effects.
 * Never award, consume, extend or modify modifiers on the client.
 */
export type RawHeroEffect = Record<string, unknown>;

const effectLabel = (value: unknown): string =>
  typeof value === "string" && value.trim() ? value.trim().replaceAll("_", " ") : "";

export function activeHeroEffects(effects: readonly RawHeroEffect[] | null | undefined): RawHeroEffect[] {
  return (effects ?? []).filter((effect) => {
    if (!effect || typeof effect !== "object" || Array.isArray(effect) || effect.active === false) return false;
    // A stale migrated record may not carry active=false, but a zero budget
    // means the backend will NOT apply the effect to a future check.
    for (const key of ["remaining_turns", "remaining_checks"] as const) {
      if (typeof effect[key] === "number" && Number.isFinite(effect[key]) && effect[key] <= 0) return false;
    }
    return true;
  });
}

export function heroEffectName(effect: RawHeroEffect): string {
  return effectLabel(effect.name) || effectLabel(effect.label) ||
    effectLabel(effect.effect_name) || effectLabel(effect.effect_id) || "Unnamed effect";
}

function mechanics(map: unknown, kind: "stat" | "skill"): string[] {
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.entries(map as Record<string, unknown>)
    .filter(([name, amount]) => Boolean(name.trim()) &&
      typeof amount === "number" && Number.isFinite(amount) && amount !== 0)
    .slice(0, 12)
    .map(([name, amount]) => {
      // The server caps individual effect modifiers at +/-2; total effects
      // are separately capped at +/-4 per check. Only display that bound.
      const bounded = Math.max(-2, Math.min(2, amount as number));
      return `${effectLabel(name).toUpperCase()} ${bounded > 0 ? "+" : ""}${bounded} · ${kind.toUpperCase()}`;
    });
}

export function heroEffectModifiers(effect: RawHeroEffect): string[] {
  return [
    ...mechanics(effect.stat_modifiers, "stat"),
    ...mechanics(effect.skill_modifiers, "skill"),
  ];
}

export function heroEffectDuration(effect: RawHeroEffect): string {
  const parts: string[] = [];
  const turns = effect.remaining_turns ?? effect.duration_turns;
  if (typeof turns === "number" && Number.isFinite(turns) && turns >= 0)
    parts.push(`${turns} ${turns === 1 ? "turn" : "turns"} left`);
  const checks = effect.remaining_checks;
  if (typeof checks === "number" && Number.isFinite(checks) && checks >= 0)
    parts.push(`${checks} ${checks === 1 ? "check" : "checks"} left`);
  if (!parts.length && effectLabel(effect.permanence).toLowerCase() === "permanent")
    parts.push("Permanent");
  return parts.join(" · ") || "Active";
}

export function heroEffectDescription(effect: RawHeroEffect): string {
  return effectLabel(effect.description).slice(0, 260);
}
