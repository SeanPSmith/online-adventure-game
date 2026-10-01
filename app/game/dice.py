from __future__ import annotations

import secrets

from dataclasses import dataclass


# =========================================================
# DIE ROLL
# =========================================================

@dataclass(frozen=True)
class DieRoll:

    sides: int

    result: int


# =========================================================
# DICE
# =========================================================

def roll_die(
    sides: int,
) -> DieRoll:

    sides = int(
        sides
    )

    if sides < 2:

        raise ValueError(
            "A die must have at least 2 sides."
        )

    result = (
        secrets.randbelow(
            sides
        )
        + 1
    )

    return DieRoll(
        sides=sides,
        result=result,
    )


def d20() -> DieRoll:

    return roll_die(
        20
    )


def d6() -> DieRoll:

    return roll_die(
        6
    )


def d8() -> DieRoll:

    return roll_die(
        8
    )


def d10() -> DieRoll:

    return roll_die(
        10
    )


def d12() -> DieRoll:

    return roll_die(
        12
    )