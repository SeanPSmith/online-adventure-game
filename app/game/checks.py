from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.game.character import (
    Character,
    DEFAULT_SKILL_STATS,
    Skill,
    Stat,
)

from app.game.dice import d20


# =========================================================
# CHECK RESULT TYPE
# =========================================================

class CheckOutcome(str, Enum):
    CRITICAL_FAILURE = "critical_failure"
    FAILURE = "failure"
    SUCCESS = "success"
    CRITICAL_SUCCESS = "critical_success"


# =========================================================
# RESULT
# =========================================================

@dataclass(frozen=True)
class CheckResult:

    character_id: str

    stat: Stat
    skill: Skill | None

    difficulty: int

    die_roll: int

    stat_modifier: int
    skill_modifier: int
    equipment_modifier: int
    situation_modifier: int
    performance_modifier: int

    total_modifier: int

    total: int

    outcome: CheckOutcome

    margin: int


    @property
    def succeeded(
        self,
    ) -> bool:

        return self.outcome in {
            CheckOutcome.SUCCESS,
            CheckOutcome.CRITICAL_SUCCESS,
        }


    def to_dict(
        self,
    ) -> dict:

        return {
            "character_id":
                self.character_id,

            "stat":
                self.stat.value,

            "skill":
                (
                    self.skill.value
                    if self.skill
                    else None
                ),

            "difficulty":
                self.difficulty,

            "die_roll":
                self.die_roll,

            "modifiers": {
                "stat":
                    self.stat_modifier,

                "skill":
                    self.skill_modifier,

                "equipment":
                    self.equipment_modifier,

                "situation":
                    self.situation_modifier,

                "performance":
                    self.performance_modifier,

                "total":
                    self.total_modifier,
            },

            "total":
                self.total,

            "margin":
                self.margin,

            "outcome":
                self.outcome.value,

            "succeeded":
                self.succeeded,
        }


# =========================================================
# CHECK ENGINE
# =========================================================

def perform_check(
    character: Character,

    difficulty: int,

    skill: Skill | None = None,

    stat: Stat | None = None,

    equipment_modifier: int = 0,

    situation_modifier: int = 0,

    performance_modifier: int = 0,

) -> CheckResult:

    difficulty = int(
        difficulty
    )


    # -----------------------------------------------------
    # DETERMINE STAT
    # -----------------------------------------------------

    if stat is None:

        if skill is None:

            raise ValueError(
                "A check requires either a stat or skill."
            )

        stat = (
            DEFAULT_SKILL_STATS[
                skill
            ]
        )


    # -----------------------------------------------------
    # CHARACTER MODIFIERS
    # -----------------------------------------------------

    stat_modifier = (
        character.get_stat(
            stat
        )
    )


    if skill is None:

        skill_modifier = 0

    else:

        skill_modifier = (
            character.get_skill(
                skill
            )
        )


    # -----------------------------------------------------
    # ROLL
    # -----------------------------------------------------

    roll = d20()

    die_roll = (
        roll.result
    )


    # -----------------------------------------------------
    # MODIFIER TOTAL
    # -----------------------------------------------------

    total_modifier = sum(
        (
            stat_modifier,
            skill_modifier,
            int(
                equipment_modifier
            ),
            int(
                situation_modifier
            ),
            int(
                performance_modifier
            ),
        )
    )


    total = (
        die_roll
        + total_modifier
    )


    margin = (
        total
        - difficulty
    )


    # -----------------------------------------------------
    # OUTCOME
    # -----------------------------------------------------

    if die_roll == 1:

        outcome = (
            CheckOutcome.CRITICAL_FAILURE
        )

    elif die_roll == 20:

        outcome = (
            CheckOutcome.CRITICAL_SUCCESS
        )

    elif total >= difficulty:

        outcome = (
            CheckOutcome.SUCCESS
        )

    else:

        outcome = (
            CheckOutcome.FAILURE
        )


    return CheckResult(

        character_id=
            character.character_id,

        stat=
            stat,

        skill=
            skill,

        difficulty=
            difficulty,

        die_roll=
            die_roll,

        stat_modifier=
            stat_modifier,

        skill_modifier=
            skill_modifier,

        equipment_modifier=
            int(
                equipment_modifier
            ),

        situation_modifier=
            int(
                situation_modifier
            ),

        performance_modifier=
            int(
                performance_modifier
            ),

        total_modifier=
            total_modifier,

        total=
            total,

        outcome=
            outcome,

        margin=
            margin,
    )
    