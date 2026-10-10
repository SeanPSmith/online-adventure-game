from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from random import Random
from time import time
from typing import Any

from app.characters.models import Character, Skill, Stat


MICRO_EVENT_CADENCE = 3
# The quick-event clock begins when the modal is actually shown to the player,
# not when the server schedules it behind the turn-resolution theater.
MICRO_EVENT_TIMEOUT_SECONDS = 12.0
MAX_MICRO_EVENT_HISTORY = 8
QTE_EFFECT_DURATION_TURNS = 1
MAX_ACTIVE_FINITE_EFFECTS = 3


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
    return _clip(next((value for value in candidates if _clean_text(value)), "the situation shifts"), 220)


def should_schedule_micro_event(*, resolved_turn_number: int, completed: bool, wrap_up_active: bool) -> bool:
    """Return True on a deliberately sparse, predictable cadence.

    QTE cadence remains server-owned. The Director may author a QTE only when
    this function says the current committed turn is eligible.
    """

    resolved_turn_number = max(0, int(resolved_turn_number or 0))
    return (
        not completed
        and not wrap_up_active
        and resolved_turn_number >= MICRO_EVENT_CADENCE
        and resolved_turn_number % MICRO_EVENT_CADENCE == 0
    )


def _fallback_effect(*, positive: bool, variant: int) -> dict[str, Any]:
    targets = [
        ("agility", None, "QUICK FOOTED" if positive else "OFF BALANCE"),
        ("perception", None, "SHARP READ" if positive else "SECOND GUESSING"),
        (None, "awareness", "LOCKED IN" if positive else "RATTLED"),
        ("willpower", None, "STEADY NERVE" if positive else "SHAKEN NERVE"),
    ]
    stat, skill, name = targets[variant % len(targets)]
    modifier = 1 if positive else -1
    return {
        "name": name,
        "description": (
            "The split-second read gives you an edge on the next story round."
            if positive
            else "The missed beat throws you off for the next story round."
        ),
        "modifier_stat": stat,
        "modifier_skill": skill,
        "modifier_value": modifier,
        "duration_turns": QTE_EFFECT_DURATION_TURNS,
    }


def _fallback_micro_event(
    *,
    room_code: str,
    resolved_turn_number: int,
    scene_title: str,
    story_state: dict[str, Any],
    scene_body: str,
    last_resolution: str,
) -> dict[str, Any]:
    """Compatibility fallback when an older/mocked Director supplies no QTE."""

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
    digest = sha256(seed).hexdigest()
    variant = int(digest[:8], 16) % 4
    correct_first = int(digest[8:16], 16) % 2 == 0

    templates = [
        {
            "kind": "quick_reaction",
            "title": "QUICK REACTION",
            "prompt": f"{scene_label}: the situation around {short_hint} changes without warning. What do you do first?",
            "options": [
                {"id": "move", "label": "MOVE", "description": "Commit immediately and clear the danger line."},
                {"id": "hold", "label": "HOLD", "description": "Stay planted for one beat and read the change."},
            ],
        },
        {
            "kind": "gut_check",
            "title": "GUT CHECK",
            "prompt": f"Something about {short_hint} shifts in a way you can feel before you understand it. Pick the instinct you trust.",
            "options": [
                {"id": "trust", "label": "TRUST IT", "description": "Treat the warning in your gut as real and react now."},
                {"id": "push", "label": "PUSH THROUGH", "description": "Ignore the hesitation and keep your momentum."},
            ],
        },
        {
            "kind": "found_something",
            "title": "FOUND SOMETHING",
            "prompt": f"A detail tied to {short_hint} suddenly matters. You only have time for one move.",
            "options": [
                {"id": "take", "label": "TAKE IT", "description": "Secure the detail before the scene changes again."},
                {"id": "mark", "label": "MARK IT", "description": "Leave it untouched and lock its position in your memory."},
            ],
        },
        {
            "kind": "split_second",
            "title": "SPLIT SECOND",
            "prompt": f"The beat around {short_hint} opens for only a moment. Choose your position before it closes.",
            "options": [
                {"id": "close", "label": "CLOSE IN", "description": "Get nearer before the opening disappears."},
                {"id": "space", "label": "CREATE SPACE", "description": "Back off just enough to gain a cleaner angle."},
            ],
        },
    ]

    template = deepcopy(templates[variant])
    correct_option_id = template["options"][0 if correct_first else 1]["id"]
    return {
        "story_context": context,
        "kind": template["kind"],
        "title": template["title"],
        "prompt": template["prompt"],
        "options": template["options"],
        "correct_option_id": correct_option_id,
        "success_text": f"You read the moment correctly and turn the opening around {short_hint} to your advantage.",
        "failure_text": f"You commit a beat too late around {short_hint}, and the mistake follows you into the next round.",
        "success_effect": _fallback_effect(positive=True, variant=variant),
        "failure_effect": _fallback_effect(positive=False, variant=variant),
    }


