from __future__ import annotations

from dataclasses import dataclass

from app.characters.models import Character, Skill, Stat
from app.characters.talents import get_talent, talent_public_data

ADVANCEMENT_STAT_CAP = 7
ADVANCEMENT_SKILL_CAP = 6
SKILL_POINTS_PER_LEVEL = 2
TALENT_POINTS_START_LEVEL = 3
TALENT_POINT_INTERVAL = 2
CURRENT_PROGRESSION_VERSION = 2


@dataclass(frozen=True)
class AdvancementAward:
    stat_points: int
    skill_points: int
    talent_points: int


def _talent_point_level(level: int) -> bool:
    return level >= TALENT_POINTS_START_LEVEL and (
        (level - TALENT_POINTS_START_LEVEL) % TALENT_POINT_INTERVAL == 0
    )


def award_for_level_transition(level_before: int, level_after: int) -> AdvancementAward:
    before = max(1, int(level_before))
    after = max(before, int(level_after))
    gained_levels = list(range(before + 1, after + 1))
    return AdvancementAward(
        stat_points=sum(1 for level in gained_levels if level % 2 == 0),
        skill_points=len(gained_levels) * SKILL_POINTS_PER_LEVEL,
        talent_points=sum(1 for level in gained_levels if _talent_point_level(level)),
    )


def migrate_progression(character: Character) -> bool:
    """Upgrade old Hero records without changing their existing stats/skills.

    Version 1 already awarded one skill point per level. Version 2 awards two,
    so old Heroes receive only the missing extra skill point for each level
    already reached plus any Talent Points their level would have earned.
    """
    version = max(1, int(getattr(character, "progression_version", 1) or 1))
    if version >= CURRENT_PROGRESSION_VERSION:
        return False

    completed_level_gains = max(0, int(character.level or 1) - 1)
    character.unspent_skill_points += completed_level_gains
    character.unspent_talent_points += sum(
        1
        for level in range(2, int(character.level or 1) + 1)
        if _talent_point_level(level)
    )
    character.progression_version = CURRENT_PROGRESSION_VERSION
    character.advancement_history.append({
        "system": "progression_v2_migration",
        "skill_points": completed_level_gains,
        "talent_points": sum(
            1
            for level in range(2, int(character.level or 1) + 1)
            if _talent_point_level(level)
        ),
    })
    return True


def apply_advancement_allocation(
    character: Character,
    *,
    stats: dict[str, int] | None = None,
    skills: dict[str, int] | None = None,
    talents: list[str] | None = None,
) -> dict:
    if not character.is_alive:
        raise ValueError("A fallen Hero cannot spend advancement points.")

    stat_changes = {str(k): int(v) for k, v in (stats or {}).items() if int(v) != 0}
    skill_changes = {str(k): int(v) for k, v in (skills or {}).items() if int(v) != 0}
    talent_choices = list(dict.fromkeys(
        str(item or "").strip().lower()
        for item in (talents or [])
        if str(item or "").strip()
    ))

    if any(value < 0 for value in stat_changes.values()) or any(value < 0 for value in skill_changes.values()):
        raise ValueError("Advancement points can only raise attributes.")

    stat_cost = sum(stat_changes.values())
    skill_cost = sum(skill_changes.values())
    talent_cost = len(talent_choices)

    if stat_cost > int(character.unspent_stat_points or 0):
        raise ValueError("Not enough unspent attribute points.")
    if skill_cost > int(character.unspent_skill_points or 0):
        raise ValueError("Not enough unspent skill points.")
    if talent_cost > int(character.unspent_talent_points or 0):
        raise ValueError("Not enough unspent talent points.")

    normalized_stats: dict[Stat, int] = {}
    for key, amount in stat_changes.items():
        try:
            stat = Stat(key)
        except ValueError as error:
            raise ValueError(f"Unknown stat: {key}") from error
        next_value = character.get_stat(stat) + amount
        if next_value > ADVANCEMENT_STAT_CAP:
            raise ValueError(f"{stat.value} cannot exceed {ADVANCEMENT_STAT_CAP}.")
        normalized_stats[stat] = amount

    normalized_skills: dict[Skill, int] = {}
    for key, amount in skill_changes.items():
        try:
            skill = Skill(key)
        except ValueError as error:
            raise ValueError(f"Unknown skill: {key}") from error
        next_value = character.get_skill(skill) + amount
        if next_value > ADVANCEMENT_SKILL_CAP:
            raise ValueError(f"{skill.value} cannot exceed {ADVANCEMENT_SKILL_CAP}.")
        normalized_skills[skill] = amount

    existing_talents = set(character.talents)
    normalized_talents: list[str] = []
    for talent_id in talent_choices:
        definition = get_talent(talent_id)
        if definition is None:
            raise ValueError(f"Unknown talent: {talent_id}")
        if talent_id in existing_talents:
            raise ValueError(f"{definition.label} is already known.")
        if int(character.level or 1) < definition.min_level:
            raise ValueError(f"{definition.label} requires level {definition.min_level}.")
        existing_talents.add(talent_id)
        normalized_talents.append(talent_id)

    for stat, amount in normalized_stats.items():
        character.set_stat(stat, character.get_stat(stat) + amount)
    for skill, amount in normalized_skills.items():
        character.set_skill(skill, character.get_skill(skill) + amount)
    character.talents.extend(normalized_talents)

    character.unspent_stat_points = max(0, int(character.unspent_stat_points or 0) - stat_cost)
    character.unspent_skill_points = max(0, int(character.unspent_skill_points or 0) - skill_cost)
    character.unspent_talent_points = max(0, int(character.unspent_talent_points or 0) - talent_cost)

    event = {
        "stats": {stat.value: amount for stat, amount in normalized_stats.items()},
        "skills": {skill.value: amount for skill, amount in normalized_skills.items()},
        "talents": list(normalized_talents),
    }
    if stat_cost or skill_cost or talent_cost:
        character.advancement_history.append(event)
    return event


def advancement_public_data() -> dict:
    return {
        "advancement_stat_cap": ADVANCEMENT_STAT_CAP,
        "advancement_skill_cap": ADVANCEMENT_SKILL_CAP,
        "stat_points_per_even_level": 1,
        "skill_points_per_level": SKILL_POINTS_PER_LEVEL,
        "talent_points_start_level": TALENT_POINTS_START_LEVEL,
        "talent_point_interval": TALENT_POINT_INTERVAL,
        "talents": talent_public_data(),
    }
