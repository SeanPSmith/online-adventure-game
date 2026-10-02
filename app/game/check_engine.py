from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.characters.models import (
    DEFAULT_SKILL_STATS,
    Character,
    Skill,
    Stat,
)

from app.characters.effects import (
    effect_modifier_for_check,
)

from app.characters.talents import (
    talent_modifier_for_check,
)

from app.game.dice import (
    d20,
)


# =========================================================
# OUTCOMES
# =========================================================

class CheckOutcome(
    str,
    Enum,
):

    CRITICAL_FAILURE = (
        "critical_failure"
    )

    FAILURE = (
        "failure"
    )

    SUCCESS = (
        "success"
    )

    CRITICAL_SUCCESS = (
        "critical_success"
    )


# =========================================================
# MODIFIERS
# =========================================================

@dataclass(
    frozen=True
)
class CheckModifiers:

    equipment: int = 0

    situation: int = 0

    performance: int = 0


    @property
    def total(
        self,
    ) -> int:

        return (
            self.equipment
            + self.situation
            + self.performance
        )


# =========================================================
# CHECK REQUEST
# =========================================================

@dataclass(
    frozen=True
)
class CheckRequest:

    difficulty: int

    skill: Skill | None = None

    stat: Stat | None = None

    modifiers: CheckModifiers = (
        CheckModifiers()
    )

    base_difficulty: int | None = None
    challenge_tier: str = ""
    effective_party_level: int | None = None
    level_adjustment: int = 0
    adventure_adjustment: int = 0


# =========================================================
# CHECK RESULT
# =========================================================

@dataclass(
    frozen=True
)
class CheckResult:

    character_id: str

    character_name: str

    difficulty: int

    base_difficulty: int | None
    challenge_tier: str
    effective_party_level: int | None
    level_adjustment: int
    adventure_adjustment: int

    d20: int

    stat: Stat

    stat_value: int

    skill: Skill | None

    skill_value: int

    equipment_modifier: int

    situation_modifier: int

    performance_modifier: int

    effect_modifier: int

    effect_details: tuple[dict, ...]

    talent_modifier: int

    talent_details: tuple[dict, ...]

    total_modifier: int

    total: int

    outcome: CheckOutcome


    @property
    def succeeded(
        self,
    ) -> bool:

        return self.outcome in {
            CheckOutcome.SUCCESS,
            CheckOutcome.CRITICAL_SUCCESS,
        }


    @property
    def is_critical(
        self,
    ) -> bool:

        return self.outcome in {
            CheckOutcome.CRITICAL_FAILURE,
            CheckOutcome.CRITICAL_SUCCESS,
        }


    def to_dict(
        self,
    ) -> dict:

        return {
            "character_id":
                self.character_id,

            "character_name":
                self.character_name,

            "difficulty":
                self.difficulty,

            "base_difficulty": self.base_difficulty,
            "challenge_tier": self.challenge_tier or None,
            "effective_party_level": self.effective_party_level,
            "level_adjustment": self.level_adjustment,
            "adventure_adjustment": self.adventure_adjustment,

            "roll":
                self.d20,

            "stat":
                self.stat.value,

            "stat_value":
                self.stat_value,

            "skill":
                (
                    self.skill.value
                    if self.skill
                    else None
                ),

            "skill_value":
                self.skill_value,

            "equipment_modifier":
                self.equipment_modifier,

            "situation_modifier":
                self.situation_modifier,

            "performance_modifier":
                self.performance_modifier,

            "effect_modifier":
                self.effect_modifier,

            "effect_details": [
                dict(item)
                for item in self.effect_details
            ],

            "talent_modifier":
                self.talent_modifier,

            "talent_details": [
                dict(item)
                for item in self.talent_details
            ],

            "total_modifier":
                self.total_modifier,

            "total":
                self.total,

            "outcome":
                self.outcome.value,

            "succeeded":
                self.succeeded,

            "critical":
                self.is_critical,
        }


# =========================================================
# ERROR
# =========================================================

class CheckEngineError(
    ValueError,
):
    pass


# =========================================================
# STAT RESOLUTION
# =========================================================

def resolve_check_stat(
    request: CheckRequest,
) -> Stat:

    if (
        request.stat
        is not None
    ):

        return request.stat


    if (
        request.skill
        is not None
    ):

        return DEFAULT_SKILL_STATS[
            request.skill
        ]


    raise CheckEngineError(
        "A check requires either a stat or a skill."
    )


# =========================================================
# OUTCOME
# =========================================================

def determine_outcome(
    d20_result: int,
    total: int,
    difficulty: int,
) -> CheckOutcome:

    if (
        d20_result == 1
    ):

        return (
            CheckOutcome
            .CRITICAL_FAILURE
        )


    if (
        d20_result == 20
    ):

        return (
            CheckOutcome
            .CRITICAL_SUCCESS
        )


    if (
        total >= difficulty
    ):

        return (
            CheckOutcome.SUCCESS
        )


    return (
        CheckOutcome.FAILURE
    )


# =========================================================
# PERFORM CHECK
# =========================================================

def perform_character_check(
    character: Character,
    request: CheckRequest,
) -> CheckResult:

    if (
        request.difficulty
        < 1
    ):

        raise CheckEngineError(
            "Difficulty must be at least 1."
        )


    stat = resolve_check_stat(
        request
    )


    stat_value = (
        character.get_stat(
            stat
        )
    )


    skill_value = 0


    if (
        request.skill
        is not None
    ):

        skill_value = (
            character.get_skill(
                request.skill
            )
        )


    effect_modifier, applied_effects = (
        effect_modifier_for_check(
            character,
            stat=stat,
            skill=request.skill,
        )
    )

    talent_modifier, applied_talents = talent_modifier_for_check(
        character,
        stat=stat,
        skill=request.skill,
    )


    roll = d20()


    modifier_total = (
        stat_value
        + skill_value
        + request.modifiers.total
        + effect_modifier
        + talent_modifier
    )


    total = (
        roll.result
        + modifier_total
    )


    outcome = determine_outcome(
        d20_result=
            roll.result,

        total=
            total,

        difficulty=
            request.difficulty,
    )


    return CheckResult(

        character_id=
            character.character_id,

        character_name=
            character.name,

        difficulty=
            request.difficulty,

        base_difficulty=request.base_difficulty,
        challenge_tier=request.challenge_tier,
        effective_party_level=request.effective_party_level,
        level_adjustment=request.level_adjustment,
        adventure_adjustment=request.adventure_adjustment,

        d20=
            roll.result,

        stat=
            stat,

        stat_value=
            stat_value,

        skill=
            request.skill,

        skill_value=
            skill_value,

        equipment_modifier=
            request.modifiers.equipment,

        situation_modifier=
            request.modifiers.situation,

        performance_modifier=
            request.modifiers.performance,

        effect_modifier=
            effect_modifier,

        effect_details=tuple(
            item.to_dict()
            for item in applied_effects
        ),

        talent_modifier=
            talent_modifier,

        talent_details=tuple(
            dict(item)
            for item in applied_talents
        ),

        total_modifier=
            modifier_total,

        total=
            total,

        outcome=
            outcome,
    )