def _sanitize_effect_spec(raw: Any, *, positive: bool) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    stat = _clean_text(raw.get("modifier_stat")).lower() or None
    skill = _clean_text(raw.get("modifier_skill")).lower() or None

    try:
        stat = Stat(stat).value if stat else None
    except (TypeError, ValueError):
        stat = None

    try:
        skill = Skill(skill).value if skill else None
    except (TypeError, ValueError):
        skill = None

    # A QTE effect has exactly one mechanical target. Fall back to Agility if a
    # hand-authored/test payload is malformed; live Director schema validation
    # should make this path rare.
    if bool(stat) == bool(skill):
        stat = Stat.AGILITY.value
        skill = None

    try:
        requested = int(raw.get("modifier_value", 1 if positive else -1) or 0)
    except (TypeError, ValueError):
        requested = 1 if positive else -1

    modifier = max(1, min(2, abs(requested)))
    if not positive:
        modifier *= -1

    return {
        "name": _clip(raw.get("name"), 48) or ("QUICK EDGE" if positive else "MISSED BEAT"),
        "description": _clip(raw.get("description"), 220)
        or (
            "Your reaction gives you an edge for the next story round."
            if positive
            else "Your reaction leaves you hindered for the next story round."
        ),
        "modifier_stat": stat,
        "modifier_skill": skill,
        "modifier_value": modifier,
        "duration_turns": QTE_EFFECT_DURATION_TURNS,
    }


