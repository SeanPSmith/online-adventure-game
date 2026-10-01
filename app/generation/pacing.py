from __future__ import annotations


def director_turn_window(
    target_length,
) -> tuple[
    int,
    int,
    int,
]:

    """
    Return:
        minimum turns before an ending is allowed,
        preferred target turn,
        hard maximum turn.
    """

    normalized = str(
        target_length
        or "MEDIUM"
    ).strip().upper()


    aliases = {
        "VERY SHORT":
            "SHORT",

        "ONE SHOT":
            "SHORT",

        "ONE-SHOT":
            "SHORT",

        "STANDARD":
            "MEDIUM",

        "NORMAL":
            "MEDIUM",

        "EXTENDED":
            "LONG",
    }


    normalized = (
        aliases.get(
            normalized,
            normalized,
        )
    )


    windows = {
        "SHORT":
            (
                8,
                12,
                16,
            ),

        "MEDIUM":
            (
                12,
                18,
                26,
            ),

        "LONG":
            (
                18,
                28,
                40,
            ),

        "EPIC":
            (
                24,
                36,
                52,
            ),
    }


    return windows.get(
        normalized,
        windows[
            "MEDIUM"
        ],
    )
