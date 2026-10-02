from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


DIRECTOR_MIN_DIFFICULTY = 3
DIRECTOR_MAX_DIFFICULTY = 16
MAX_SCALED_DIFFICULTY = 30
MAX_LEVEL_ADJUSTMENT = 10


@dataclass(frozen=True)
class ChallengeProfile:
    effective_party_level: int
    minimum_level: int
    maximum_level: int
    level_adjustment: int
    adventure_adjustment: int
    adventure_difficulty: str

    @property
    def total_adjustment(self) -> int:
        return self.level_adjustment + self.adventure_adjustment

    @property
    def capability_band(self) -> str:
        level = self.effective_party_level
        if level <= 4:
            return "novice"
        if level <= 9:
            return "capable"
        if level <= 19:
            return "seasoned"
        if level <= 34:
            return "veteran"
        return "legendary"

    def to_dict(self) -> dict:
        return {
            "effective_party_level": self.effective_party_level,
            "minimum_level": self.minimum_level,
            "maximum_level": self.maximum_level,
            "level_adjustment": self.level_adjustment,
            "adventure_adjustment": self.adventure_adjustment,
            "total_adjustment": self.total_adjustment,
            "adventure_difficulty": self.adventure_difficulty,
            "capability_band": self.capability_band,
            "difficulty_bands": scaled_difficulty_bands(self),
        }


def _clean_levels(levels: Iterable[int] | None) -> list[int]:
    cleaned: list[int] = []
    for value in levels or []:
        try:
            cleaned.append(max(1, int(value)))
        except (TypeError, ValueError):
            continue
    return cleaned or [1]


def effective_party_level(levels: Iterable[int] | None) -> int:
    cleaned = _clean_levels(levels)
    # Round halves upward rather than Python's banker's rounding so a level
    # 10 + level 11 party consistently evaluates as level 11.
    return max(1, (sum(cleaned) + (len(cleaned) // 2)) // len(cleaned))


def level_dc_adjustment(level: int) -> int:
    """Slow progression pressure: +1 DC roughly every five Hero levels."""
    level = max(1, int(level))
    return min(MAX_LEVEL_ADJUSTMENT, max(0, level // 5))


def adventure_dc_adjustment(difficulty: str | None) -> int:
    raw = str(difficulty or "").strip().casefold()
    if not raw:
        return 0

    if any(token in raw for token in ("intro", "story", "gentle", "easy", "casual")):
        return -1
    if any(token in raw for token in ("brutal", "deadly", "extreme", "punishing", "nightmare")):
        return 2
    if any(token in raw for token in ("hard", "challeng", "difficult", "severe")):
        return 1
    return 0


def challenge_tier_for_base_difficulty(base_difficulty: int) -> str:
    dc = max(DIRECTOR_MIN_DIFFICULTY, min(DIRECTOR_MAX_DIFFICULTY, int(base_difficulty)))
    if dc <= 7:
        return "easy"
    if dc <= 11:
        return "standard"
    if dc <= 14:
        return "hard"
    if dc == 15:
        return "severe"
    return "legendary"


def build_challenge_profile(
    levels: Iterable[int] | None,
    *,
    adventure_difficulty: str | None = None,
) -> ChallengeProfile:
    cleaned = _clean_levels(levels)
    effective = effective_party_level(cleaned)
    raw_adventure_difficulty = str(adventure_difficulty or "").strip()
    return ChallengeProfile(
        effective_party_level=effective,
        minimum_level=min(cleaned),
        maximum_level=max(cleaned),
        level_adjustment=level_dc_adjustment(effective),
        adventure_adjustment=adventure_dc_adjustment(raw_adventure_difficulty),
        adventure_difficulty=raw_adventure_difficulty or "standard",
    )


def scale_director_difficulty(
    base_difficulty: int,
    profile: ChallengeProfile,
) -> dict:
    """Convert the Director's novice-band DC into the server's final shared DC.

    The Director's 3-16 value expresses relative challenge. The server then
    applies slow progression and authored adventure difficulty. This keeps the
    final number server-owned while still allowing the Director to choose how
    hard the proposed action is relative to the current fiction.
    """
    base = max(DIRECTOR_MIN_DIFFICULTY, min(DIRECTOR_MAX_DIFFICULTY, int(base_difficulty)))
    final = base + profile.total_adjustment
    final = max(DIRECTOR_MIN_DIFFICULTY, min(MAX_SCALED_DIFFICULTY, final))
    return {
        "base_difficulty": base,
        "difficulty": final,
        "challenge_tier": challenge_tier_for_base_difficulty(base),
        "effective_party_level": profile.effective_party_level,
        "level_adjustment": profile.level_adjustment,
        "adventure_adjustment": profile.adventure_adjustment,
    }


def scaled_difficulty_bands(profile: ChallengeProfile) -> dict[str, str]:
    adjustment = profile.total_adjustment

    def band(low: int, high: int) -> str:
        scaled_low = max(DIRECTOR_MIN_DIFFICULTY, min(MAX_SCALED_DIFFICULTY, low + adjustment))
        scaled_high = max(DIRECTOR_MIN_DIFFICULTY, min(MAX_SCALED_DIFFICULTY, high + adjustment))
        return str(scaled_low) if scaled_low == scaled_high else f"{scaled_low}-{scaled_high}"

    return {
        "easy": band(3, 7),
        "standard": band(8, 11),
        "hard": band(12, 14),
        "severe": band(15, 15),
        "legendary": band(16, 16),
    }
