"""QTE consequences should bridge the story, not inflate Director history."""

from pathlib import Path

from app.generation.director import SYSTEM_INSTRUCTIONS, _current_qte_consequences


def test_qte_reactions_never_enter_director_story_context() -> None:
    history = [
        {"created_from_turn": 3, "outcomes": [
            {"player_name": "A", "result": "A lands beside the hatch.",
             "tag": "qte_success", "effect": {"modifier": 2}}
        ]},
        {"created_from_turn": 6, "outcomes": [
            {"player_name": "B", "result": "B grabs the ladder.", "tag": "qte_failure"}
        ]},
    ]
    assert _current_qte_consequences(history, 4) == []
    assert _current_qte_consequences(history, 5) == []
    assert _current_qte_consequences(history, 7) == []


def test_qte_fiction_and_next_chapter_are_independent() -> None:
    assert "not another story beat" in SYSTEM_INSTRUCTIONS
    assert "Never arrange scene_body to lead into the QTE" in SYSTEM_INSTRUCTIONS
    assert "temporary one-turn mechanical modifier" in SYSTEM_INSTRUCTIONS
    page = Path("frontend/src/pages/game/AdventurePage.tsx").read_text()
    assert 'qte-choice-consequence' not in page
    assert 'localReaction' not in page


def test_runtime_skips_missing_or_invalid_authored_qte_instead_of_generic_prompt() -> None:
    from app.game.micro_events import has_authored_scene_qte
    from app.game.session import GameSessionManager
    from tests.adventures.test_micro_events import MicroEventTests

    MicroEventTests.setUpClass()
    manager = GameSessionManager()
    session = manager.create("QTEST1", MicroEventTests.adventure_id)
    session.story_state = {"current_goal": "Follow the smoke."}
    assert not has_authored_scene_qte(None)
    assert not has_authored_scene_qte({"prompt": "Surprise!"})
    assert manager.maybe_schedule_micro_event(
        "QTEST1", resolved_turn_number=3, authored_event=None, require_authored=True
    ) is None
    assert manager.maybe_schedule_micro_event(
        "QTEST1", resolved_turn_number=3, authored_event={"prompt": "Surprise!"}, require_authored=True
    ) is None
    assert session.pending_micro_event is None
    # A legacy helper may still explicitly request a deterministic fallback.
    assert manager.maybe_schedule_micro_event("QTEST1", resolved_turn_number=3) is not None
