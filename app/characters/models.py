from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


from app.characters.health import max_health_for_level

# =========================================================
# CORE STATS
# =========================================================

class Stat(str, Enum):

    STRENGTH = "strength"

    AGILITY = "agility"

    INTELLECT = "intellect"

    PERCEPTION = "perception"

    PRESENCE = "presence"

    WILLPOWER = "willpower"

    LUCK = "luck"


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

    BRAWL = "brawl"

    SLEIGHT = "sleight"

    MEDICINE = "medicine"

    MECHANICS = "mechanics"

    NAVIGATION = "navigation"

    INSIGHT = "insight"

    PERFORMANCE = "performance"

    COMPOSURE = "composure"


# =========================================================
# DEFAULT SKILL → STAT RELATIONSHIP
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

    Skill.BRAWL:
        Stat.STRENGTH,

    Skill.SLEIGHT:
        Stat.AGILITY,

    Skill.MEDICINE:
        Stat.INTELLECT,

    Skill.MECHANICS:
        Stat.INTELLECT,

    Skill.NAVIGATION:
        Stat.PERCEPTION,

    Skill.INSIGHT:
        Stat.PERCEPTION,

    Skill.PERFORMANCE:
        Stat.PRESENCE,

    Skill.COMPOSURE:
        Stat.WILLPOWER,
}


# =========================================================
# CHARACTER
# =========================================================

