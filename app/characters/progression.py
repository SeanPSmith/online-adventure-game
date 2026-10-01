from __future__ import annotations

from math import isfinite


# =========================================================
# LEVEL CURVE
# =========================================================

# Total lifetime XP follows a smooth quadratic curve. The first level-up is
# intentionally quick, while each later level asks for a little more play.
# Keeping the curve mathematical (rather than a hand-authored table) makes the
# progression system predictable and easy to rebalance.
#
# Lifetime thresholds:
#   L1 =    0
#   L2 =  100
#   L3 =  300
#   L4 =  600
#   L5 = 1000
#   L6 = 1500
#   ...


def xp_required_for_level(level: int) -> int:
    """Total lifetime XP required to have reached ``level``."""
    level = max(1, int(level))
    return 50 * (level - 1) * level


def xp_required_for_next_level(level: int) -> int:
    return xp_required_for_level(max(1, int(level)) + 1)


def level_for_experience(experience: int) -> int:
    experience = max(0, int(experience))
    level = 1
    while experience >= xp_required_for_next_level(level):
        level += 1
    return level


# =========================================================
# XP REWARD MODEL
# =========================================================

# Risk is the primary reward driver. These are intentionally spaced far enough
# apart that a reckless/extreme choice is visibly worth more than a safe one.
RISK_BASE_XP: dict[str, int] = {
    "safe": 6,
    "low": 9,
    "moderate": 14,
    "high": 20,
    "severe": 28,
    "extreme": 38,
}

# A Hero earns slightly more XP at higher levels so the expanding threshold
# does not make later progression feel frozen. This is deliberately small.
XP_LEVEL_MULTIPLIER_PER_LEVEL = 0.04
XP_LEVEL_MULTIPLIER_CAP = 1.75

# Successful checks retain the original success bonus. Failed checks now earn
# partial XP based on how close the authoritative check total came to the DC.
# This keeps dangerous experimentation worthwhile without making failure worth
# the same as success.
SUCCESS_XP_MULTIPLIER = 1.15
CRITICAL_SUCCESS_XP_MULTIPLIER = 1.35
FAILURE_XP_MIN_MULTIPLIER = 0.15
FAILURE_XP_MAX_MULTIPLIER = 0.65
CRITICAL_FAILURE_XP_MAX_MULTIPLIER = 0.20


def normalize_risk_level(
    risk_level: str | None,
    *,
    has_check: bool,
    difficulty: int | None = None,
) -> str:
    """Return a canonical risk band, inferring one for legacy/static choices."""
    raw = str(risk_level or "").strip().lower()
    if raw in RISK_BASE_XP:
        return raw

    if not has_check:
        return "low"

    difficulty = max(1, int(difficulty or 1))
    if difficulty <= 8:
        return "low"
    if difficulty <= 12:
        return "moderate"
    if difficulty <= 16:
        return "high"
    if difficulty <= 20:
        return "severe"
    return "extreme"


def xp_level_multiplier(level: int) -> float:
    level = max(1, int(level))
    multiplier = 1.0 + ((level - 1) * XP_LEVEL_MULTIPLIER_PER_LEVEL)
    return min(XP_LEVEL_MULTIPLIER_CAP, multiplier)


def check_proximity(
    *,
    check_total: int | None,
    difficulty: int | None,
) -> float | None:
    """Return the bounded fraction of DC reached by an authoritative check."""
    if check_total is None or difficulty is None:
        return None

    dc = max(1, int(difficulty))
    total = max(0, int(check_total))
    return min(1.0, max(0.0, total / dc))


def failure_xp_multiplier(
    *,
    check_total: int | None,
    difficulty: int | None,
    critical: bool = False,
) -> tuple[float, float | None]:
    """Scale failure XP by check proximity while keeping a small floor."""
    proximity = check_proximity(
        check_total=check_total,
        difficulty=difficulty,
    )

    # Legacy/materialized results may not include the check total. They still
    # get reduced failure XP rather than silently falling back to full reward.
    if proximity is None:
        multiplier = 0.40
    else:
        multiplier = FAILURE_XP_MAX_MULTIPLIER * (proximity ** 2)
        multiplier = max(FAILURE_XP_MIN_MULTIPLIER, multiplier)
        multiplier = min(FAILURE_XP_MAX_MULTIPLIER, multiplier)

    if critical:
        multiplier = min(CRITICAL_FAILURE_XP_MAX_MULTIPLIER, multiplier)

    return multiplier, proximity