def _normalize_authored_event(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or not raw:
        return None

    raw_options = raw.get("options")
    if not isinstance(raw_options, list) or len(raw_options) not in {2, 3}:
        return None

    options: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for index, item in enumerate(raw_options, start=1):
        if not isinstance(item, dict):
            return None
        option_id = _clean_text(item.get("id")) or f"option_{index}"
        if option_id in seen_ids:
            return None
        seen_ids.add(option_id)
        label = _clip(item.get("label"), 38)
        description = _clip(item.get("description"), 90)
        if not label or not description:
            return None
        options.append({
            "id": option_id,
            "label": label,
            "description": description,
        })

    correct_option_id = _clean_text(raw.get("correct_option_id"))
    if correct_option_id not in seen_ids:
        return None

    return {
        # For new three-way QTEs Director authors BEST, NEUTRAL, BAD in
        # schema order. Two-way historical events keep their binary semantics.
        "neutral_option_id": (
            options[1]["id"] if len(options) == 3 else None
        ),
        "story_context": _clip(raw.get("story_context"), 240),
        "kind": _clean_text(raw.get("kind")) or "quick_reaction",
        "title": _clip(raw.get("title"), 80) or "QUICK REACTION",
        "prompt": _clip(raw.get("prompt"), 160),
        "options": options,
        "correct_option_id": correct_option_id,
        "success_text": _clip(raw.get("success_text"), 320)
        or "You read the moment correctly and seize the advantage.",
        "failure_text": _clip(raw.get("failure_text"), 320)
        or "You read the moment wrong and carry the mistake into the next round.",
        "success_effect": _sanitize_effect_spec(raw.get("success_effect"), positive=True),
        "failure_effect": _sanitize_effect_spec(raw.get("failure_effect"), positive=False),
    }


def has_authored_scene_qte(raw: Any) -> bool:
    """A runtime QTE must actually come from the authored scene beat.

    The generic deterministic fallback remains for old helper callers, but
    live Director commits should skip an invalid/missing authored reaction
    rather than spawn a disconnected prompt after unrelated scene prose.
    """
    normalized = _normalize_authored_event(raw)
    return bool(
        normalized
        and normalized.get("story_context")
        and normalized.get("prompt")
        and normalized.get("success_text")
        and normalized.get("failure_text")
        and len(normalized.get("options", [])) == 3
        and normalized.get("correct_option_id") == normalized["options"][0]["id"]
    )


def build_micro_event(
    *,
    room_code: str,
    resolved_turn_number: int,
    scene_title: str,
    story_state: dict[str, Any],
    scene_body: str = "",
    last_resolution: str = "",
    authored_event: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create one server-owned QTE, preferring the Director-authored scene beat.

    The Director may author fiction and candidate mechanics, but Python commits
    the correct answer before players can respond and sanitizes every temporary
    modifier. `correct_option_id` is never exposed by `public_micro_event()`.
    """

    normalized = _normalize_authored_event(authored_event)
    if normalized is None:
        normalized = _fallback_micro_event(
            room_code=room_code,
            resolved_turn_number=resolved_turn_number,
            scene_title=scene_title,
            story_state=story_state,
            scene_body=scene_body,
            last_resolution=last_resolution,
        )

    if not normalized.get("story_context"):
        normalized["story_context"] = _story_context(
            scene_title=scene_title,
            scene_body=scene_body,
            last_resolution=last_resolution,
            story_state=story_state,
        )

    seed = (
        f"{room_code}|{resolved_turn_number}|{scene_title}|"
        f"{normalized['prompt']}|{normalized['correct_option_id']}"
    ).encode("utf-8")
    event_id = f"micro_{resolved_turn_number}_{sha256(seed).hexdigest()[:8]}"
    # Shuffle after capturing the correct/neutral IDs. Use an event-seeded RNG
    # so every client/reconnect sees exactly the same order.
    options = list(normalized.get("options", []))
    Random(int(sha256(seed).hexdigest()[:16], 16)).shuffle(options)
    normalized["options"] = options
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
        **normalized,
        "responses": {},
        "resolved": False,
        "resolution": "",
        "outcomes": [],
    }


def _public_effect(effect: Any) -> dict[str, Any] | None:
    if not isinstance(effect, dict) or not effect:
        return None
    stat = _clean_text(effect.get("modifier_stat"))
    skill = _clean_text(effect.get("modifier_skill"))
    modifier = int(effect.get("modifier_value", 0) or 0)
    target_kind = "stat" if stat else "skill" if skill else ""
    target = stat or skill
    return {
        "name": _clean_text(effect.get("name")) or "STATUS EFFECT",
        "description": _clean_text(effect.get("description")),
        "modifier": modifier,
        "target_kind": target_kind,
        "target": target,
        "duration_turns": int(effect.get("duration_turns", QTE_EFFECT_DURATION_TURNS) or QTE_EFFECT_DURATION_TURNS),
    }


def public_micro_event(event: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(event, dict) or not event:
        return None

    resolved = bool(event.get("resolved", False))
    correct_option_label = ""
    if resolved:
        correct_id = str(event.get("correct_option_id", ""))
        correct_option = next(
            (
                option
                for option in event.get("options", [])
                if isinstance(option, dict) and str(option.get("id", "")) == correct_id
            ),
            None,
        )
        if isinstance(correct_option, dict):
            correct_option_label = _clean_text(correct_option.get("label"))

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
        "odds_denominator": max(1, len(event.get("options", []) or [])),
        "success_effect": _public_effect(event.get("success_effect")),
        "failure_effect": _public_effect(event.get("failure_effect")),
        "responses": dict(event.get("responses", {}) or {}),
        "resolved": resolved,
        "resolution": _clean_text(event.get("resolution")),
        "correct_option_label": correct_option_label,
        "outcomes": [
            {
                "player_id": str(item.get("player_id", "")),
                "player_name": _clean_text(item.get("player_name")) or "Hero",
                "option_id": str(item.get("option_id", "")),
                "option_label": _clean_text(item.get("option_label")),
                "result": _clean_text(item.get("result")),
                "tag": _clean_text(item.get("tag")),
                "success": bool(item.get("success", False)),
                "effect": _public_effect(item.get("effect")),
                "effect_applied": bool(item.get("effect_applied", False)),
            }
            for item in event.get("outcomes", [])
            if isinstance(item, dict)
        ],
    }


def resolve_micro_event(*, event: dict[str, Any], response_names: dict[str, str]) -> dict[str, Any]:
    """Resolve committed QTE answers without ever choosing the winner post-click."""

    options_by_id = {
        str(option.get("id", "")): option
        for option in event.get("options", [])
        if isinstance(option, dict)
    }
    correct_option_id = str(event.get("correct_option_id", ""))

    outcomes = []
    for player_id, option_id in dict(event.get("responses", {}) or {}).items():
        option_id = str(option_id)
        player_name = _clean_text(response_names.get(str(player_id))) or "Hero"

        if option_id == "__timeout__":
            outcomes.append({
                "player_id": str(player_id),
                "player_name": player_name,
                "option_id": option_id,
                "option_label": "NO REACTION",
                "result": "The split-second opportunity passes before you commit. You enter the next round a little rattled.",
                "tag": "hesitated",
                "success": False,
                "effect": deepcopy(event.get("failure_effect", {})),
                "effect_applied": False,
            })
            continue

        option = options_by_id.get(option_id)
        if option is None:
            continue

        success = bool(correct_option_id and option_id == correct_option_id)
        neutral = bool(
            not success and len(options_by_id) == 3
            and option_id == str(event.get("neutral_option_id", ""))
        )
        outcomes.append({
            "player_id": str(player_id),
            "player_name": player_name,
            "option_id": option_id,
            "option_label": _clean_text(option.get("label")),
            "result": (
                f"{_clean_text(option.get('description'))} "
                "You stay safe, but gain no ground."
                if neutral else _clean_text(
                    event.get("success_text" if success else "failure_text")
                )
            ),
            "tag": "qte_neutral" if neutral else ("qte_success" if success else "qte_failure"),
            "success": success,
            "effect": (
                {} if neutral else deepcopy(
                    event.get("success_effect" if success else "failure_effect", {})
                )
            ),
            "effect_applied": False,
        })

    if outcomes:
        joined = " ".join(
            (
                f"{item['player_name']} chose {item['option_label']} — "
                f"{'RIGHT' if item['success'] else 'NEUTRAL' if item['tag'] == 'qte_neutral' else 'WRONG'}. {item['result']}"
            )
            for item in outcomes
        )
        resolution = joined
    else:
        resolution = "The split-second moment passes without changing the course of the scene."

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


def apply_micro_event_outcome_effect(
    *,
    character: Character,
    room_code: str,
    event: dict[str, Any],
    outcome: dict[str, Any],
) -> dict[str, Any] | None:
    """Apply the already-resolved QTE boon/bane for exactly one future round."""

    raw_effect = outcome.get("effect")
    if not isinstance(raw_effect, dict):
        return None

    success = bool(outcome.get("success", False))
    effect = _sanitize_effect_spec(raw_effect, positive=success)
    stat = effect.get("modifier_stat")
    skill = effect.get("modifier_skill")
    modifier = int(effect.get("modifier_value", 0) or 0)
    if not modifier or bool(stat) == bool(skill):
        return None

    source_turn = int(event.get("created_from_turn", 0) or 0)
    player_id = str(outcome.get("player_id", "") or "hero")
    digest = sha256(
        f"{room_code}|{event.get('id')}|{player_id}|{modifier}|{stat}|{skill}".encode("utf-8")
    ).hexdigest()[:12]
    source_key = f"qte:{room_code}:{event.get('id')}:{player_id}"

    for existing in character.effects:
        if isinstance(existing, dict) and str(existing.get("source_key", "")) == source_key:
            outcome["effect_applied"] = True
            return existing

    active_finite = [
        item
        for item in character.effects
        if isinstance(item, dict)
        and item.get("active", True) is not False
        and str(item.get("permanence", "temporary") or "temporary").lower() != "permanent"
        and (item.get("stat_modifiers") or item.get("skill_modifiers"))
    ]
    if len(active_finite) >= MAX_ACTIVE_FINITE_EFFECTS:
        active_finite.sort(
            key=lambda item: (
                int(item.get("source_turn", 0) or 0),
                str(item.get("source_key", "")),
            )
        )
        active_finite[0]["active"] = False

    persistent = {
        "effect_id": f"qte_{digest}",
        "source_key": source_key,
        "name": effect["name"],
        "description": effect["description"],
        "category": "qte_boon" if modifier > 0 else "qte_bane",
        "source_room_code": room_code,
        "source_turn": source_turn,
        "active": True,
        "stat_modifiers": {str(stat): modifier} if stat else {},
        "skill_modifiers": {str(skill): modifier} if skill else {},
        "story_permanence": "temporary",
        "permanence": "temporary",
        "remaining_checks": None,
        "remaining_turns": QTE_EFFECT_DURATION_TURNS,
    }
    character.effects.append(persistent)
    outcome["effect_applied"] = True
    return persistent
