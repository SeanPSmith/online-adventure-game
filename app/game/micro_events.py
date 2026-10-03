from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from time import time
from typing import Any


MICRO_EVENT_CADENCE = 3
# The quick event clock begins when the modal is actually shown to the player,
# not when the server schedules it behind the turn-resolution theater.
MICRO_EVENT_TIMEOUT_SECONDS = 9.0
MAX_MICRO_EVENT_HISTORY = 8


def _clean_text(value: Any) -> str:
    if isinstance(value, str):
        return " ".join(value.split()).strip()
    return ""


def _clip(value: Any, limit: int = 180) -> str:
    text = _clean_text(value)
    if len(text) <= limit:
        return text
    clipped = text[: max(1, limit - 1)].rsplit(" ", 1)[0].strip()
    return f"{clipped}…" if clipped else text[:limit]


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


def _story_context(
    *,
    scene_title: str,
    scene_body: str,
    last_resolution: str,
    story_state: dict[str, Any],
) -> str:
    """Return a short, player-facing anchor pulled from the actual story."""

    goal = _clean_text(story_state.get("current_goal"))
    threat = ""
    values = story_state.get("active_threats", [])
    if isinstance(values, list):
        for item in values:
            if isinstance(item, dict):
                threat = next(
                    (
                        _clean_text(item.get(field))
                        for field in ("name", "title", "description", "summary")
                        if _clean_text(item.get(field))
                    ),
                    "",
                )
            else:
                threat = _clean_text(item)
            if threat:
                break

    candidates = [
        goal,
        threat,
        last_resolution,
        scene_body,
        scene_title,
    ]
    return _clip(next((value for value in candidates if _clean_text(value)), "the situation shifts"), 190)


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


def build_micro_event(
    *,
    room_code: str,
    resolved_turn_number: int,
    scene_title: str,
    story_state: dict[str, Any],
    scene_body: str = "",
    last_resolution: str = "",
) -> dict[str, Any]:
    """Create a deterministic, no-model quick event from current story facts."""

    hint = _first_story_hint(story_state)
    context = _story_context(
        scene_title=scene_title,
        scene_body=scene_body,
        last_resolution=last_resolution,
        story_state=story_state,
    )
    scene_label = _clean_text(scene_title) or "THE CURRENT SCENE"
    short_hint = _clip(hint, 105)

    seed = f"{room_code}|{resolved_turn_number}|{scene_title}|{hint}".encode("utf-8")
    variant = int(sha256(seed).hexdigest()[:8], 16) % 4
    event_id = f"micro_{resolved_turn_number}_{sha256(seed).hexdigest()[:8]}"

    templates = [
        {
            "kind": "quick_reaction",
            "title": "QUICK REACTION",
            "prompt": f"{scene_label}: {context} You have seconds, not a full plan. What does your Hero do first?",
            "options": [
                {
                    "id": "act_now",
                    "label": "MOVE FIRST",
                    "description": f"Commit immediately and push into the opening around {short_hint}.",
                    "result": f"You move first, forcing the situation around {short_hint} to react to you.",
                    "tag": "decisive",
                },
                {
                    "id": "hold_ground",
                    "label": "READ THE ROOM",
                    "description": f"Hold for one heartbeat and watch how {short_hint} changes.",
                    "result": f"You hold just long enough to read the next change around {short_hint}.",
                    "tag": "watchful",
                },
            ],
        },
        {
            "kind": "gut_check",
            "title": "GUT CHECK",
            "prompt": f"Something about {short_hint} feels wrong before you can explain why. Which instinct wins?",
            "options": [
                {
                    "id": "trust_instinct",
                    "label": "TRUST THE FEELING",
                    "description": f"Treat your reaction to {short_hint} as a warning worth following.",
                    "result": f"You trust the warning in your gut and treat {short_hint} as meaningful.",
                    "tag": "instinct",
                },
                {
                    "id": "push_through",
                    "label": "KEEP MOVING",
                    "description": f"Do not let uncertainty about {short_hint} steal the tempo.",
                    "result": f"You push through the uncertainty around {short_hint} and keep momentum.",
                    "tag": "momentum",
                },
            ],
        },
        {
            "kind": "found_something",
            "title": "FOUND SOMETHING",
            "prompt": f"In {scene_label}, a detail connected to {short_hint} suddenly looks important. It may be a clue. It may be bait.",
            "options": [
                {
                    "id": "take_it",
                    "label": "GRAB THE DETAIL",
                    "description": "Keep it close before the scene changes again.",
                    "result": f"You claim the suspicious detail tied to {short_hint} before it can disappear.",
                    "tag": "kept_clue",
                },
                {
                    "id": "leave_it",
                    "label": "MARK IT & MOVE",
                    "description": "Leave it untouched, but memorize exactly where and how it appeared.",
                    "result": f"You leave the detail tied to {short_hint} untouched and remember it precisely.",
                    "tag": "left_clue",
                },
            ],
        },
        {
            "kind": "split_second",
            "title": "SPLIT SECOND",
            "prompt": f"The beat around {short_hint} opens for only a moment. Where do you put yourself?",
            "options": [
                {
                    "id": "close_distance",
                    "label": "CLOSE IN",
                    "description": f"Get nearer to {short_hint} before the opening disappears.",
                    "result": f"You close the distance to {short_hint} and make yourself part of what happens next.",
                    "tag": "pressed_forward",
                },
                {
                    "id": "make_space",
                    "label": "CREATE SPACE",
                    "description": f"Back off just enough to get a better angle on {short_hint}.",
                    "result": f"You create space around {short_hint} and buy yourself a better angle.",
                    "tag": "made_space",
                },
            ],
        },
    ]

    template = deepcopy(templates[variant])
    created_at_ms = int(time() * 1000)

    # expires_at_ms remains only for backward compatibility with older clients.
    # The current React client starts its playable countdown when the modal is
    # actually visible. Give stale clients a generous grace window so a cached
    # frontend cannot instantly expire an event scheduled behind the theater.
    expires_at_ms = created_at_ms + (5 * 60 * 1000)

    return {
        "id": event_id,
        "created_from_turn": int(resolved_turn_number),
        "created_at_ms": created_at_ms,
        "expires_at_ms": expires_at_ms,
        "timeout_seconds": MICRO_EVENT_TIMEOUT_SECONDS,
        "scene_title": _clean_text(scene_title),
        "story_context": context,
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
        "story_context": _clean_text(event.get("story_context")),
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
        "story_context": _clean_text(event.get("story_context")),
        "outcomes": outcomes,
        "resolution": resolution,
    }
