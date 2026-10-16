"""Pass 63.12: outcomes must bank real stakes and leave a comeback route."""
from __future__ import annotations

from inspect import getsource

from app.game.outcome_stakes import bank_outcome_stakes, outcome_contracts


def _result(outcome="success", *, roll=14, total=19, dc=14, risk="high", player="Mara"):
    return {
        "player_name": player, "player_id": player.lower(),
        "choice_label": "Secure the wreck's signal beacon",
        "choice_risk_level": risk,
        "possible_gains": ["Working distress beacon", "Captain's sealed chart"],
        "possible_costs": ["The beacon is swept out to sea", "The tide cuts off the safe trail"],
        "check": {"outcome": outcome, "roll": roll, "total": total, "difficulty": dc},
    }


def _state():
    return {"active_advantages": [], "recent_consequences": [], "unresolved_threads": [], "important_items": []}


def test_success_banks_a_specific_offered_gain_not_a_generic_good_feeling():
    facts = {"results": [_result()]}
    contracts = outcome_contracts(facts)
    assert contracts[0]["gain_due"] == "Working distress beacon"
    assert contracts[0]["extra_gain_due"] is None
    assert contracts[0]["cost_due"] is None
    state = bank_outcome_stakes(_state(), contracts)
    assert state["active_advantages"] == ["Mara earned: Working distress beacon"]
    assert state["recent_consequences"] == []


def test_exceptional_hard_success_earns_distinct_bonus_without_changing_roll():
    result = _result("critical_success", roll=20, total=27)
    facts = {"results": [result]}
    contracts = outcome_contracts(facts)
    assert contracts[0]["exceptional"]
    assert contracts[0]["extra_gain_due"] == "Captain's sealed chart"
    state = bank_outcome_stakes(_state(), contracts)
    assert len(state["active_advantages"]) == 2
    assert result["check"]["roll"] == 20
    assert result["check"]["total"] == 27


def test_roll_above_dc_with_a_strong_margin_is_exceptional_not_arbitrary_probability():
    assert outcome_contracts({"results": [_result(roll=17, total=21, dc=14)]})[0]["exceptional"]
    assert not outcome_contracts({"results": [_result(roll=17, total=15, dc=14)]})[0]["exceptional"]
    assert outcome_contracts({"results": [_result(roll=19, total=19, dc=14)]})[0]["exceptional"]


def test_low_risk_cannot_farm_second_gains_on_every_critical():
    contracts = outcome_contracts({"results": [_result("critical_success", roll=20, risk="low")]})
    assert contracts[0]["exceptional"]
    assert contracts[0]["extra_gain_due"] is None


def test_failed_action_costs_something_and_preserves_next_turn_recovery():
    contracts = outcome_contracts({"results": [_result("failure", roll=5, total=8)]})
    assert contracts[0]["cost_due"] == "The beacon is swept out to sea"
    assert contracts[0]["recovery_due"]
    state = bank_outcome_stakes(_state(), contracts)
    consequence = state["recent_consequences"][0]
    assert "beacon is swept out to sea" in consequence["description"]
    assert consequence["health_delta"] == 0
    assert consequence["modifier_value"] == 0
    assert "new approach" in state["unresolved_threads"][0].lower()
    assert "cost remains real" in state["unresolved_threads"][0]
    assert not state["active_advantages"]


def test_critical_failure_scales_with_stated_risk_not_arbitrary_death():
    high = outcome_contracts({"results": [_result("critical_failure", roll=1)]})
    low = outcome_contracts({"results": [_result("critical_failure", roll=1, risk="low")]})
    assert high[0]["extra_cost_due"] == "The tide cuts off the safe trail"
    assert low[0]["extra_cost_due"] is None
    state = bank_outcome_stakes(_state(), high)
    assert len(state["recent_consequences"]) == 2
    assert all(item["health_delta"] == 0 for item in state["recent_consequences"])


def test_multiple_players_get_independent_outcomes():
    facts = {"results": [_result(player="Mara"), _result("failure", player="Jules")]}
    state = bank_outcome_stakes(_state(), outcome_contracts(facts))
    assert any("Mara earned" in x for x in state["active_advantages"])
    assert any("Jules" in x["description"] for x in state["recent_consequences"])


