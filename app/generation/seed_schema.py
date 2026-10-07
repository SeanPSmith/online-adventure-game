from __future__ import annotations

from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class SeedOpeningCheckDraft(BaseModel):
    """Relative first-turn check proposal. The server still owns the final DC."""

    model_config = ConfigDict(extra="forbid")

    difficulty: int = Field(ge=3, le=16)
    skill: Literal[
        "athletics", "acrobatics", "stealth", "investigation", "knowledge",
        "technology", "awareness", "survival", "persuasion", "deception",
        "intimidation", "discipline", "brawl", "sleight", "medicine",
        "mechanics", "navigation", "insight", "performance", "composure",
    ] | None
    stat: Literal[
        "strength", "agility", "intellect", "perception", "presence",
        "willpower", "luck",
    ] | None

    @model_validator(mode="after")
    def validate_target(self) -> "SeedOpeningCheckDraft":
        has_skill = bool(str(self.skill or "").strip())
        has_stat = bool(str(self.stat or "").strip())
        if has_skill == has_stat:
            raise ValueError("An opening check must use exactly one skill or one stat.")
        return self


class SeedOpeningChoiceDraft(BaseModel):
    """One real choice available on the pre-generated opening page."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=2, max_length=90)
    description: str = Field(min_length=8, max_length=360)
    archetype: Literal[
        "safe", "bold", "reckless", "clever", "social", "weird",
        "mercenary", "heroic", "cruel", "chaotic", "stealth", "investigative",
    ]
    tone: Literal[
        "cautious", "assertive", "aggressive", "whimsical", "deceptive",
        "compassionate", "pragmatic", "defiant", "curious", "desperate",
    ]
    risk_level: Literal["low", "moderate", "high", "severe", "extreme"]
    reward_level: Literal["low", "moderate", "high", "major"]
    impact_level: Literal["local", "meaningful", "scene_shifting"]
    possible_gains: list[str] = Field(min_length=1, max_length=4)
    possible_costs: list[str] = Field(min_length=1, max_length=4)
    check: SeedOpeningCheckDraft | None

    @field_validator("label", "description", mode="after")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("possible_gains", "possible_costs", mode="after")
    @classmethod
    def clean_list(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            text = str(value).strip()
            if text and text not in cleaned:
                cleaned.append(text)
        return cleaned


class SeedOpeningSceneDraft(BaseModel):
    """
    First real playable page of the adventure.

    This is generated with the approved seed so entering a room never waits on
    a live Story Director request merely to obtain turn one.
    """

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=140)
    body: str = Field(min_length=80, max_length=2400)
    choices: list[SeedOpeningChoiceDraft] = Field(min_length=3, max_length=6)

    @field_validator("title", "body", mode="after")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_choice_set(self) -> "SeedOpeningSceneDraft":
        labels = [choice.label.casefold() for choice in self.choices]
        if len(labels) != len(set(labels)):
            raise ValueError("Opening choices must be distinct.")
        if sum(1 for choice in self.choices if choice.check is not None) < 2:
            raise ValueError("The opening must offer at least two checked choices.")
        return self


class AdventureSeedDraft(BaseModel):
    """
    Creative planning payload produced by the model.

    Server-controlled provenance is added after validation. The opening scene is
    part of the approved seed so turn one is ready before a player enters.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    schema_version: int = Field(
        ge=1,
        le=1,
    )

    title: str = Field(
        min_length=1,
        max_length=140,
    )

    subtitle: str = Field(
        min_length=1,
        max_length=180,
    )

    primary_type: str = Field(
        min_length=1,
        max_length=80,
    )

    secondary_type: str = Field(
        max_length=80,
    )

    target_length: str = Field(
        min_length=1,
        max_length=40,
    )

    tone: str = Field(
        min_length=1,
        max_length=240,
    )

    difficulty: str = Field(
        min_length=1,
        max_length=80,
    )

    weirdness: int = Field(
        ge=0,
        le=5,
    )

    premise: str = Field(
        min_length=30,
        max_length=1800,
    )

    player_synopsis: str = Field(
        min_length=40,
        max_length=700,
    )

    opening_scene: SeedOpeningSceneDraft

    core_goal: str = Field(
        min_length=10,
        max_length=700,
    )

    major_locations: list[str] = Field(
        min_length=1,
        max_length=7,
    )

    major_npcs: list[str] = Field(
        max_length=7,
    )

    canon_constraints: list[str] = Field(
        max_length=12,
    )

    required_elements: list[str] = Field(
        max_length=12,
    )

    forbidden_elements: list[str] = Field(
        max_length=12,
    )

    open_threads: list[str] = Field(
        max_length=10,
    )

    hidden_truths: list[str] = Field(
        max_length=8,
    )

    potential_finale: str = Field(
        min_length=20,
        max_length=1400,
    )

    director_guidance: list[str] = Field(
        min_length=1,
        max_length=10,
    )

    @field_validator(
        "title",
        "subtitle",
        "primary_type",
        "secondary_type",
        "target_length",
        "tone",
        "difficulty",
        "premise",
        "player_synopsis",
        "core_goal",
        "potential_finale",
        mode="after",
    )
    @classmethod
    def strip_text(
        cls,
        value: str,
    ) -> str:

        return value.strip()

    @field_validator(
        "major_locations",
        "major_npcs",
        "canon_constraints",
        "required_elements",
        "forbidden_elements",
        "open_threads",
        "hidden_truths",
        "director_guidance",
        mode="after",
    )
    @classmethod
    def clean_string_list(
        cls,
        values: list[str],
    ) -> list[str]:

        cleaned: list[str] = []

        for value in values:
            text = str(value).strip()

            if (
                text
                and text not in cleaned
            ):
                cleaned.append(text)

        return cleaned


class PlayerSynopsisDraft(BaseModel):
    """Dedicated player-facing jacket-copy pass."""

    model_config = ConfigDict(
        extra="forbid",
    )

    player_synopsis: str = Field(
        min_length=80,
        max_length=900,
    )

    @field_validator(
        "player_synopsis",
        mode="after",
    )
    @classmethod
    def strip_synopsis(
        cls,
        value: str,
    ) -> str:

        return value.strip()
