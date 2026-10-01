from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(
    frozen=True
)
class AuthorDocumentSummary:

    document_id: str
    slug: str
    title: str
    document_kind: str
    parent_document_id: (
        str
        | None
    )
    parent_title: (
        str
        | None
    )
    latest_version: int
    latest_status: str
    latest_published_version: (
        int
        | None
    )
    strength_score: int
    strength_label: str
    is_archived: bool
    updated_at: datetime


    def public_data(
        self,
    ) -> dict[str, Any]:

        return {
            "document_id":
                self.document_id,

            "slug":
                self.slug,

            "title":
                self.title,

            "document_kind":
                self.document_kind,

            "parent_document_id":
                self.parent_document_id,

            "parent_title":
                self.parent_title,

            "latest_version":
                self.latest_version,

            "latest_status":
                self.latest_status,

            "latest_published_version":
                self.latest_published_version,

            "strength_score":
                self.strength_score,

            "strength_label":
                self.strength_label,

            "is_archived":
                self.is_archived,

            "updated_at":
                self.updated_at.isoformat(),
        }
