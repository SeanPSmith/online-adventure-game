from app.adventures.content import (
    OLD_CHAPEL,
    WINDROAD_LANTERN,
)

from app.adventures.registry import (
    adventure_registry,
)


# =========================================================
# BUILT-IN ADVENTURES
# =========================================================

def register_builtin_adventures(
) -> None:

    for adventure in (
        OLD_CHAPEL,
        WINDROAD_LANTERN,
    ):

        if not adventure_registry.exists(
            adventure.id
        ):

            adventure_registry.register(
                adventure
            )
