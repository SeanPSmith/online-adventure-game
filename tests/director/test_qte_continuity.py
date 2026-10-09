"""QTE consequences should bridge the story, not inflate Director history."""

from pathlib import Path

from app.generation.director import SYSTEM_INSTRUCTIONS, _current_qte_consequences


def test_only_current_scene_reaction_enters_director_context() -> None:
    history = [
        {"created_from_turn": 3, "outcomes": [
            {"player_name": "A", "result": "A lands beside the hatch.",
             "tag": "qte_success", "option_label": "DUCK", "effect": {"modifier": 2}}
        ]},
        {"created_from_turn": 6, "outcomes": [
            {"player_name": "A", "result": "A grabs the ladder.", "tag": "qte_failure"}
        ]},
    ]
    assert _current_qte_consequences(history, 4) == [
        {"reactions": [{"hero": "A", "fictional_consequence": "A lands beside the hatch."}]}
    ]
    assert _current_qte_consequences(history, 5) == []
    assert _current_qte_consequences(history, 7) == [
        {"reactions": [{"hero": "A", "fictional_consequence": "A grabs the ladder."}]}
    ]


def test_coop_consequences_preserved_without_mechanical_receipt() -> None:
    history = [{"created_from_turn": 3, "outcomes": [
        {"player_name": "A", "result": "A ducks into cover.", "success": True},
        {"player_name": "B", "result": "B takes the impact.", "success": False},
    ]}]
    content = _current_qte_consequences(history, 4)
    assert len(content[0]["reactions"]) == 2
    assert "success" not in str(content)


def test_director_and_ui_connect_reaction_to_current_choices() -> None:
    assert "immediately following main choice menu" in SYSTEM_INSTRUCTIONS
    assert "AFTER either QTE success or failure" in SYSTEM_INSTRUCTIONS
    assert "not the situation before the QTE" in SYSTEM_INSTRUCTIONS
    page = Path("frontend/src/pages/game/AdventurePage.tsx").read_text()
    assert "item.created_from_turn) === turnNumber - 1" in page
    assert "qte-choice-consequence" in page
    assert page.index('className="qte-choice-consequence"') < page.index('className="choice-grid"')


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
