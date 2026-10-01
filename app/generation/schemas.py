from __future__ import annotations

from typing import (
    Literal,
)

from pydantic import (
    BaseModel,
    Field,
)


class GenerateAdventureRequest(
    BaseModel
):

    world_document_id: str = Field(
        min_length=1
    )

    world_version_number: int = Field(
        ge=1
    )

    brief_document_id: str = Field(
        min_length=1
    )

    brief_version_number: int = Field(
        ge=1
    )

    special_request: str = Field(
        default="",
        max_length=4000,
    )

    quality_tier: Literal[
        "story",
        "economy",
    ] = "story"


class GeneratedAdventureActionRequest(
    BaseModel
):

    generated_adventure_id: str = Field(
        min_length=1
    )
