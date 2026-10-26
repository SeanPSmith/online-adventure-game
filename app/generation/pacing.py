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


# A narrative target is a guide to structure, not a kill switch. The author
# can offer the last chapter explicitly, but the server never completes a
# playable chronicle just because the maximum turn count was reached.
def narrative_beat_plan(current_turn: int, target_turns: int, maximum_turns: int) -> dict[str, str | int]:
    """Stable three-act milestones for short, medium, long, and epic stories.

    This plan contains *fictional* guidance only; it never changes rolled dice,
    XP, health, turn counts, or authoritative story state.
    """
    target = max(3, int(target_turns or 3))
    ceiling = max(target, int(maximum_turns or target))
    turn = max(1, int(current_turn or 1))
    first_break = max(2, round(target * .25))
    second_break = max(first_break + 2, round(target * .65))
    climax_start = max(second_break + 1, round(target * .82))
    if turn <= first_break:
        return {"act": 1, "beat": "ESTABLISH", "phase": "SETUP", "direction":
            "Act I: establish the Hero's immediate situation, meaningful central goal, stakes, recurring people/places, and an inciting change. Plant specific unresolved threads; do not solve the central goal yet."}
    if turn <= second_break:
        return {"act": 2, "beat": "COMPLICATE", "phase": "ESCALATION", "direction":
            "Act II: pursue concrete objectives; make discoveries and alliances count; turn setbacks into new routes. Raise pressure through causally connected reversals, not random danger. If the Hero rests or finds shelter, time passes and the next turn resumes at a changed, purposeful situation."}
    if turn < climax_start:
        return {"act": 3, "beat": "CONVERGE", "phase": "CONVERGENCE", "direction":
            "Act III approach: begin paying off established clues and relationships. Transform the main obstacle, narrow choices, and stage a final dilemma arising from prior play. Do not introduce an unrelated rescuer, villain, escape, or sudden solution."}
    if turn <= ceiling:
        return {"act": 3, "beat": "CLIMAX READY", "phase": "FINALE WINDOW", "direction":
            "Act III: bring the central conflict to a meaningful, earned decisive choice, with consequences rooted in previous decisions. A victory, evacuation, rescue, or return must follow from something the Hero established or earned. Offer the player agency to request the final chapter; do not silently finish the adventure."}
    return {"act": 3, "beat": "PLAYER-DIRECTED CONTINUATION", "phase": "FINALE WINDOW", "direction":
        "The selected length's planned runway has passed. Do not fabricate an ending or repeat filler scenes. Put the genuine final decision in reach while keeping the playable story open until the party explicitly requests closure. Summarize uneventful travel/rest, and keep the ending grounded in prior choices."}


def solo_finale_due(*, current_turn: int, minimum_turns: int, maximum_turns: int, play_mode: str, player_count: int) -> bool:
    """Only solo stories are automatically concluded at their selected length cap.

    Multi-player stories use their existing unanimous vote.  The final
    decision still comes from the Hero's locked turn, with authoritative dice.
    """
    return (
        str(play_mode).lower() == "solo"
        and player_count == 1
        and int(maximum_turns or 0) > 0
        and int(current_turn) >= max(int(minimum_turns or 1), int(maximum_turns))
    )
