from __future__ import annotations

from pydantic import (
    BaseModel,
    Field,
)


# =========================================================
# CREATION RULES
# =========================================================

class CreationStatDefinition(
    BaseModel,
):

    id: str

    label: str


class CreationSkillDefinition(
    BaseModel,
):

    id: str

    label: str

    stat: str


class CharacterCreationRulesResponse(
    BaseModel,
):

    stat_point_budget: int

    skill_point_budget: int

    stat_min: int

    stat_max: int

    skill_min: int

    skill_max: int

    advancement_stat_cap: int = 6
    advancement_skill_cap: int = 5

    stats: list[
        CreationStatDefinition
    ]

    skills: list[
        CreationSkillDefinition
    ]


# =========================================================
# CREATE CHARACTER
# =========================================================

class CreateCharacterRequest(
    BaseModel,
):

    name: str = Field(
        min_length=2,
        max_length=40,
    )

    stats: dict[
        str,
        int,
    ]

    skills: dict[
        str,
        int,
    ]


# =========================================================
# CHARACTER RESPONSE
# =========================================================

class AdvanceCharacterRequest(BaseModel):

    stats: dict[str, int] = Field(default_factory=dict)
    skills: dict[str, int] = Field(default_factory=dict)


class CharacterResponse(
    BaseModel,
):

    character_id: str

    owner_user_id: str

    name: str

    created_at: str

    updated_at: str

    level: int

    experience: int

    unspent_stat_points: int = 0
    unspent_skill_points: int = 0
    advancement_history: list[dict] = Field(default_factory=list)

    max_health: int

    health: int

    is_alive: bool = True

    death_record: dict | None = None

    effects: list[dict] = Field(default_factory=list)

    xp_current: int = 0
    xp_level_floor: int = 0
    xp_next_level: int = 0
    xp_into_level: int = 0
    xp_needed_for_next_level: int = 0
    xp_level_span: int = 1
    xp_progress_percent: float = 0.0
    xp_level_multiplier: float = 1.0

    stats: dict[
        str,
        int,
    ]

    skills: dict[
        str,
        int,
    ]

    inventory: list[str]


# =========================================================
# CHARACTER LIST
# =========================================================

class CharacterListResponse(
    BaseModel,
):

    characters: list[
        CharacterResponse
    ]


# =========================================================
# DELETE
# =========================================================

class CharacterDeleteResponse(
    BaseModel,
):

    message: str