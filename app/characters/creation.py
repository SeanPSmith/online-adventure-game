from __future__ import annotations

from dataclasses import dataclass

from app.characters.advancement import advancement_public_data

from app.characters.models import (
    DEFAULT_SKILL_STATS,
    Skill,
    Stat,
)


# =========================================================
# CREATION RULES
# =========================================================

STAT_POINT_BUDGET = 9

SKILL_POINT_BUDGET = 8

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

    Stat.LUCK:
        "Luck",
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

    Skill.BRAWL:
        "Brawl",

    Skill.SLEIGHT:
        "Sleight",

    Skill.MEDICINE:
        "Medicine",

    Skill.MECHANICS:
        "Mechanics",

    Skill.NAVIGATION:
        "Navigation",

    Skill.INSIGHT:
        "Insight",

    Skill.PERFORMANCE:
        "Performance",

    Skill.COMPOSURE:
        "Composure",
}


STAT_DESCRIPTIONS: dict[Stat, str] = {
    Stat.STRENGTH: "Raw force, lifting, breaking, grappling, and physical drive.",
    Stat.AGILITY: "Speed, balance, coordination, reflexes, and delicate movement.",
    Stat.INTELLECT: "Reasoning, memory, technical understanding, and learned expertise.",
    Stat.PERCEPTION: "Attention, instinct, sensory detail, and reading the environment.",
    Stat.PRESENCE: "Charm, force of personality, social pressure, and performance.",
    Stat.WILLPOWER: "Nerve, discipline, emotional control, and resistance to fear or coercion.",
    Stat.LUCK: "Fortune, timing, coincidence, and improbable breaks when chance truly matters.",
}


SKILL_DESCRIPTIONS: dict[Skill, str] = {
    Skill.ATHLETICS: "Running, climbing, jumping, swimming, and sustained physical effort.",
    Skill.BRAWL: "Close physical confrontation, grappling, rough fighting, and overpowering someone.",
    Skill.ACROBATICS: "Balance, tumbling, landing, dodging, and difficult body control.",
    Skill.STEALTH: "Moving unseen, hiding, shadowing, and avoiding attention.",
    Skill.SLEIGHT: "Palming, lock manipulation, pickpocketing, and precise hand tricks.",
    Skill.INVESTIGATION: "Connecting clues, searching deliberately, reconstructing events, and deduction.",
    Skill.KNOWLEDGE: "History, culture, research, academics, trivia, and remembered facts.",
    Skill.TECHNOLOGY: "Computers, electronics, software, signals, and modern technical systems.",
    Skill.MEDICINE: "First aid, diagnosis, treatment, anatomy, and stabilizing injuries.",
    Skill.MECHANICS: "Machines, engines, tools, repair, fabrication, and physical systems.",
    Skill.AWARENESS: "Spotting danger, noticing changes, hearing movement, and immediate observation.",
    Skill.SURVIVAL: "Weather, shelter, wilderness judgment, scavenging, and enduring hostile conditions.",
    Skill.NAVIGATION: "Finding routes, reading maps, orientation, pathfinding, and spatial memory.",
    Skill.INSIGHT: "Reading motives, emotional cues, lies, tension, and what someone is not saying.",
    Skill.PERSUASION: "Reasoning with people, bargaining, inspiring, and winning cooperation.",
    Skill.DECEPTION: "Lying, bluffing, disguising intent, and maintaining a false story.",
    Skill.INTIMIDATION: "Threats, pressure, menace, and making consequences feel immediate.",
    Skill.PERFORMANCE: "Entertaining, acting, public speaking, distraction, and commanding an audience.",
    Skill.DISCIPLINE: "Focus, resisting manipulation, maintaining control, and following through under pressure.",
    Skill.COMPOSURE: "Keeping calm, concealing fear, enduring social pressure, and staying functional in chaos.",
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

        **advancement_public_data(),


        "stats": [

            {
                "id":
                    stat.value,

                "label":
                    STAT_LABELS[
                        stat
                    ],

                "description":
                    STAT_DESCRIPTIONS[stat],
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

                "description":
                    SKILL_DESCRIPTIONS[skill],
            }

            for skill
            in Skill
        ],
    }