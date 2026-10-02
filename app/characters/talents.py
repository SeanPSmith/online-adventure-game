from __future__ import annotations

from dataclasses import dataclass

from app.characters.models import Character, Skill, Stat


@dataclass(frozen=True)
class TalentDefinition:
    talent_id: str
    label: str
    description: str
    min_level: int = 3
    stat_modifiers: dict[Stat, int] | None = None
    skill_modifiers: dict[Skill, int] | None = None

    def public_data(self) -> dict:
        return {
            "id": self.talent_id,
            "label": self.label,
            "description": self.description,
            "min_level": self.min_level,
            "stat_modifiers": {
                key.value: value
                for key, value in (self.stat_modifiers or {}).items()
            },
            "skill_modifiers": {
                key.value: value
                for key, value in (self.skill_modifiers or {}).items()
            },
        }


TALENTS: tuple[TalentDefinition, ...] = (
    TalentDefinition(
        "powerhouse",
        "Powerhouse",
        "Muscle memory and leverage. +1 to Athletics and Brawl checks.",
        skill_modifiers={Skill.ATHLETICS: 1, Skill.BRAWL: 1},
    ),
    TalentDefinition(
        "daredevil",
        "Daredevil",
        "Commit first, worry later. +1 to Acrobatics and Athletics checks.",
        skill_modifiers={Skill.ACROBATICS: 1, Skill.ATHLETICS: 1},
    ),
    TalentDefinition(
        "ghost",
        "Ghost",
        "Move quietly and leave little evidence. +1 to Stealth and Sleight checks.",
        skill_modifiers={Skill.STEALTH: 1, Skill.SLEIGHT: 1},
    ),
    TalentDefinition(
        "sleuth",
        "Sleuth",
        "Notice the detail everyone else discarded. +1 to Investigation and Insight checks.",
        skill_modifiers={Skill.INVESTIGATION: 1, Skill.INSIGHT: 1},
    ),
    TalentDefinition(
        "gearhead",
        "Gearhead",
        "Machines make more sense than people. +1 to Technology and Mechanics checks.",
        skill_modifiers={Skill.TECHNOLOGY: 1, Skill.MECHANICS: 1},
    ),
    TalentDefinition(
        "field_medic",
        "Field Medic",
        "Keep people functional when conditions are not. +1 to Medicine and Survival checks.",
        skill_modifiers={Skill.MEDICINE: 1, Skill.SURVIVAL: 1},
    ),
    TalentDefinition(
        "pathfinder",
        "Pathfinder",
        "You keep a map in your head. +1 to Navigation and Survival checks.",
        skill_modifiers={Skill.NAVIGATION: 1, Skill.SURVIVAL: 1},
    ),
    TalentDefinition(
        "watchful",
        "Watchful",
        "Your attention catches motion, tells, and inconsistencies. +1 to Awareness and Investigation checks.",
        skill_modifiers={Skill.AWARENESS: 1, Skill.INVESTIGATION: 1},
    ),
    TalentDefinition(
        "silver_tongue",
        "Silver Tongue",
        "You know how to sell the moment. +1 to Persuasion and Performance checks.",
        skill_modifiers={Skill.PERSUASION: 1, Skill.PERFORMANCE: 1},
    ),
    TalentDefinition(
        "poker_face",
        "Poker Face",
        "Pressure rarely reaches your expression. +1 to Deception and Composure checks.",
        skill_modifiers={Skill.DECEPTION: 1, Skill.COMPOSURE: 1},
    ),
    TalentDefinition(
        "hard_case",
        "Hard Case",
        "You can be difficult to frighten and harder to ignore. +1 to Intimidation and Discipline checks.",
        skill_modifiers={Skill.INTIMIDATION: 1, Skill.DISCIPLINE: 1},
    ),
    TalentDefinition(
        "lucky_break",
        "Lucky Break",
        "Chance has a strange habit of leaving you a door. +1 to Luck checks.",
        stat_modifiers={Stat.LUCK: 1},
    ),
)

TALENTS_BY_ID = {talent.talent_id: talent for talent in TALENTS}


def get_talent(talent_id: str) -> TalentDefinition | None:
    return TALENTS_BY_ID.get(str(talent_id or "").strip().lower())


def talent_modifier_for_check(
    character: Character,
    *,
    stat: Stat,
    skill: Skill | None,
) -> tuple[int, list[dict]]:
    total = 0
    applied: list[dict] = []

    for talent_id in character.talents:
        definition = get_talent(talent_id)
        if definition is None:
            continue

        modifier = int((definition.stat_modifiers or {}).get(stat, 0))
        if skill is not None:
            modifier += int((definition.skill_modifiers or {}).get(skill, 0))

        if modifier == 0:
            continue

        total += modifier
        applied.append({
            "id": definition.talent_id,
            "label": definition.label,
            "modifier": modifier,
        })

    # Permanent progression should matter, but should not let talent stacking
    # overwhelm the d20/stat/skill foundation.
    total = max(-3, min(3, total))
    return total, applied


def talent_public_data() -> list[dict]:
    return [talent.public_data() for talent in TALENTS]
