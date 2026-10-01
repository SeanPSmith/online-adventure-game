from __future__ import annotations

from dataclasses import dataclass

from app.characters.models import Character, Skill, Stat

ADVANCEMENT_STAT_CAP = 6
ADVANCEMENT_SKILL_CAP = 5


@dataclass(frozen=True)
class AdvancementAward:
    stat_points: int
    skill_points: int


def award_for_level_transition(level_before: int, level_after: int) -> AdvancementAward:
    before = max(1, int(level_before))
    after = max(before, int(level_after))
    gained_levels = range(before + 1, after + 1)
    return AdvancementAward(
        stat_points=sum(1 for level in gained_levels if level % 2 == 0),
        skill_points=sum(1 for _ in gained_levels),
    )


def apply_advancement_allocation(
    character: Character,
    *,
    stats: dict[str, int] | None = None,
    skills: dict[str, int] | None = None,
) -> dict:
    if not character.is_alive:
        raise ValueError("A fallen Hero cannot spend advancement points.")

    stat_changes = {str(k): int(v) for k, v in (stats or {}).items() if int(v) != 0}
    skill_changes = {str(k): int(v) for k, v in (skills or {}).items() if int(v) != 0}

    if any(value < 0 for value in stat_changes.values()) or any(value < 0 for value in skill_changes.values()):
        raise ValueError("Advancement points can only raise attributes.")

    stat_cost = sum(stat_changes.values())
    skill_cost = sum(skill_changes.values())
    if stat_cost > int(character.unspent_stat_points or 0):
        raise ValueError("Not enough unspent stat points.")
    if skill_cost > int(character.unspent_skill_points or 0):
        raise ValueError("Not enough unspent skill points.")

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

    for stat, amount in normalized_stats.items():
        character.set_stat(stat, character.get_stat(stat) + amount)
    for skill, amount in normalized_skills.items():
        character.set_skill(skill, character.get_skill(skill) + amount)

    character.unspent_stat_points = max(0, int(character.unspent_stat_points or 0) - stat_cost)
    character.unspent_skill_points = max(0, int(character.unspent_skill_points or 0) - skill_cost)

    event = {
        "stats": {stat.value: amount for stat, amount in normalized_stats.items()},
        "skills": {skill.value: amount for skill, amount in normalized_skills.items()},
    }
    if stat_cost or skill_cost:
        character.advancement_history.append(event)
    return event


def advancement_public_data() -> dict:
    return {
        "advancement_stat_cap": ADVANCEMENT_STAT_CAP,
        "advancement_skill_cap": ADVANCEMENT_SKILL_CAP,
        "stat_points_per_even_level": 1,
        "skill_points_per_level": 1,
    }