def xp_outcome_multiplier(
    outcome: str | None,
    *,
    check_total: int | None = None,
    difficulty: int | None = None,
) -> tuple[float, float | None]:
    normalized = str(outcome or "").strip().lower()

    if normalized == "critical_success":
        return CRITICAL_SUCCESS_XP_MULTIPLIER, check_proximity(
            check_total=check_total,
            difficulty=difficulty,
        )

    if normalized == "success":
        return SUCCESS_XP_MULTIPLIER, check_proximity(
            check_total=check_total,
            difficulty=difficulty,
        )

    if normalized == "critical_failure":
        return failure_xp_multiplier(
            check_total=check_total,
            difficulty=difficulty,
            critical=True,
        )

    if normalized == "failure":
        return failure_xp_multiplier(
            check_total=check_total,
            difficulty=difficulty,
        )

    return 1.0, check_proximity(
        check_total=check_total,
        difficulty=difficulty,
    )


def choice_xp_breakdown(
    *,
    has_check: bool,
    difficulty: int | None = None,
    risk_level: str | None = None,
    hero_level: int = 1,
    outcome: str | None = None,
    check_total: int | None = None,
) -> dict:
    """Return deterministic server-owned XP math for one committed choice."""
    risk = normalize_risk_level(
        risk_level,
        has_check=has_check,
        difficulty=difficulty,
    )
    base_xp = int(RISK_BASE_XP[risk])
    level_multiplier = xp_level_multiplier(hero_level)
    outcome_multiplier, proximity = xp_outcome_multiplier(
        outcome,
        check_total=check_total,
        difficulty=difficulty,
    )

    raw_xp = base_xp * level_multiplier * outcome_multiplier
    if not isfinite(raw_xp):
        raw_xp = float(base_xp)

    final_xp = max(1, int(round(raw_xp)))

    return {
        "risk_level": risk,
        "base_xp": base_xp,
        "hero_level": max(1, int(hero_level)),
        "level_multiplier": round(level_multiplier, 3),
        "outcome": str(outcome or "").strip().lower() or None,
        "outcome_multiplier": round(outcome_multiplier, 3),
        "check_total": (
            int(check_total)
            if check_total is not None
            else None
        ),
        "check_difficulty": (
            int(difficulty)
            if difficulty is not None
            else None
        ),
        "check_proximity": (
            round(proximity, 3)
            if proximity is not None
            else None
        ),
        "final_xp": final_xp,
    }


def choice_xp_reward(
    *,
    has_check: bool,
    difficulty: int | None = None,
    risk_level: str | None = None,
    hero_level: int = 1,
    outcome: str | None = None,
    check_total: int | None = None,
) -> int:
    """Visible/deterministic XP reward for a committed story decision."""
    return int(
        choice_xp_breakdown(
            has_check=has_check,
            difficulty=difficulty,
            risk_level=risk_level,
            hero_level=hero_level,
            outcome=outcome,
            check_total=check_total,
        )["final_xp"]
    )


# =========================================================
# PUBLIC PROGRESSION DATA
# =========================================================


def progression_public_data(level: int, experience: int) -> dict:
    level = max(1, int(level))
    experience = max(0, int(experience))
    current_floor = xp_required_for_level(level)
    next_threshold = xp_required_for_next_level(level)
    into_level = max(0, experience - current_floor)
    span = max(1, next_threshold - current_floor)
    return {
        "xp_current": experience,
        "xp_level_floor": current_floor,
        "xp_next_level": next_threshold,
        "xp_into_level": into_level,
        "xp_needed_for_next_level": max(0, next_threshold - experience),
        "xp_level_span": span,
        "xp_progress_percent": min(100.0, max(0.0, (into_level / span) * 100.0)),
        "xp_level_multiplier": round(xp_level_multiplier(level), 3),
    }
