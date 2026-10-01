from __future__ import annotations

from dataclasses import dataclass

from app.characters.advancement import ADVANCEMENT_SKILL_CAP, ADVANCEMENT_STAT_CAP

from app.characters.models import (
    DEFAULT_SKILL_STATS,
    Skill,
    Stat,
)


# =========================================================
# CREATION RULES
# =========================================================

STAT_POINT_BUDGET = 8

SKILL_POINT_BUDGET = 6

MIN_STAT_VALUE = 0

MAX_STAT_VALUE = 3

MIN_SKILL_VALUE = 0

MAX_SKILL_VALUE = 2


# =========================================================
# DISPLAY INFORMATION
# =========================================================

STAT_LABELS: dict[
    Stat,
    str,
] = {

    Stat.STRENGTH:
        "Strength",

    Stat.AGILITY:
        "Agility",

    Stat.INTELLECT:
        "Intellect",

    Stat.PERCEPTION:
        "Perception",

    Stat.PRESENCE:
        "Presence",

    Stat.WILLPOWER:
        "Willpower",
}


SKILL_LABELS: dict[
    Skill,
    str,
] = {

    Skill.ATHLETICS:
        "Athletics",

    Skill.ACROBATICS:
        "Acrobatics",

    Skill.STEALTH:
        "Stealth",

    Skill.INVESTIGATION:
        "Investigation",

    Skill.KNOWLEDGE:
        "Knowledge",

    Skill.TECHNOLOGY:
        "Technology",

    Skill.AWARENESS:
        "Awareness",

    Skill.SURVIVAL:
        "Survival",

    Skill.PERSUASION:
        "Persuasion",

    Skill.DECEPTION:
        "Deception",

    Skill.INTIMIDATION:
        "Intimidation",

    Skill.DISCIPLINE:
        "Discipline",
}


# =========================================================
# VALIDATION RESULT
# =========================================================

@dataclass(
    frozen=True
)
class CreationValidationResult:

    stats: dict[
        Stat,
        int,
    ]

    skills: dict[
        Skill,
        int,
    ]

    stat_points_used: int

    skill_points_used: int


# =========================================================
# ERROR
# =========================================================

class CreationRulesError(
    ValueError,
):
    pass


# =========================================================
# NORMALIZATION
# =========================================================

def normalize_stats(
    supplied: dict[
        str,
        int,
    ] | None,
) -> dict[
    Stat,
    int,
]:

    supplied = (
        supplied
        or {}
    )


    known_keys = {
        stat.value
        for stat
        in Stat
    }


    unknown_keys = (
        set(
            supplied.keys()
        )
        - known_keys
    )


    if unknown_keys:

        raise CreationRulesError(
            "Unknown stat: "
            + ", ".join(
                sorted(
                    unknown_keys
                )
            )
        )


    result: dict[
        Stat,
        int,
    ] = {}


    for stat in Stat:

        raw_value = (
            supplied.get(
                stat.value,
                0,
            )
        )


        try:

            value = int(
                raw_value
            )

        except (
            TypeError,
            ValueError,
        ) as error:

            raise CreationRulesError(
                f"{STAT_LABELS[stat]} must be a whole number."
            ) from error


        if (
            value
            < MIN_STAT_VALUE
            or value
            > MAX_STAT_VALUE
        ):

            raise CreationRulesError(
                f"{STAT_LABELS[stat]} must be between "
                f"{MIN_STAT_VALUE} and {MAX_STAT_VALUE}."
            )


        result[
            stat
        ] = value


    return result


def normalize_skills(
    supplied: dict[
        str,
        int,
    ] | None,
) -> dict[
    Skill,
    int,
]:

    supplied = (
        supplied
        or {}
    )


    known_keys = {
        skill.value
        for skill
        in Skill
    }


    unknown_keys = (
        set(
            supplied.keys()
        )
        - known_keys
    )


    if unknown_keys:

        raise CreationRulesError(
            "Unknown skill: "
            + ", ".join(
                sorted(
                    unknown_keys
                )
            )
        )


    result: dict[
        Skill,
        int,
    ] = {}


    for skill in Skill:

        raw_value = (
            supplied.get(
                skill.value,
                0,
            )
        )


        try:

            value = int(
                raw_value
            )

        except (
            TypeError,
            ValueError,
        ) as error:

            raise CreationRulesError(
                f"{SKILL_LABELS[skill]} must be a whole number."
            ) from error


        if (
            value
            < MIN_SKILL_VALUE
            or value
            > MAX_SKILL_VALUE
        ):

            raise CreationRulesError(
                f"{SKILL_LABELS[skill]} must be between "
                f"{MIN_SKILL_VALUE} and {MAX_SKILL_VALUE}."
            )


        result[
            skill
        ] = value


    return result


# =========================================================
# VALIDATION
# =========================================================

def validate_creation_build(
    stats: dict[
        str,
        int,
    ] | None,
    skills: dict[
        str,
        int,
    ] | None,
) -> CreationValidationResult:

    normalized_stats = (
        normalize_stats(
            stats
        )
    )


    normalized_skills = (
        normalize_skills(
            skills
        )
    )


    stat_points_used = sum(
        normalized_stats.values()
    )


    skill_points_used = sum(
        normalized_skills.values()
    )


    if (
        stat_points_used
        != STAT_POINT_BUDGET
    ):

        raise CreationRulesError(
            f"You must spend exactly "
            f"{STAT_POINT_BUDGET} stat points. "
            f"You spent {stat_points_used}."
        )


    if (
        skill_points_used
        != SKILL_POINT_BUDGET
    ):

        raise CreationRulesError(
            f"You must spend exactly "
            f"{SKILL_POINT_BUDGET} skill points. "
            f"You spent {skill_points_used}."
        )


    return CreationValidationResult(

        stats=
            normalized_stats,

        skills=
            normalized_skills,

        stat_points_used=
            stat_points_used,

        skill_points_used=
            skill_points_used,
    )


# =========================================================
# CLIENT RULE DESCRIPTION
# =========================================================

def creation_rules_public_data(
    ) -> dict:

    return {

        "stat_point_budget":
            STAT_POINT_BUDGET,

        "skill_point_budget":
            SKILL_POINT_BUDGET,

        "stat_min":
            MIN_STAT_VALUE,

        "stat_max":
            MAX_STAT_VALUE,

        "skill_min":
            MIN_SKILL_VALUE,

        "skill_max":
            MAX_SKILL_VALUE,

        "advancement_stat_cap": ADVANCEMENT_STAT_CAP,
        "advancement_skill_cap": ADVANCEMENT_SKILL_CAP,


        "stats": [

            {
                "id":
                    stat.value,

                "label":
                    STAT_LABELS[
                        stat
                    ],
            }

            for stat
            in Stat
        ],


        "skills": [

            {
                "id":
                    skill.value,

                "label":
                    SKILL_LABELS[
                        skill
                    ],

                "stat":
                    DEFAULT_SKILL_STATS[
                        skill
                    ].value,
            }

            for skill
            in Skill
        ],
    }