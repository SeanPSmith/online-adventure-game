from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


# =========================================================
# STATS
# =========================================================

class Stat(str, Enum):
    STRENGTH = "strength"
    AGILITY = "agility"
    INTELLECT = "intellect"
    PERCEPTION = "perception"
    PRESENCE = "presence"
    WILLPOWER = "willpower"


# =========================================================
# SKILLS
# =========================================================

class Skill(str, Enum):
    ATHLETICS = "athletics"
    ACROBATICS = "acrobatics"
    STEALTH = "stealth"

    INVESTIGATION = "investigation"
    KNOWLEDGE = "knowledge"
    TECHNOLOGY = "technology"

    AWARENESS = "awareness"
    SURVIVAL = "survival"

    PERSUASION = "persuasion"
    DECEPTION = "deception"
    INTIMIDATION = "intimidation"

    DISCIPLINE = "discipline"


# =========================================================
# SKILL → DEFAULT STAT
# =========================================================

DEFAULT_SKILL_STATS: dict[
    Skill,
    Stat,
] = {
    Skill.ATHLETICS:
        Stat.STRENGTH,

    Skill.ACROBATICS:
        Stat.AGILITY,

    Skill.STEALTH:
        Stat.AGILITY,

    Skill.INVESTIGATION:
        Stat.INTELLECT,

    Skill.KNOWLEDGE:
        Stat.INTELLECT,

    Skill.TECHNOLOGY:
        Stat.INTELLECT,

    Skill.AWARENESS:
        Stat.PERCEPTION,

    Skill.SURVIVAL:
        Stat.PERCEPTION,

    Skill.PERSUASION:
        Stat.PRESENCE,

    Skill.DECEPTION:
        Stat.PRESENCE,

    Skill.INTIMIDATION:
        Stat.PRESENCE,

    Skill.DISCIPLINE:
        Stat.WILLPOWER,
}


# =========================================================
# CHARACTER
# =========================================================

@dataclass
class Character:

    character_id: str

    name: str

    level: int = 1

    max_health: int = 10
    health: int = 10

    stats: dict[
        Stat,
        int,
    ] = field(
        default_factory=dict
    )

    skills: dict[
        Skill,
        int,
    ] = field(
        default_factory=dict
    )

    inventory: list[str] = field(
        default_factory=list
    )


    # -----------------------------------------------------
    # INITIALIZATION
    # -----------------------------------------------------

    def __post_init__(
        self,
    ) -> None:

        for stat in Stat:

            self.stats.setdefault(
                stat,
                0,
            )

        for skill in Skill:

            self.skills.setdefault(
                skill,
                0,
            )

        self.health = max(
            0,
            min(
                self.health,
                self.max_health,
            ),
        )


    # -----------------------------------------------------
    # STAT ACCESS
    # -----------------------------------------------------

    def get_stat(
        self,
        stat: Stat,
    ) -> int:

        return int(
            self.stats.get(
                stat,
                0,
            )
        )


    def set_stat(
        self,
        stat: Stat,
        value: int,
    ) -> None:

        self.stats[
            stat
        ] = int(
            value
        )


    # -----------------------------------------------------
    # SKILL ACCESS
    # -----------------------------------------------------

    def get_skill(
        self,
        skill: Skill,
    ) -> int:

        return int(
            self.skills.get(
                skill,
                0,
            )
        )


    def set_skill(
        self,
        skill: Skill,
        value: int,
    ) -> None:

        self.skills[
            skill
        ] = int(
            value
        )


    # -----------------------------------------------------
    # HEALTH
    # -----------------------------------------------------

    @property
    def is_alive(
        self,
    ) -> bool:

        return (
            self.health > 0
        )


    def damage(
        self,
        amount: int,
    ) -> int:

        amount = max(
            0,
            int(amount),
        )

        self.health = max(
            0,
            self.health - amount,
        )

        return self.health


    def heal(
        self,
        amount: int,
    ) -> int:

        amount = max(
            0,
            int(amount),
        )

        self.health = min(
            self.max_health,
            self.health + amount,
        )

        return self.health


    # -----------------------------------------------------
    # SERIALIZATION
    # -----------------------------------------------------

    def to_dict(
        self,
    ) -> dict:

        return {
            "character_id":
                self.character_id,

            "name":
                self.name,

            "level":
                self.level,

            "max_health":
                self.max_health,

            "health":
                self.health,

            "stats": {
                stat.value:
                    value

                for (
                    stat,
                    value,
                )
                in self.stats.items()
            },

            "skills": {
                skill.value:
                    value

                for (
                    skill,
                    value,
                )
                in self.skills.items()
            },

            "inventory":
                list(
                    self.inventory
                ),
        }


    @classmethod
    def from_dict(
        cls,
        data: dict,
    ) -> "Character":

        stats = {
            Stat(key):
                int(value)

            for (
                key,
                value,
            )
            in data.get(
                "stats",
                {}
            ).items()
        }

        skills = {
            Skill(key):
                int(value)

            for (
                key,
                value,
            )
            in data.get(
                "skills",
                {}
            ).items()
        }

        return cls(
            character_id=str(
                data[
                    "character_id"
                ]
            ),

            name=str(
                data[
                    "name"
                ]
            ),

            level=int(
                data.get(
                    "level",
                    1,
                )
            ),

            max_health=int(
                data.get(
                    "max_health",
                    10,
                )
            ),

            health=int(
                data.get(
                    "health",
                    10,
                )
            ),

            stats=stats,

            skills=skills,

            inventory=list(
                data.get(
                    "inventory",
                    []
                )
            ),
        )