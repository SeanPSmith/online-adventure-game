import type { SceneChoice } from "../../services/game";

// Mirrors the default skill-to-stat association from app/characters/models.py.
// This is a base estimate ONLY: the server adds equipped items, effects,
// talents, and situational modifiers when the turn is actually rolled.
const SKILL_STAT: Record<string, string> = {
  athletics: "strength", acrobatics: "agility", stealth: "agility",
  investigation: "intellect", knowledge: "intellect", technology: "intellect",
  awareness: "perception", survival: "perception", persuasion: "presence",
  deception: "presence", intimidation: "presence", discipline: "willpower",
  brawl: "strength", sleight: "agility", medicine: "intellect",
  mechanics: "intellect", navigation: "perception", insight: "perception",
  performance: "presence", composure: "willpower",
};

export function baseSuccessChance(
  choice: SceneChoice,
  hero: { stats: Record<string, number>; skills?: Record<string, number> } | null,
): number | null {
  const check = choice.check;
  if (!check || !hero) return null;
  const statName = check.stat || (check.skill ? SKILL_STAT[check.skill] : undefined);
  if (!statName || typeof hero.stats?.[statName] !== "number") return null;
  let baseModifier = hero.stats[statName];
  if (check.skill) {
    const skill = hero.skills?.[check.skill];
    if (typeof skill !== "number") return null;
    baseModifier += skill;
  }
  if (!Number.isFinite(baseModifier) || !Number.isFinite(check.difficulty)) return null;
  const successes = Array.from({ length: 20 }, (_, i) => i + 1)
    .filter((die) => die === 20 || (die !== 1 && die + baseModifier >= check.difficulty)).length;
  return successes * 5;
}
