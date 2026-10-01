from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from time import time
from typing import Any


MICRO_EVENT_CADENCE = 3
MICRO_EVENT_TIMEOUT_SECONDS = 4.0
MAX_MICRO_EVENT_HISTORY = 8


def _clean_text(value: Any) -> str:
    if isinstance(value, str):
        return " ".join(value.split()).strip()
    return ""


def _first_story_hint(story_state: dict[str, Any]) -> str:
    goal = _clean_text(story_state.get("current_goal"))
    if goal:
        return goal

    for key in ("active_threats", "unresolved_threads"):
        values = story_state.get(key, [])
        if not isinstance(values, list):
            continue
        for item in values:
            if isinstance(item, dict):
                for field in ("name", "title", "description", "summary"):
                    text = _clean_text(item.get(field))
                    if text:
                        return text
            else:
                text = _clean_text(item)
                if text:
                    return text

    return "what just changed"


def should_schedule_micro_event(*, resolved_turn_number: int, completed: bool, wrap_up_active: bool) -> bool:
    """Return True on a deliberately sparse, predictable cadence.

    Micro-events are a pacing tool, not a second turn loop.  One every three
    resolved Director turns is frequent enough to break the six-choice rhythm
    without making the quick event itself repetitive.
    """

    resolved_turn_number = max(0, int(resolved_turn_number or 0))
    return (
        not completed
        and not wrap_up_active
        and resolved_turn_number >= MICRO_EVENT_CADENCE
        and resolved_turn_number % MICRO_EVENT_CADENCE == 0
    )


def build_micro_event(*, room_code: str, resolved_turn_number: int, scene_title: str, story_state: dict[str, Any]) -> dict[str, Any]:
    """Create a deterministic, no-model micro-event from current story facts."""

    hint = _first_story_hint(story_state)
    seed = f"{room_code}|{resolved_turn_number}|{scene_title}|{hint}".encode("utf-8")
    variant = int(sha256(seed).hexdigest()[:8], 16) % 4
    event_id = f"micro_{resolved_turn_number}_{sha256(seed).hexdigest()[:8]}"

    templates = [
        {
            "kind": "quick_reaction",
            "title": "QUICK REACTION",
            "prompt": "The situation shifts before anyone has time to make a full plan. What does your Hero do first?",
            "options": [
                {
                    "id": "act_now",
                    "label": "ACT NOW",
                    "description": "Move on instinct before the moment closes.",
                    "result": "You commit before the hesitation can win.",
                    "tag": "decisive",
                },
                {
                    "id": "hold_ground",
                    "label": "HOLD GROUND",
                    "description": "Refuse the bait and watch what changes next.",
                    "result": "You hold position and force the moment to reveal itself.",
                    "tag": "watchful",
                },
            ],
        },
        {
            "kind": "gut_check",
            "title": "GUT CHECK",
            "prompt": f"Something about {hint[:110]} feels wrong in a way the room cannot quite explain. Which instinct wins?",
            "options": [
                {
                    "id": "trust_instinct",
                    "label": "TRUST THE FEELING",
                    "description": "Treat the bad feeling as useful information.",
                    "result": "You mark the unease as a clue instead of dismissing it.",
                    "tag": "instinct",
                },
                {
                    "id": "push_through",
                    "label": "PUSH THROUGH",
                    "description": "Do not let uncertainty take control of the tempo.",
                    "result": "You keep moving and refuse to surrender momentum.",
                    "tag": "momentum",
                },
            ],
        },
        {
            "kind": "found_something",
            "title": "FOUND SOMETHING",
            "prompt": "In the fallout from the last beat, one small detail catches your eye. It may matter. It may be bait.",
            "options": [
                {
                    "id": "take_it",
                    "label": "TAKE IT",
                    "description": "Keep the suspicious detail close for later.",
                    "result": "You pocket the detail and make it part of the party's story.",
                    "tag": "kept_clue",
                },
                {
                    "id": "leave_it",
                    "label": "LEAVE IT",
                    "description": "Do not touch what the scene seems too eager to offer.",
                    "result": "You leave it where it is and remember exactly where you saw it.",
                    "tag": "left_clue",
                },
            ],
        },
        {
            "kind": "split_second",
            "title": "SPLIT SECOND",
            "prompt": "There is a heartbeat of silence between the danger you understood and whatever comes next.",
            "options": [
                {
                    "id": "close_distance",
                    "label": "CLOSE THE DISTANCE",
                    "description": "Stay near the problem instead of giving it room.",
                    "result": "You move closer and make yourself part of the next exchange.",
                    "tag": "pressed_forward",
                },
                {
                    "id": "make_space",
                    "label": "MAKE SPACE",
                    "description": "Create room to react before the next thing happens.",
                    "result": "You buy yourself a little breathing room and a better angle.",
                    "tag": "made_space",
                },
            ],
        },
    ]

    template = deepcopy(templates[variant])
    created_at_ms = int(time() * 1000)
    expires_at_ms = created_at_ms + int(MICRO_EVENT_TIMEOUT_SECONDS * 1000)

    return {
        "id": event_id,
        "created_from_turn": int(resolved_turn_number),
        "created_at_ms": created_at_ms,
        "expires_at_ms": expires_at_ms,
        "timeout_seconds": MICRO_EVENT_TIMEOUT_SECONDS,
        "scene_title": _clean_text(scene_title),
        "kind": template["kind"],
        "title": template["title"],
        "prompt": template["prompt"],
        "options": template["options"],
        "responses": {},
        "resolved": False,
        "resolution": "",
    }


