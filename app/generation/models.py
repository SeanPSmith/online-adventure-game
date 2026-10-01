from __future__ import annotations

from dataclasses import (
    dataclass,
)

from typing import (
    Any,
)


@dataclass(
    frozen=True
)
class GeneratedAdventure:

    generated_adventure_id: str

    status: str

    seed: dict[
        str,
        Any,
    ]

    world_document_id: str
    world_version_number: int

    brief_document_id: str
    brief_version_number: int

    created_by_user_id: str

    created_at: str
    updated_at: str

    approved_at: (
        str
        | None
    ) = None


    def public_data(
        self,
    ) -> dict[
        str,
        Any,
    ]:

        return {
            "generated_adventure_id":
                self.generated_adventure_id,

            "status":
                self.status,

            "seed":
                self.seed,

            "world_document_id":
                self.world_document_id,

            "world_version_number":
                self.world_version_number,

            "brief_document_id":
                self.brief_document_id,

            "brief_version_number":
                self.brief_version_number,

            "created_by_user_id":
                self.created_by_user_id,

            "created_at":
                self.created_at,

            "updated_at":
                self.updated_at,

            "approved_at":
                self.approved_at,
        }
