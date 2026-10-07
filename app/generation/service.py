from __future__ import annotations

import os

from typing import (
    Any,
)

from app.adventures.registry import (
    adventure_registry,
)

from app.authoring.store import (
    authoring_store,
)

from app.generation.mock_provider import (
    mock_generation_provider,
)

from app.generation.openai_provider import (
    openai_generation_provider,
)

from app.generation.provider import (
    AdventureGenerationProvider,
)

from app.generation.runtime_adapter import (
    build_director_runtime_adventure,
    runtime_adventure_id,
)

from app.generation.store import (
    generated_adventure_store,
)




def _validate_featured_world_references(
    world_source: dict[str, Any],
    brief_source: dict[str, Any],
) -> None:
    """Ensure Brief references exist in the exact published World version used.

    Author AI may see the newest linked World draft while generation intentionally
    pins published versions. If a Brief features something that only exists in a
    newer/unpublished World version, fail clearly instead of silently generating
    against mismatched canon.
    """
    refs = brief_source.get("world_references", {})
    if not isinstance(refs, dict):
        return

    missing: list[str] = []
    for key, label in (
        ("locations", "location"),
        ("npcs", "person/faction"),
        ("lore_secrets", "lore/secret"),
    ):
        world_items = world_source.get(key, [])
        valid_ids = {
            str(item.get("id"))
            for item in world_items
            if isinstance(item, dict) and str(item.get("id", "")).strip()
        }
        items = refs.get(key, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            source_id = str(item.get("source_id", "")).strip()
            if source_id and source_id in valid_ids:
                continue
            name = str(
                item.get("name")
                or item.get("title")
                or source_id
                or "unnamed reference"
            ).strip()
            missing.append(f"{label}: {name}")

    if missing:
        detail = "; ".join(missing[:6])
        raise ValueError(
            "This Adventure Brief features World content that is not present in "
            "the selected published World version: " + detail + ". Publish/select "
            "the matching World version or update the Brief references before generation."
        )


class AdventureGenerationService:

    def __init__(
        self,
        provider: AdventureGenerationProvider,
    ) -> None:

        self.provider = provider


    def provider_status(
        self,
    ) -> dict[
        str,
        Any,
    ]:

        return (
            self.provider
            .public_status()
        )


    async def generate(
        self,
        *,
        world_document_id: str,
        world_version_number: int,
        brief_document_id: str,
        brief_version_number: int,
        special_request: str,
        quality_tier: str,
        user_id: str,
    ) -> dict[
        str,
        Any,
    ]:

        world_version = (
            await authoring_store
            .get_version(
                world_document_id,
                world_version_number,
            )
        )


        if world_version is None:

            raise LookupError(
                "World version not found."
            )


        brief_version = (
            await authoring_store
            .get_version(
                brief_document_id,
                brief_version_number,
            )
        )


        if brief_version is None:

            raise LookupError(
                "Adventure brief version not found."
            )


        if (
            world_version.get(
                "document_kind"
            )
            != "world"
        ):

            raise ValueError(
                "Generation requires a world document."
            )


        if (
            brief_version.get(
                "document_kind"
            )
            != "brief"
        ):

            raise ValueError(
                "Generation requires an adventure brief."
            )


        if (
            world_version[
                "status"
            ]
            != "published"
        ):

            raise ValueError(
                "The selected world version must be published."
            )


        if (
            brief_version[
                "status"
            ]
            != "published"
        ):

            raise ValueError(
                "The selected adventure brief version must be published."
            )


        linked_world_id = (
            brief_version.get(
                "parent_document_id"
            )
        )


        if (
            linked_world_id
            and linked_world_id
            != world_document_id
        ):

            raise ValueError(
                "That adventure brief belongs to a different world."
            )


        _validate_featured_world_references(
            world_version.get("source", {}),
            brief_version.get("source", {}),
        )


        seed = (
            await self.provider
            .generate_seed(

                world_version=
                    world_version,

                brief_version=
                    brief_version,

                special_request=
                    special_request,

                quality_tier=
                    quality_tier,
            )
        )


        return (
            await generated_adventure_store
            .create(

                seed=
                    seed,

                world_document_id=
                    world_document_id,

                world_version_number=
                    world_version_number,

                brief_document_id=
                    brief_document_id,

                brief_version_number=
                    brief_version_number,

                created_by_user_id=
                    user_id,
            )
        )


    async def approve(
        self,
        generated_adventure_id: str,
    ) -> dict[
        str,
        Any,
    ]:

        generated = (
            await generated_adventure_store
            .get(
                generated_adventure_id
            )
        )


        if generated is None:

            raise LookupError(
                "Generated adventure not found."
            )


        if (
            generated[
                "status"
            ]
            == "retired"
        ):

            raise ValueError(
                "Retired generated adventures cannot be approved."
            )


        updated = (
            await generated_adventure_store
            .set_status(

                generated_adventure_id=
                    generated_adventure_id,

                status=
                    "approved",
            )
        )


        self.register_runtime_adventure(
            updated
        )


        return updated


    async def reject(
        self,
        generated_adventure_id: str,
    ) -> dict[
        str,
        Any,
    ]:

        return (
            await generated_adventure_store
            .set_status(

                generated_adventure_id=
                    generated_adventure_id,

                status=
                    "rejected",
            )
        )


    async def retire(
        self,
        generated_adventure_id: str,
    ) -> dict[
        str,
        Any,
    ]:

        generated = (
            await generated_adventure_store
            .get(
                generated_adventure_id
            )
        )


        if generated is None:

            raise LookupError(
                "Generated adventure not found."
            )


        runtime_id = (
            runtime_adventure_id(
                generated_adventure_id
            )
        )


        updated = (
            await generated_adventure_store
            .set_status(

                generated_adventure_id=
                    generated_adventure_id,

                status=
                    "retired",
            )
        )


        if (
            adventure_registry.exists(
                runtime_id
            )
        ):

            # Existing rooms retain their AdventureDefinition reference, but
            # player discovery must stop advertising a retired seed now rather
            # than waiting for the next process restart.
            runtime_adventure = adventure_registry.get(runtime_id)
            runtime_adventure.metadata["catalog_visible"] = False


        return updated


    def register_runtime_adventure(
        self,
        generated: dict[
            str,
            Any,
        ],
    ) -> str:

        runtime_id = (
            runtime_adventure_id(
                generated[
                    "generated_adventure_id"
                ]
            )
        )


        if (
            adventure_registry.exists(
                runtime_id
            )
        ):

            adventure_registry.get(runtime_id).metadata["catalog_visible"] = True
            return runtime_id


        adventure = (
            build_director_runtime_adventure(
                generated
            )
        )


        adventure_registry.register(
            adventure
        )


        return runtime_id


    async def register_approved_adventures(
        self,
    ) -> int:

        approved = (
            await generated_adventure_store
            .list_approved()
        )


        registered = 0


        for generated in approved:

            runtime_id = (
                runtime_adventure_id(
                    generated[
                        "generated_adventure_id"
                    ]
                )
            )


            if (
                adventure_registry.exists(
                    runtime_id
                )
            ):

                continue


            self.register_runtime_adventure(
                generated
            )


            registered += 1


        return registered


def _configured_provider(
) -> AdventureGenerationProvider:

    provider_name = (
        os.getenv(
            "TOT_GENERATION_PROVIDER",
            "mock",
        )
        .strip()
        .casefold()
    )

    if provider_name == "openai":
        return (
            openai_generation_provider
        )

    if provider_name == "mock":
        return (
            mock_generation_provider
        )

    raise RuntimeError(
        "TOT_GENERATION_PROVIDER must be 'mock' or 'openai'."
    )


generation_service = (
    AdventureGenerationService(
        provider=
            _configured_provider()
    )
)