def test_banking_twice_is_idempotent_and_does_not_mutate_director_output():
    first = _state()
    contracts = outcome_contracts({"results": [_result("failure")]})
    once = bank_outcome_stakes(first, contracts)
    twice = bank_outcome_stakes(once, contracts)
    assert twice == once
    assert first == _state()


def test_adventure_completion_does_not_open_future_recovery_thread():
    contracts = outcome_contracts({"results": [_result("failure")]})
    state = bank_outcome_stakes(_state(), contracts, completed=True)
    assert state["recent_consequences"]
    assert not state["unresolved_threads"]


def test_legacy_and_unchecked_turns_work_without_fabricating_stakes():
    assert outcome_contracts({"results": [{"check": {"outcome": "success"}}]}) == []
    assert outcome_contracts({"results": [{"check": None}, "bad", {"check": {"outcome": "unknown"}}]}) == []
    assert outcome_contracts(None) == []


def test_director_and_server_use_frozen_stakes_instead_of_rng_guessing():
    from app.game.session import GameSessionManager
    from app.generation.director import SYSTEM_INSTRUCTIONS, OpenAIRuntimeDirector
    resolve_source = getsource(GameSessionManager.resolve_turn)
    commit_source = getsource(GameSessionManager.commit_director_turn)
    director_source = getsource(OpenAIRuntimeDirector.advance)
    assert '"possible_gains": list(choice.possible_gains)' in resolve_source
    assert '"possible_costs": list(choice.possible_costs)' in resolve_source
    assert 'outcome_contracts(canonical_turn_facts)' in commit_source
    assert 'bank_outcome_stakes(' in commit_source
    assert '"outcome_stakes": outcome_contracts(' in director_source
    assert 'If recovery_due' in SYSTEM_INSTRUCTIONS
    assert 'extra_gain_due' in SYSTEM_INSTRUCTIONS


def test_committed_turn_banks_reward_and_keeps_momentum_measurement_honest():
    from app.game.session import GameSessionManager
    from tests.director.test_runtime import DirectorRuntimeSessionTests

    fixture = DirectorRuntimeSessionTests(methodName="test_director_session_detected")
    fixture.setUp()
    manager: GameSessionManager = fixture.manager
    session = fixture.session
    session.story_state = {
        "current_goal": "Reach the vessel", "story_phase": "escalation",
        "player_positions": [], "known_facts": [], "resolved_threads": [],
        "closed_opportunities": [], "active_advantages": [],
        "recent_consequences": [], "unresolved_threads": [],
    }
    old_state = dict(session.story_state)
    facts = {"results": [_result("critical_success", roll=20, total=28)]}
    manager.commit_director_turn(
        "ABC123",
        turn_facts=facts,
        director_output={
            "title": "THE SAME BEACH",
            "scene_body": "The beach still stretches ahead. The same obstacle remains.",
            "choices": ["Wait", "Go", "Look"],
            "resolution_narration": "The roll succeeds.",
            "memory_summary": "The beach is unchanged.",
            "story_state": old_state,
            "completed": False,
            "director_meta": {},
        },
    )
    assert "Working distress beacon" in " ".join(session.story_state["active_advantages"])
    assert "Captain's sealed chart" in " ".join(session.story_state["active_advantages"])
    assert session.director_history[-1]["outcome_stakes"][0]["exceptional"]
    assert session.director_history[-1]["narrative_progress"]["level"] in {"low", "scene_shift"}
    assert facts["results"][0]["check"]["roll"] == 20


def test_committed_failure_banks_cost_and_future_comeback():
    from app.game.session import GameSessionManager
    from tests.director.test_runtime import DirectorRuntimeSessionTests

    fixture = DirectorRuntimeSessionTests(methodName="test_director_session_detected")
    fixture.setUp()
    manager: GameSessionManager = fixture.manager
    session = fixture.session
    manager.commit_director_turn(
        "ABC123",
        turn_facts={"results": [_result("failure", roll=4, total=8)]},
        director_output={
            "title": "BEACH AFTERMATH",
            "scene_body": "The boat has capsized. The current runs north.",
            "choices": ["Look for supplies", "Swim to safety", "Signal the shore"],
            "resolution_narration": "The beacon sinks.",
            "memory_summary": "Beacon lost.",
            "story_state": _state(),
            "completed": False,
            "director_meta": {},
        },
    )
    assert any("beacon is swept out" in entry["description"] for entry in session.story_state["recent_consequences"])
    assert any("Recovery opportunity" in entry for entry in session.story_state["unresolved_threads"])
