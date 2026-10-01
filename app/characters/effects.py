from __future__ import annotations

from dataclasses import dataclass

from app.characters.models import Character, Skill, Stat
from app.characters.health import effect_duration_for_level


MAX_EFFECT_MODIFIER_PER_EFFECT = 2
MAX_TOTAL_EFFECT_MODIFIER = 4
TEMPORARY_EFFECT_CHECKS = 3
LASTING_EFFECT_CHECKS = 3
MAX_FINITE_EFFECT_TURNS = 3


@dataclass(frozen=True)
class AppliedEffectModifier:
    effect_id: str
    name: str
    modifier: int
    target_kind: str
    target: str
    remaining_checks: int | None
    remaining_turns: int | None

    def to_dict(self) -> dict:
        return {
            "effect_id": self.effect_id,
            "name": self.name,
            "modifier": self.modifier,
            "target_kind": self.target_kind,
            "target": self.target,
            "remaining_checks": self.remaining_checks,
            "remaining_turns": self.remaining_turns,
        }


def _safe_modifier(value) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return max(-MAX_EFFECT_MODIFIER_PER_EFFECT, min(MAX_EFFECT_MODIFIER_PER_EFFECT, parsed))


def _safe_remaining_checks(value) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return max(0, parsed)



def _safe_remaining_turns(value) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return max(0, min(MAX_FINITE_EFFECT_TURNS, parsed))

def default_remaining_checks(
    permanence: str,
    *,
    has_mechanical_modifier: bool,
    modifier_value: int = 0,
    level: int = 1,
) -> int | None:
    if not has_mechanical_modifier:
        return None
    return effect_duration_for_level(
        permanence,
        modifier_value=modifier_value,
        level=level,
        temporary_base=TEMPORARY_EFFECT_CHECKS,
        lasting_base=LASTING_EFFECT_CHECKS,
    )


def sanitize_effect_mechanics(effect: dict) -> dict:
    """Return only whitelisted, bounded mechanical fields for a persistent effect."""
    stat_modifiers: dict[str, int] = {}
    for key, value in (effect.get("stat_modifiers") or {}).items():
        try:
            normalized = Stat(str(key)).value
        except (ValueError, TypeError):
            continue
        modifier = _safe_modifier(value)
        if modifier:
            stat_modifiers[normalized] = modifier

    skill_modifiers: dict[str, int] = {}
    for key, value in (effect.get("skill_modifiers") or {}).items():
        try:
            normalized = Skill(str(key)).value
        except (ValueError, TypeError):
            continue
        modifier = _safe_modifier(value)
        if modifier:
            skill_modifiers[normalized] = modifier

    has_mechanical_modifier = bool(stat_modifiers or skill_modifiers)
    remaining_checks = _safe_remaining_checks(effect.get("remaining_checks"))
    if "remaining_checks" not in effect:
        remaining_checks = default_remaining_checks(
            str(effect.get("permanence", "temporary")),
            has_mechanical_modifier=has_mechanical_modifier,
        )

    permanence = str(effect.get("permanence", "temporary") or "temporary").strip().lower()
    remaining_turns = _safe_remaining_turns(effect.get("remaining_turns"))
    if "remaining_turns" not in effect:
        remaining_turns = None if permanence == "permanent" else MAX_FINITE_EFFECT_TURNS

    return {
        "stat_modifiers": stat_modifiers,
        "skill_modifiers": skill_modifiers,
        "remaining_checks": remaining_checks,
        "remaining_turns": remaining_turns,
    }


def effect_modifier_for_check(
    character: Character,
    *,
    stat: Stat,
    skill: Skill | None,
) -> tuple[int, list[AppliedEffectModifier]]:
    """Resolve active Hero effects that apply to this exact check.

    Skill checks may receive both a matching skill modifier and a modifier to the
    resolved underlying stat. An individual effect is counted once; if it has
    both matching targets, the stronger absolute modifier wins.
    """
    applied: list[AppliedEffectModifier] = []

    for raw_effect in character.effects:
        if not isinstance(raw_effect, dict) or raw_effect.get("active", True) is False:
            continue

        mechanics = sanitize_effect_mechanics(raw_effect)
        remaining = mechanics["remaining_checks"]
        remaining_turns = mechanics["remaining_turns"]
        if remaining == 0 or remaining_turns == 0:
            continue

        candidates: list[tuple[int, str, str]] = []
        stat_value = mechanics["stat_modifiers"].get(stat.value, 0)
        if stat_value:
            candidates.append((stat_value, "stat", stat.value))

        if skill is not None:
            skill_value = mechanics["skill_modifiers"].get(skill.value, 0)
            if skill_value:
                candidates.append((skill_value, "skill", skill.value))

        if not candidates:
            continue

        modifier, target_kind, target = max(candidates, key=lambda item: abs(item[0]))
        applied.append(
            AppliedEffectModifier(
                effect_id=str(raw_effect.get("effect_id", "")),
                name=str(raw_effect.get("name") or raw_effect.get("description") or "STATUS EFFECT"),
                modifier=modifier,
                target_kind=target_kind,
                target=target,
                remaining_checks=remaining,
                remaining_turns=remaining_turns,
            )
        )

    raw_total = sum(item.modifier for item in applied)
    total = max(-MAX_TOTAL_EFFECT_MODIFIER, min(MAX_TOTAL_EFFECT_MODIFIER, raw_total))
    return total, applied


def consume_effect_checks(character: Character, effect_ids: list[str]) -> list[dict]:
    """Consume one use from each finite effect that influenced a check.

    Returns effects that expired during this consumption.
    """
    wanted = {str(effect_id) for effect_id in effect_ids if str(effect_id)}
    if not wanted:
        return []

    expired: list[dict] = []
    for effect in character.effects:
        if not isinstance(effect, dict) or str(effect.get("effect_id", "")) not in wanted:
            continue
        if effect.get("active", True) is False:
            continue

        mechanics = sanitize_effect_mechanics(effect)
        remaining = mechanics["remaining_checks"]
        if remaining is None:
            continue

        remaining = max(0, remaining - 1)
        effect["remaining_checks"] = remaining
        if remaining == 0:
            effect["active"] = False
            expired.append(dict(effect))

    return expired


def decay_finite_effect_turns(character: Character) -> list[dict]:
    """Advance finite Hero effects by one resolved turn.

    Effects granted on the current turn should be added *after* this function is
    called so a three-turn boon survives three future resolved turns.
    """
    expired: list[dict] = []
    for effect in character.effects:
        if not isinstance(effect, dict) or effect.get("active", True) is False:
            continue
        permanence = str(effect.get("permanence", "temporary") or "temporary").strip().lower()
        if permanence == "permanent":
            effect["remaining_turns"] = None
            continue
        remaining = _safe_remaining_turns(effect.get("remaining_turns"))
        if remaining is None:
            remaining = MAX_FINITE_EFFECT_TURNS
        remaining = max(0, remaining - 1)
        effect["remaining_turns"] = remaining
        if remaining == 0:
            effect["active"] = False
            expired.append(dict(effect))
    return expired
