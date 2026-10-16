"""Pass 63.7: narrative pacing must be observable, bounded and non-blocking."""
from __future__ import annotations

from app.generation.director import SYSTEM_INSTRUCTIONS
from app.generation.momentum import director_momentum_context, measure_scene_progress
from app.game.session import GameSessionManager
from tests.director.test_runtime import DirectorRuntimeSessionTests


def _state(**changes):
    base = {
        "current_goal": "Open the iron gate",
        "story_phase": "escalation",
        "player_positions": [{"player_name": "Rook", "location": "The gate", "status": "Ready"}],
        "known_facts": ["The gate bears a crest"],
        "unresolved_threads": ["Who sealed the gate?"],
        "resolved_threads": [],
        "closed_opportunities": [],
        "active_advantages": [],
    }
    base.update(changes)
    return base


def test_no_existing_state_is_unknown_not_punished():
    assert measure_scene_progress({}, _state(), before_title="", after_title="Gate")["level"] == "unknown"
    assert measure_scene_progress(_state(), {}, before_title="Gate", after_title="Gate")["level"] == "unknown"


def test_same_goal_and_location_without_new_facts_is_low_progress():
    assert measure_scene_progress(_state(), _state(), before_title="Gate", after_title="Gate") == {
        "level": "low", "evidence": [],
    }


def test_scene_title_only_is_not_fake_objective_progress():
    result = measure_scene_progress(_state(), _state(), before_title="Gate", after_title="The Gate at Midnight")
    assert result["level"] == "scene_shift"
    assert "goal_changed" not in result["evidence"]


def test_time_shift_and_thread_resolution_are_substantive():
    next_scene = _state(
        player_positions=[{"player_name": "Rook", "location": "The palace", "status": "Ready"}],
        resolved_threads=["The gate was sealed by the queen"],
        closed_opportunities=["Reopen the gate quietly"],
    )
    result = measure_scene_progress(_state(), next_scene, before_title="Gate", after_title="Palace")
    assert result["level"] == "substantive"
    assert {"party_moved", "thread_resolved", "route_closed"}.issubset(result["evidence"])


def test_discovery_makes_progress_without_forcing_location_change():
    result = measure_scene_progress(
        _state(), _state(known_facts=["The gate bears a crest", "The steward forged the key"]),
        before_title="Gate", after_title="Gate",
    )
    assert result["level"] == "substantive"
    assert "discovery" in result["evidence"]


def test_two_low_progress_turns_require_macro_advance_in_next_prompt():
    history = [
        {"narrative_progress": {"level": "substantive"}},
        {"narrative_progress": {"level": "low"}},
        {"narrative_progress": {"level": "low"}},
    ]
    facts = {"results": [{"check": {"outcome": "critical_success"}}, {"check": {"outcome": "failure"}}]}
    result = director_momentum_context(history, facts)
    assert result["consecutive_low_progress_scenes"] == 2
    assert result["direction"] == "mandatory_macro_advance"
    assert result["current_turn_checks"]["critical_success"] == 1
    assert result["current_turn_checks"]["failure"] == 1
    assert "mandatory_macro_advance" in SYSTEM_INSTRUCTIONS


def test_single_low_scene_after_success_still_banks_result():
    result = director_momentum_context([{"narrative_progress": {"level": "low"}}], {
        "results": [{"check": {"outcome": "success"}}],
    })
    assert result["direction"] == "bank_success_and_leave_solved_obstacle"


def test_legacy_history_missing_marker_is_not_assumed_stalled():
    history = [
        {"story_state_summary": {"current_goal": "Same"}},
        {"narrative_progress": {"level": "low"}},
    ]
    result = director_momentum_context(history, {"results": []})
    assert result["consecutive_low_progress_scenes"] == 1


def test_missing_checks_and_invalid_results_are_safe():
    assert director_momentum_context([], {"results": [None, 2, {"check": None}]})["current_turn_checks"] == {
        "success": 0, "failure": 0, "critical_success": 0, "critical_failure": 0,
    }


def test_committed_session_persists_momentum_without_mutating_rolls():
    # Use the same test fixture as the existing AI Director runtime contract.
    fixture = DirectorRuntimeSessionTests(methodName="test_director_session_detected")
    fixture.setUp()
    manager: GameSessionManager = fixture.manager
    session = fixture.session
    session.story_state = _state()
    frozen = {"previous_scene_id": "opening", "results": [{"check": {"outcome": "success"}}]}
    manager.commit_director_turn(
        "ABC123",
        turn_facts=frozen,
        director_output={
            "title": "OPENING",
            "scene_body": "The same gate remains in front of the party. Nothing has moved yet.",
            "choices": ["Press again", "Talk to the guard", "Look for another entrance"],
            "resolution_narration": "The player wins the previous roll.",
            "memory_summary": "The gate remains closed.",
            "story_state": _state(),
            "completed": False,
            "director_meta": {},
        },
    )
    assert session.director_history[-1]["narrative_progress"]["level"] == "low"
    assert session.turn_archive[-1]["narrative_progress"]["level"] == "low"
    assert frozen["results"][0]["check"]["outcome"] == "success"


def test_new_signals_are_wired_into_generation_and_commits():
    from inspect import getsource
    from app.generation.director import OpenAIRuntimeDirector
    from app.game.session import GameSessionManager
    assert '"narrative_momentum"' in getsource(OpenAIRuntimeDirector.advance)
    assert '"narrative_progress"' in getsource(GameSessionManager.commit_director_turn)
