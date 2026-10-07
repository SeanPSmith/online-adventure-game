from __future__ import annotations

from typing import (
    Any,
    Literal,
)

from pydantic import (
    BaseModel,
    Field,
)


DocumentKind = Literal[
    "world",
    "brief",
]


class CreateAdventureRequest(
    BaseModel
):

    title: str = Field(
        min_length=1,
        max_length=160,
    )

    slug: str = Field(
        min_length=1,
        max_length=80,
    )

    document_kind: DocumentKind = (
        "world"
    )

    parent_document_id: (
        str
        | None
    ) = None


class SaveAdventureRequest(
    BaseModel
):

    source: dict[
        str,
        Any,
    ]

    expected_updated_at: (
        str
        | None
    ) = None


class DuplicateAdventureRequest(
    BaseModel
):

    title: str = Field(
        min_length=1,
        max_length=160,
    )

    slug: str = Field(
        min_length=1,
        max_length=80,
    )


class ArchiveAdventureRequest(
    BaseModel
):

    archived: bool


class PreviewAdventureRequest(
    BaseModel
):

    source: dict[
        str,
        Any,
    ]


class AuthorAssistRequest(
    BaseModel
):

    source: dict[
        str,
        Any,
    ]

    instruction: str = Field(
        min_length=1,
        max_length=1200,
    )

    section: Literal[
        "document",
        "field",
        "world_truths",
        "world_rules",
        "adventure_facts",
        "locations",
        "npcs",
        "lore_secrets",
        "moments",
        "forbidden_rules",
        "story_threads",
    ] = "document"

    item_index: (
        int
        | None
    ) = Field(
        default=None,
        ge=0,
    )

    field_path: (
        str
        | None
    ) = Field(
        default=None,
        max_length=160,
    )

    document_id: (
        str
        | None
    ) = Field(
        default=None,
        max_length=80,
    )

    version_number: (
        int
        | None
    ) = Field(
        default=None,
        ge=1,
    )


class AuthorMessageResponse(
    BaseModel
):

    message: str