def public_micro_event(event: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(event, dict) or not event:
        return None

    return {
        "id": str(event.get("id", "")),
        "created_from_turn": int(event.get("created_from_turn", 0) or 0),
        "created_at_ms": int(event.get("created_at_ms", 0) or 0),
        "expires_at_ms": int(event.get("expires_at_ms", 0) or 0),
        "timeout_seconds": float(
            event.get("timeout_seconds", MICRO_EVENT_TIMEOUT_SECONDS)
            or MICRO_EVENT_TIMEOUT_SECONDS
        ),
        "scene_title": _clean_text(event.get("scene_title")),
        "kind": _clean_text(event.get("kind")),
        "title": _clean_text(event.get("title")) or "QUICK EVENT",
        "prompt": _clean_text(event.get("prompt")),
        "options": [
            {
                "id": str(option.get("id", "")),
                "label": _clean_text(option.get("label")),
                "description": _clean_text(option.get("description")),
            }
            for option in event.get("options", [])
            if isinstance(option, dict) and str(option.get("id", "")).strip()
        ],
        "responses": dict(event.get("responses", {}) or {}),
        "resolved": bool(event.get("resolved", False)),
        "resolution": _clean_text(event.get("resolution")),
    }


def resolve_micro_event(*, event: dict[str, Any], response_names: dict[str, str]) -> dict[str, Any]:
    """Build a compact history record once every required Hero has answered."""

    options_by_id = {
        str(option.get("id", "")): option
        for option in event.get("options", [])
        if isinstance(option, dict)
    }

    outcomes = []
    for player_id, option_id in dict(event.get("responses", {}) or {}).items():
        option_id = str(option_id)

        if option_id == "__timeout__":
            outcomes.append({
                "player_id": str(player_id),
                "player_name": _clean_text(response_names.get(str(player_id))) or "Hero",
                "option_id": option_id,
                "option_label": "NO REACTION",
                "result": "The split-second opportunity passes before you commit.",
                "tag": "hesitated",
            })
            continue

        option = options_by_id.get(option_id)
        if option is None:
            continue

        outcomes.append({
            "player_id": str(player_id),
            "player_name": _clean_text(response_names.get(str(player_id))) or "Hero",
            "option_id": option_id,
            "option_label": _clean_text(option.get("label")),
            "result": _clean_text(option.get("result")),
            "tag": _clean_text(option.get("tag")),
        })

    if outcomes:
        joined = "; ".join(
            f"{item['player_name']}: {item['option_label']}"
            for item in outcomes
        )
        resolution = f"Quick event resolved — {joined}."
    else:
        resolution = "Quick event resolved."

    return {
        "id": str(event.get("id", "")),
        "created_from_turn": int(event.get("created_from_turn", 0) or 0),
        "kind": _clean_text(event.get("kind")),
        "title": _clean_text(event.get("title")),
        "prompt": _clean_text(event.get("prompt")),
        "outcomes": outcomes,
        "resolution": resolution,
    }
