from __future__ import annotations

from dataclasses import (
    dataclass,
    field,
)

from typing import (
    Any,
)

from app.characters.models import (
    Skill,
    Stat,
)

from app.characters.progression import (
    choice_xp_reward,
)

from app.game.check_engine import (
    CheckModifiers,
    CheckRequest,
)


# =========================================================
# FLAG CONDITIONS
# =========================================================

@dataclass(
    frozen=True
)
class FlagCondition:

    key: str

    equals: Any = True


    def matches(
        self,
        flags: dict[
            str,
            Any,
        ],
    ) -> bool:

        return (
            flags.get(
                self.key
            )
            == self.equals
        )


# =========================================================
# FLAG EFFECTS
# =========================================================

@dataclass(
    frozen=True
)
class FlagEffect:

    key: str

    value: Any = True


# =========================================================
# CHECK SPECIFICATION
# =========================================================

@dataclass(
    frozen=True
)
class CheckSpec:

    difficulty: int

    skill: Skill | None = None

    stat: Stat | None = None

    equipment_modifier: int = 0

    situation_modifier: int = 0

    performance_modifier: int = 0

    # AI-directed checks retain their pre-scaling difficulty for telemetry and
    # balancing. Static adventures can ignore these fields.
    base_difficulty: int | None = None
    challenge_tier: str = ""
    effective_party_level: int | None = None
    level_adjustment: int = 0
    adventure_adjustment: int = 0


    def __post_init__(
        self,
    ) -> None:

        if (
            self.skill is None
            and self.stat is None
        ):

            raise ValueError(
                "A check requires either "
                "a skill or a stat."
            )


        if (
            self.difficulty < 1
        ):

            raise ValueError(
                "Check difficulty must "
                "be at least 1."
            )


    def public_data(
        self,
    ) -> dict:

        return {
            "difficulty":
                self.difficulty,

            "skill":
                (
                    self.skill.value
                    if self.skill
                    else None
                ),

            "stat":
                (
                    self.stat.value
                    if self.stat
                    else None
                ),

            "base_difficulty": self.base_difficulty,
            "challenge_tier": self.challenge_tier or None,
            "effective_party_level": self.effective_party_level,
            "level_adjustment": self.level_adjustment,
            "adventure_adjustment": self.adventure_adjustment,
        }


    def to_check_request(
        self,
    ) -> CheckRequest:

        return CheckRequest(

            difficulty=
                self.difficulty,

            skill=
                self.skill,

            stat=
                self.stat,

            modifiers=
                CheckModifiers(

                    equipment=
                        self.equipment_modifier,

                    situation=
                        self.situation_modifier,

                    performance=
                        self.performance_modifier,
                ),

            base_difficulty=self.base_difficulty,
            challenge_tier=self.challenge_tier,
            effective_party_level=self.effective_party_level,
            level_adjustment=self.level_adjustment,
            adventure_adjustment=self.adventure_adjustment,
        )


# =========================================================
# CHOICE
# =========================================================

@dataclass(
    frozen=True
)
class ChoiceDefinition:

    id: str

    label: str

    # AI-directed adventures can attach richer choice-card metadata. Static
    # adventures do not need to provide it, so every field has a harmless
    # backward-compatible default.
    description: str = ""

    archetype: str = ""

    tone: str = ""

    risk_level: str = ""

    reward_level: str = ""

    impact_level: str = ""

    possible_gains: tuple[str, ...] = ()

    possible_costs: tuple[str, ...] = ()

    check: CheckSpec | None = None

    next_scene_id: str | None = None

    visible_if: tuple[
        FlagCondition,
        ...,
    ] = ()

    set_flags: tuple[
        FlagEffect,
        ...,
    ] = ()


    def is_visible(
        self,
        flags: dict[
            str,
            Any,
        ],
    ) -> bool:

        return all(
            condition.matches(
                flags
            )

            for condition
            in self.visible_if
        )


    def public_data(
        self,
        flags: dict[
            str,
            Any,
        ],
    ) -> dict | None:

        if not self.is_visible(
            flags
        ):

            return None


        return {
            "id":
                self.id,

            "label":
                self.label,

            "description":
                self.description,

            "archetype":
                self.archetype,

            "tone":
                self.tone,

            "risk_level":
                self.risk_level,

            "reward_level":
                self.reward_level,

            "impact_level":
                self.impact_level,

            "possible_gains":
                list(self.possible_gains),

            "possible_costs":
                list(self.possible_costs),

            "check":
                (
                    self.check.public_data()
                    if self.check
                    else None
                ),

            "xp_reward":
                choice_xp_reward(
                    has_check=
                        self.check is not None,
                    difficulty=(
                        self.check.difficulty
                        if self.check
                        else None
                    ),
                    risk_level=
                        self.risk_level,
                ),
        }


