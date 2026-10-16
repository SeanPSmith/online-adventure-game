"""Turn outcome contracts: honor displayed choice stakes without modifying dice.

Contracts describe *fictional* gains and losses from authoritative check
results. They never grant currency, inventory, HP, or mechanical modifiers; those
remain under existing server-owned progression rules.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any


def _stakes(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []
    return [str(item).strip()[:160] for item in value if str(item).strip()][:3]


def outcome_contracts(turn_facts: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Derive bounded promises from already-frozen, authoritative turns."""
    contracts: list[dict[str, Any]] = []
    results = (turn_facts or {}).get("results", [])
    if not isinstance(results, list):
        return contracts
    for result in results:
        if not isinstance(result, dict):
            continue
        check = result.get("check")
        if not isinstance(check, dict):
            continue  # Unchecked choices must not invent a rolled victory/loss.
        outcome = str(check.get("outcome") or "").lower()
        if outcome not in {"success", "critical_success", "failure", "critical_failure"}:
            continue
        gains = _stakes(result.get("possible_gains"))
        costs = _stakes(result.get("possible_costs"))
        if not gains and not costs:
            continue  # Old frozen turns may predate stakes metadata.
        roll = int(check.get("roll", 0) or 0)
        total = int(check.get("total", 0) or 0)
        dc = int(check.get("difficulty", 0) or 0)
        success = outcome in {"success", "critical_success"}
        exceptional = bool(success and (outcome == "critical_success" or (roll >= 18 and dc > 0 and total >= dc) or (dc > 0 and total >= dc + 7)))
        risk = str(result.get("choice_risk_level") or "moderate").lower()
        major_risk = risk in {"high", "severe", "extreme"}
        gain = gains[0] if success and gains else None
        extra = gains[1] if exceptional and major_risk and len(gains) > 1 else None
        cost = costs[0] if not success and costs else None
        extra_cost = costs[1] if outcome == "critical_failure" and major_risk and len(costs) > 1 else None
        contracts.append({
            "player_name": str(result.get("player_name") or "Hero")[:80],
            "player_id": str(result.get("player_id") or "")[:80],
            "choice": str(result.get("choice_label") or "action")[:160],
            "outcome": outcome,
            "risk_level": risk,
            "exceptional": exceptional,
            "gain_due": gain,
            "extra_gain_due": extra,
            "cost_due": cost,
            "extra_cost_due": extra_cost,
            "recovery_due": bool(not success and cost),
        })
    return contracts


def bank_outcome_stakes(
    story_state: dict[str, Any],
    contracts: list[dict[str, Any]],
    *,
    completed: bool = False,
) -> dict[str, Any]:
    """Safeguard story-state stakes if the Director omitted a promised payoff.

    Existing authored state takes precedence. This adds only short fiction-state
    records; never manufactures an item or adjusts any mechanical Hero field.
    """
    state = deepcopy(story_state)

    def add(key: str, value: Any, *, limit: int = 6, match: str | None = None) -> None:
        old = state.get(key)
        items = list(old) if isinstance(old, list) else []
        needle = str(match or value).strip().casefold()
        if not any(needle in str(item).casefold() for item in items):
            items.append(value)
        state[key] = items[-limit:]

    for contract in contracts:
        hero = contract["player_name"]
        for key in ("gain_due", "extra_gain_due"):
            gain = contract.get(key)
            if gain:
                add("active_advantages", f"{hero} earned: {gain}", match=gain)
        for key in ("cost_due", "extra_cost_due"):
            cost = contract.get(key)
            if not cost:
                continue
            old = state.get("recent_consequences", [])
            existing = old if isinstance(old, list) else []
            if not any(isinstance(item, dict) and cost.casefold() in str(item.get("description", "")).casefold() for item in existing):
                add("recent_consequences", {
                    "effect_name": "STORY SETBACK",
                    "description": f"{hero} incurred: {cost}",
                    "affected": hero,
                    "permanence": "lasting",
                    "modifier_stat": None,
                    "modifier_skill": None,
                    "modifier_value": 0,
                    "health_delta": 0,
                }, match=f"{hero} incurred: {cost}")
            if contract.get("recovery_due") and not completed:
                # Keeps the next Director turn accountable for a comeback, not
                # an automatic undo. The cost persists until fiction resolves it.
                add("unresolved_threads", f"Recovery opportunity for {hero}: find a NEW approach to overcome {cost}; the cost remains real.", limit=8, match=f"for {hero}: find a NEW approach to overcome {cost};")
    return state
