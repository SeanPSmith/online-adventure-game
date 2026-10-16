"""Advisory narrative-momentum signals for the Story Director.

These are *not* success/failure mechanics and must never veto a playable turn.
The Director owns prose; the server owns rolls, progress bookkeeping, and
whether a previous turn has committed. The signals are deliberately compact
so a long adventure doesn't grow the provider's context window indefinitely.
"""
from __future__ import annotations

from typing import Any


def _text(value: Any) -> str:
    return " ".join(str(value or "").casefold().split())


def _items(value: Any) -> set[str]:
    if not isinstance(value, list):
        return set()
    return {_text(item) for item in value if isinstance(item, str) and _text(item)}


def _positions(value: Any) -> dict[str, str]:
    if not isinstance(value, list):
        return {}
    result: dict[str, str] = {}
    for item in value:
        if isinstance(item, dict):
            player = _text(item.get("player_name"))
            location = _text(item.get("location"))
            if player and location:
                result[player] = location
    return result


def measure_scene_progress(
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    *,
    before_title: str = "",
    after_title: str = "",
) -> dict[str, Any]:
    """Observe durable state changes without conflating fresh prose with progress.

    No previous state means 'unknown', never 'stalled'. Rewording a title alone
    doesn't prove a resolved obstacle. A single unchanged scene is permitted:
    longer conversations or an unfolding climax sometimes require it.
    """
    if not isinstance(before, dict) or not before or not isinstance(after, dict) or not after:
        return {"level": "unknown", "evidence": []}

    evidence: list[str] = []
    if _text(before.get("current_goal")) != _text(after.get("current_goal")):
        evidence.append("goal_changed")
    if _text(before.get("story_phase")) != _text(after.get("story_phase")):
        evidence.append("phase_changed")

    before_locations = _positions(before.get("player_positions"))
    after_locations = _positions(after.get("player_positions"))
    if before_locations and after_locations and before_locations != after_locations:
        evidence.append("party_moved")

    # Progress markers are append/replace friendly. We don't interpret a
    # newly worded summary as proof of a mechanically successful action.
    for key, label in (
        ("resolved_threads", "thread_resolved"),
        ("closed_opportunities", "route_closed"),
        ("known_facts", "discovery"),
        ("active_advantages", "advantage_changed"),
    ):
        old, new = _items(before.get(key)), _items(after.get(key))
        if new - old:
            evidence.append(label)

    if evidence:
        return {"level": "substantive", "evidence": evidence[:6]}

    if _text(before_title) != _text(after_title):
        return {"level": "scene_shift", "evidence": ["scene_title_changed"]}

    return {"level": "low", "evidence": []}


def _check_outcomes(turn_facts: dict[str, Any] | None) -> dict[str, int]:
    counts = {"success": 0, "failure": 0, "critical_success": 0, "critical_failure": 0}
    if not isinstance(turn_facts, dict):
        return counts
    results = turn_facts.get("results", [])
    if not isinstance(results, list):
        return counts
    for entry in results:
        if not isinstance(entry, dict):
            continue
        check = entry.get("check")
        if isinstance(check, dict):
            outcome = _text(check.get("outcome"))
            if outcome in counts:
                counts[outcome] += 1
    return counts


def director_momentum_context(
    history: list[dict[str, Any]] | None,
    turn_facts: dict[str, Any] | None,
) -> dict[str, Any]:
    """Bounded feedback for the *next* generation request, never a gameplay roll.

    Old saved histories don't have a progress field; treat them as unknown so
    upgrading mid-adventure cannot manufacture a spurious stall.
    """
    streak = 0
    for entry in reversed((history or [])[-4:]):
        if not isinstance(entry, dict):
            break
        progress = entry.get("narrative_progress")
        if not isinstance(progress, dict) or progress.get("level") != "low":
            break
        streak += 1

    outcomes = _check_outcomes(turn_facts)
    total_successes = outcomes["success"] + outcomes["critical_success"]
    total_failures = outcomes["failure"] + outcomes["critical_failure"]

    guidance = "continue_with_changed_stakes"
    if streak >= 2:
        guidance = "mandatory_macro_advance"
    elif streak == 1 and total_successes:
        guidance = "bank_success_and_leave_solved_obstacle"
    elif streak == 1:
        guidance = "avoid_replaying_same_obstacle"
    elif total_successes:
        guidance = "pay_off_success_and_progress"
    elif total_failures:
        guidance = "fail_forward_with_new_cost_or_route"

    return {
        "consecutive_low_progress_scenes": streak,
        "current_turn_checks": outcomes,
        "direction": guidance,
    }