# =========================================================
# SCENE
# =========================================================

@dataclass(
    frozen=True
)
class SceneDefinition:

    id: str

    title: str

    body: str

    ascii_art: str

    choices: tuple[
        ChoiceDefinition,
        ...,
    ]

    default_next_scene_id: str | None = None


    def available_choices(
        self,
        flags: dict[
            str,
            Any,
        ],
    ) -> tuple[
        ChoiceDefinition,
        ...,
    ]:

        return tuple(
            choice

            for choice
            in self.choices

            if choice.is_visible(
                flags
            )
        )


    def public_data(
        self,
        flags: dict[
            str,
            Any,
        ],
    ) -> dict:

        public_choices = []


        for choice in self.choices:

            public_choice = (
                choice.public_data(
                    flags
                )
            )


            if (
                public_choice
                is not None
            ):

                public_choices.append(
                    public_choice
                )


        return {
            "id":
                self.id,

            "title":
                self.title,

            "body":
                self.body,

            "ascii_art":
                self.ascii_art,

            "choices":
                public_choices,
        }


# =========================================================
# ADVENTURE
# =========================================================

@dataclass(
    frozen=True
)
class AdventureDefinition:

    id: str

    title: str

    description: str

    starting_scene_id: str

    scenes: dict[
        str,
        SceneDefinition,
    ]

    tags: tuple[
        str,
        ...,
    ] = ()

    metadata: dict[
        str,
        Any,
    ] = field(
        default_factory=dict
    )


    def scene(
        self,
        scene_id: str,
    ) -> SceneDefinition:

        scene = (
            self.scenes.get(
                scene_id
            )
        )


        if (
            scene is None
        ):

            raise ValueError(
                f"Unknown scene: "
                f"{scene_id}"
            )


        return scene


    def validate(
        self,
    ) -> None:

        if (
            not self.id.strip()
        ):

            raise ValueError(
                "Adventure requires an id."
            )


        if (
            not self.title.strip()
        ):

            raise ValueError(
                "Adventure requires a title."
            )


        if (
            self.starting_scene_id
            not in self.scenes
        ):

            raise ValueError(
                "Starting scene does not exist."
            )


        for (
            scene_key,
            scene,
        ) in self.scenes.items():

            if (
                scene.id
                != scene_key
            ):

                raise ValueError(
                    "Scene dictionary key does "
                    "not match scene id: "
                    f"{scene_key}"
                )


            if (
                scene.default_next_scene_id
                is not None
                and scene.default_next_scene_id
                not in self.scenes
            ):

                raise ValueError(
                    f"Scene '{scene.id}' "
                    "points to missing default "
                    "next scene "
                    f"'{scene.default_next_scene_id}'."
                )


            seen_choice_ids: set[
                str
            ] = set()


            for choice in (
                scene.choices
            ):

                if (
                    choice.id
                    in seen_choice_ids
                ):

                    raise ValueError(
                        "Duplicate choice id "
                        f"'{choice.id}' "
                        f"in scene '{scene.id}'."
                    )


                seen_choice_ids.add(
                    choice.id
                )


                if (
                    choice.next_scene_id
                    is not None
                    and choice.next_scene_id
                    not in self.scenes
                ):

                    raise ValueError(
                        f"Choice '{choice.id}' "
                        "points to missing scene "
                        f"'{choice.next_scene_id}'."
                    )
