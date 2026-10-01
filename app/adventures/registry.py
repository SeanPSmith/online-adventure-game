from __future__ import annotations

from app.adventures.models import (
    AdventureDefinition,
)


# =========================================================
# ADVENTURE REGISTRY
# =========================================================

class AdventureRegistry:

    def __init__(
        self,
    ) -> None:

        self._adventures: dict[
            str,
            AdventureDefinition,
        ] = {}


    def register(
        self,
        adventure: AdventureDefinition,
    ) -> None:

        adventure.validate()


        if (
            adventure.id
            in self._adventures
        ):

            raise ValueError(
                "Adventure already registered: "
                f"{adventure.id}"
            )


        self._adventures[
            adventure.id
        ] = adventure


    def unregister(
        self,
        adventure_id: str,
    ) -> (
        AdventureDefinition
        | None
    ):

        return self._adventures.pop(
            adventure_id,
            None,
        )


    def get(
        self,
        adventure_id: str,
    ) -> AdventureDefinition:

        adventure = (
            self._adventures.get(
                adventure_id
            )
        )


        if (
            adventure is None
        ):

            raise ValueError(
                "Unknown adventure: "
                f"{adventure_id}"
            )


        return adventure


    def exists(
        self,
        adventure_id: str,
    ) -> bool:

        return (
            adventure_id
            in self._adventures
        )


    def all(
        self,
    ) -> tuple[
        AdventureDefinition,
        ...,
    ]:

        return tuple(
            self._adventures.values()
        )


    def clear(
        self,
    ) -> None:

        self._adventures.clear()


adventure_registry = (
    AdventureRegistry()
)
