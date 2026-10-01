from __future__ import annotations

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class AdventureSeedDraft(
    BaseModel
):
    """
    Creative planning payload produced by the model.

    Server-controlled provenance is added after validation.
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


class PlayerSynopsisDraft(
    BaseModel
):
    """
    Small storefront-facing copy pass used when the primary seed synopsis is too
    close to the author's rough pitch or otherwise reads like source notes.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    player_synopsis: str = Field(
        min_length=80,
        max_length=700,
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
