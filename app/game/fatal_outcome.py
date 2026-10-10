"""Server-owned fatal-turn reconciliation.

The Director proposes injury severity in scene state, but the server applies
HP after generation. That post-generation mechanical result is authoritative:
if it kills the Hero, it must replace contradictory future-story prose.
"""
from __future__ import annotations

from typing import Any


def reconcile_fatal_outcome(
    *,
    room: Any,
    session: Any,
    progression_updates: dict[str, dict],
    result: dict,
    living_after_turn: bool,
) -> None:
    fallen = [
        (room.players.get(player_id), update)
        for player_id, update in progression_updates.items()
        if bool(update.get("died_this_turn"))
    ]
    if fallen:
        notes = []
        names = []
        for player, update in fallen:
            name = str(getattr(player, "name", "") or "A Hero")
            record = update.get("death_record")
            record = record if isinstance(record, dict) else {}
            cause = str(record.get("cause", "mortal wounds") or "mortal wounds")
            names.append(name)
            notes.append(f"{name} falls. {cause} The wounds prove fatal.")
        fate = " ".join(notes)
        result["resolution"] = (str(result.get("resolution", "") or "").strip() + " " + fate).strip()
        session.last_resolution = (str(session.last_resolution or "").strip() + " " + fate).strip()
        # Let survivors' next Director request know a companion died. This is a
        # narrative fact, never another HP event or repeat damage application.
        if isinstance(getattr(session, "story_state", None), dict):
            consequences = session.story_state.setdefault("recent_consequences", [])
            if isinstance(consequences, list):
                consequences.append({
                    "description": fate,
                    "affected": ", ".join(names),
                    "health_delta": 0,
                    "permanence": "permanent",
                })
        if living_after_turn and isinstance(getattr(session, "dynamic_scene", None), dict):
            body = str(session.dynamic_scene.get("body", "") or "")
            session.dynamic_scene["body"] = (fate + "\n\n" + body).strip()

    if not living_after_turn:
        session.completed = True
        # A QTE may have been staged by the Director commit before HP was
        # calculated. No reaction challenge can survive a party wipe.
        if hasattr(session, "pending_micro_event"):
            session.pending_micro_event = None
        session.ending_label = (
            "THE HEROES HAVE FALLEN" if len(room.players) > 1
            else "THE HERO HAS FALLEN"
        )
        result["completed"] = True
        result["ending_label"] = session.ending_label
        # In particular, never show Director's already-written happy ending or
        # a fresh menu after lethal damage.
        terminal = (
            "The journey ends here. " + (
                " ".join(
                    str(getattr(player, "name", "") or "A Hero")
                    + " has fallen from "
                    + str((update.get("death_record") or {}).get("cause", "mortal wounds"))
                    + "."
                    for player, update in fallen
                ) or "No Heroes remain to carry on."
            )
        )
        result["resolution"] = terminal
        session.last_resolution = terminal
        if isinstance(getattr(session, "dynamic_scene", None), dict):
            session.dynamic_scene["title"] = session.ending_label
            session.dynamic_scene["body"] = terminal
            session.dynamic_scene["choices"] = []
