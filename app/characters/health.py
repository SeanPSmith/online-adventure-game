from __future__ import annotations

import math


# Health grows substantially across a Hero's career, but deliberately does not
# scale linearly.  The curve keeps early levels readable while allowing veteran
# Heroes to survive larger absolute wounds without making low-tier hazards scale
# one-for-one with their HP pool.
def max_health_for_level(level: int) -> int:
    level = max(1, int(level or 1))
    n = level - 1
    return max(10, 10 + round((1.25 * n) + (0.0125 * n * n)))


# Director health_delta is an IMPACT TIER, not literal HP.  The server converts
# it to real HP using the Hero's current level and health pool.
_DAMAGE_FRACTIONS = {
    1: 0.08,
    2: 0.14,
    3: 0.22,
    4: 0.32,
    5: 0.45,
}

_HEAL_FRACTIONS = {
    1: 0.08,
    2: 0.13,
    3: 0.20,
    4: 0.28,
}


def _veteran_resilience(level: int) -> float:
    """Diminishing protection against percentage-based damage at high level.

    Level 1 receives the full severity fraction.  Veteran Heroes gradually
    reduce that fraction, but never become immune to dangerous consequences.
    """
    level = max(1, int(level or 1))
    return 0.72 + (0.28 / math.sqrt(level))


def _recovery_efficiency(level: int) -> float:
    level = max(1, int(level or 1))
    return 0.85 + (0.15 / math.sqrt(level))


def scaled_health_delta(*, impact: int, level: int, max_health: int) -> int:
    impact = int(impact or 0)
    max_health = max(1, int(max_health or 1))
    level = max(1, int(level or 1))

    if impact == 0:
        return 0

    if impact < 0:
        tier = min(5, abs(impact))
        fraction = _DAMAGE_FRACTIONS[tier] * _veteran_resilience(level)
        points = max(1, round(max_health * fraction))
        return -points

    tier = min(4, impact)
    fraction = _HEAL_FRACTIONS[tier] * _recovery_efficiency(level)
    points = max(1, round(max_health * fraction))
    return points


def per_turn_health_cap(*, level: int, max_health: int, healing: bool) -> int:
    """Bound stacked same-turn consequences without flattening level scaling."""
    max_health = max(1, int(max_health or 1))
    level = max(1, int(level or 1))
    if healing:
        fraction = 0.35 * _recovery_efficiency(level)
    else:
        fraction = 0.55 * _veteran_resilience(level)
    return max(1, round(max_health * fraction))


def effect_duration_for_level(
    permanence: str,
    *,
    modifier_value: int,
    level: int,
    temporary_base: int = 3,
    lasting_base: int = 8,
) -> int | None:
    """Scale finite condition duration with Hero experience.

    Veteran Heroes shake off harmful finite effects faster.  Beneficial effects
    become slightly more durable as the Hero grows.  Permanent effects remain
    permanent and narrative-only effects should bypass this helper.
    """
    permanence = str(permanence or "temporary").strip().lower()
    level = max(1, int(level or 1))
    modifier_value = int(modifier_value or 0)

    if permanence == "permanent":
        return None

    base = lasting_base if permanence == "lasting" else temporary_base

    if modifier_value < 0:
        reduction = min(2, (level - 1) // 15)
        return max(1, base - reduction)

    if modifier_value > 0:
        extension = min(2, (level - 1) // 20)
        return base + extension

    return base
