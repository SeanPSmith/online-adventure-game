from __future__ import annotations

from abc import (
    ABC,
    abstractmethod,
)

from typing import (
    Any,
)


class AdventureGenerationError(
    RuntimeError
):
    """
    Base class for failures inside a generation provider.
    """


class AdventureGenerationConfigurationError(
    AdventureGenerationError
):
    """
    The selected provider is not configured correctly.
    """


class AdventureGenerationResponseError(
    AdventureGenerationError
):
    """
    The provider responded, but no valid adventure seed could be produced.
    """


class AdventureGenerationProvider(
    ABC
):

    @abstractmethod
    async def generate_seed(
        self,
        *,
        world_version: dict[
            str,
            Any,
        ],
        brief_version: dict[
            str,
            Any,
        ],
        special_request: str,
        quality_tier: str = "story",
    ) -> dict[
        str,
        Any,
    ]:

        raise NotImplementedError


    @abstractmethod
    def public_status(
        self,
    ) -> dict[
        str,
        Any,
    ]:
        """
        Non-secret provider information safe for the private Author console.
        """

        raise NotImplementedError