@dataclass
class Character:

    character_id: str

    owner_user_id: str

    name: str

    created_at: datetime

    updated_at: datetime

    bio: str = ""


    level: int = 1

    experience: int = 0

    unspent_stat_points: int = 0
    unspent_skill_points: int = 0
    unspent_talent_points: int = 0
    talents: list[str] = field(default_factory=list)
    progression_version: int = 2
    advancement_history: list[dict] = field(default_factory=list)


    max_health: int = 10

    health: int = 10

    death_record: dict | None = None


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

    effects: list[dict] = field(
        default_factory=list
    )

    awarded_xp_events: list[str] = field(
        default_factory=list
    )

    applied_health_events: list[str] = field(
        default_factory=list
    )


    # =====================================================
    # INITIALIZATION
    # =====================================================

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


        self.level = max(
            1,
            int(
                self.level
            ),
        )


        self.experience = max(
            0,
            int(
                self.experience
            ),
        )

        self.unspent_stat_points = max(0, int(self.unspent_stat_points or 0))
        self.unspent_skill_points = max(0, int(self.unspent_skill_points or 0))
        self.unspent_talent_points = max(0, int(self.unspent_talent_points or 0))
        self.talents = list(dict.fromkeys(str(item).strip().lower() for item in (self.talents or []) if str(item).strip()))
        self.bio = str(self.bio or "").strip()[:800]
        self.progression_version = max(1, int(self.progression_version or 1))
        self.advancement_history = [dict(item) for item in (self.advancement_history or []) if isinstance(item, dict)]


        stored_max_health = max(
            1,
            int(
                self.max_health
            ),
        )

        stored_health = max(
            0,
            min(
                int(
                    self.health
                ),
                stored_max_health,
            ),
        )

        level_health_floor = max_health_for_level(
            self.level
        )

        if level_health_floor > stored_max_health:
            health_ratio = stored_health / stored_max_health
            self.max_health = level_health_floor
            self.health = max(
                0,
                min(
                    self.max_health,
                    round(health_ratio * self.max_health),
                ),
            )
        else:
            self.max_health = stored_max_health
            self.health = stored_health

        if self.health > 0:
            self.death_record = None if self.death_record is None else dict(self.death_record)
        elif self.death_record is not None:
            self.death_record = dict(self.death_record)


    # =====================================================
    # STATS
    # =====================================================

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


    # =====================================================
    # SKILLS
    # =====================================================

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


    # =====================================================
    # HEALTH
    # =====================================================

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
            int(
                amount
            ),
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
            int(
                amount
            ),
        )


        self.health = min(
            self.max_health,
            self.health + amount,
        )


        return self.health


    # =====================================================
    # SERIALIZATION
    # =====================================================

    def to_dict(
        self,
    ) -> dict:

        return {

            "character_id":
                self.character_id,

            "owner_user_id":
                self.owner_user_id,

            "name":
                self.name,

            "bio":
                self.bio,

            "created_at":
                self.created_at.isoformat(),

            "updated_at":
                self.updated_at.isoformat(),

            "level":
                self.level,

            "experience":
                self.experience,

            "unspent_stat_points": self.unspent_stat_points,
            "unspent_skill_points": self.unspent_skill_points,
            "unspent_talent_points": self.unspent_talent_points,
            "talents": list(self.talents),
            "progression_version": self.progression_version,
            "advancement_history": [dict(item) for item in self.advancement_history],

            "max_health":
                self.max_health,

            "health":
                self.health,

            "is_alive":
                self.is_alive,

            "death_record":
                (dict(self.death_record) if isinstance(self.death_record, dict) else None),

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

            "effects": [
                dict(effect)
                for effect in self.effects
                if isinstance(effect, dict)
            ],

            "awarded_xp_events": list(
                self.awarded_xp_events
            ),

            "applied_health_events": list(
                self.applied_health_events
            ),
        }


    # =====================================================
    # DESERIALIZATION
    # =====================================================

    @classmethod
    def from_dict(
        cls,
        data: dict,
    ) -> "Character":

        stats = {

            Stat(
                key
            ):
                int(
                    value
                )

            for (
                key,
                value,
            )
            in data.get(
                "stats",
                {},
            ).items()
        }


        skills = {

            Skill(
                key
            ):
                int(
                    value
                )

            for (
                key,
                value,
            )
            in data.get(
                "skills",
                {},
            ).items()
        }


        return cls(

            character_id=
                str(
                    data[
                        "character_id"
                    ]
                ),

            owner_user_id=
                str(
                    data[
                        "owner_user_id"
                    ]
                ),

            name=
                str(
                    data[
                        "name"
                    ]
                ),

            bio=str(data.get("bio", "") or ""),

            created_at=
                datetime.fromisoformat(
                    data[
                        "created_at"
                    ]
                ),

            updated_at=
                datetime.fromisoformat(
                    data[
                        "updated_at"
                    ]
                ),

            level=
                int(
                    data.get(
                        "level",
                        1,
                    )
                ),

            experience=
                int(
                    data.get(
                        "experience",
                        0,
                    )
                ),

            unspent_stat_points=int(data.get("unspent_stat_points", 0) or 0),
            unspent_skill_points=int(data.get("unspent_skill_points", 0) or 0),
            unspent_talent_points=int(data.get("unspent_talent_points", 0) or 0),
            talents=list(data.get("talents", []) or []),
            progression_version=int(data.get("progression_version", 1) or 1),
            advancement_history=[dict(item) for item in data.get("advancement_history", []) if isinstance(item, dict)],

            max_health=
                int(
                    data.get(
                        "max_health",
                        10,
                    )
                ),

            health=
                int(
                    data.get(
                        "health",
                        10,
                    )
                ),

            death_record=(
                dict(data.get("death_record"))
                if isinstance(data.get("death_record"), dict)
                else None
            ),

            stats=
                stats,

            skills=
                skills,

            inventory=
                list(
                    data.get(
                        "inventory",
                        [],
                    )
                ),

            effects=[
                dict(effect)
                for effect in data.get(
                    "effects",
                    [],
                )
                if isinstance(effect, dict)
            ],

            awarded_xp_events=[
                str(event)
                for event in data.get(
                    "awarded_xp_events",
                    [],
                )
                if str(event).strip()
            ],

            applied_health_events=[
                str(event)
                for event in data.get(
                    "applied_health_events",
                    [],
                )
                if str(event).strip()
            ],
        )