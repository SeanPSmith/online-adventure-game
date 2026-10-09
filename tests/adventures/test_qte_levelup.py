from __future__ import annotations
from tests.support import PROJECT_ROOT

from datetime import datetime, timezone
from pathlib import Path

from app.characters.effects import decay_finite_effect_turns
from app.characters.models import Character
from app.game.micro_events import (
    apply_micro_event_outcome_effect,
    build_micro_event,
    public_micro_event,
    resolve_micro_event,
)
from app.generation.director_schema import DirectorStoryTurnDraft


ROOT = PROJECT_ROOT
FRONTEND = ROOT / "frontend" / "src"


def read(relative: str) -> str:
    return (FRONTEND / relative).read_text(encoding="utf-8")


def authored_qte() -> dict:
    return {
        "kind": "danger_beat",
        "title": "THE CATWALK GIVES",
        "story_context": (
            "The rusted catwalk folds under Athena while the intact service platform sits one stride to her right."
        ),
        "prompt": "The metal drops under your left foot. Where do you throw your weight?",
        "options": [
            {
                "id": "rail",
                "label": "GRAB THE RAIL",
                "description": "Clamp onto the loose left rail and try to ride the collapsing section down.",
            },
            {
                "id": "platform",
                "label": "JUMP RIGHT",
                "description": "Push off the failing grate and land on the intact service platform to your right.",
            },
            {
                "id": "freeze",
                "label": "FREEZE",
                "description": "Flatten your stance and hope the remaining bolts hold your weight.",
            },
        ],
        "correct_option_id": "platform",
        "success_text": "You jump with the collapse instead of fighting it and land hard on the intact platform.",
        "failure_text": "You commit to the failing section and lose precious balance before scrambling clear.",
        "success_effect": {
            "name": "QUICK FOOTED",
            "description": "The clean recovery leaves your footwork sharp for the next round.",
            "modifier_stat": "agility",
            "modifier_skill": None,
            "modifier_value": 1,
            "duration_turns": 1,
        },
        "failure_effect": {
            "name": "OFF BALANCE",
            "description": "The ugly recovery leaves your footing compromised for the next round.",
            "modifier_stat": "agility",
            "modifier_skill": None,
            "modifier_value": -1,
            "duration_turns": 1,
        },
    }


def hero(character_id: str, owner: str) -> Character:
    now = datetime.now(timezone.utc)
    return Character(
        character_id=character_id,
        owner_user_id=owner,
        name=character_id,
        created_at=now,
        updated_at=now,
    )


def test_story_schema_exposes_required_nullable_director_qte() -> None:
    schema = DirectorStoryTurnDraft.model_json_schema()
    assert "quick_event" in schema["required"]
    assert "quick_event" in schema["properties"]
    assert schema["properties"]["scene_body"]["maxLength"] == 1800


def test_authored_qte_commits_correct_answer_without_exposing_it() -> None:
    event = build_micro_event(
        room_code="PASS31",
        resolved_turn_number=3,
        scene_title="THE SERVICE GANTRY",
        scene_body="The catwalk starts to fold beneath Athena.",
        last_resolution="Athena forced the maintenance hatch open.",
        story_state={"current_goal": "Cross the gantry."},
        authored_event=authored_qte(),
    )

    assert event["correct_option_id"] == "platform"
    public = public_micro_event(event)
    assert public is not None
    assert "correct_option_id" not in public
    assert public["correct_option_label"] == ""
    assert public["odds_denominator"] == 3
    assert len(public["options"]) == 3


def test_qte_right_and_wrong_answers_apply_one_round_buff_and_nerf() -> None:
    event = build_micro_event(
        room_code="PASS31",
        resolved_turn_number=3,
        scene_title="THE SERVICE GANTRY",
        story_state={"current_goal": "Cross the gantry."},
        authored_event=authored_qte(),
    )
    event["responses"] = {
        "p1": "platform",
        "p2": "freeze",
    }

    history = resolve_micro_event(
        event=event,
        response_names={"p1": "Athena", "p2": "Chordy"},
    )
    outcomes = {item["player_id"]: item for item in history["outcomes"]}
    assert outcomes["p1"]["success"] is True
    assert outcomes["p2"]["success"] is False

    first = hero("hero-one", "user-one")
    second = hero("hero-two", "user-two")
    buff = apply_micro_event_outcome_effect(
        character=first,
        room_code="PASS31",
        event=event,
        outcome=outcomes["p1"],
    )
    nerf = apply_micro_event_outcome_effect(
        character=second,
        room_code="PASS31",
        event=event,
        outcome=outcomes["p2"],
    )

    assert buff is not None and buff["stat_modifiers"] == {"agility": 1}
    assert nerf is not None and nerf["stat_modifiers"] == {"agility": -1}
    assert buff["remaining_turns"] == 1
    assert nerf["remaining_turns"] == 1

    assert len(decay_finite_effect_turns(first)) == 1
    assert first.effects[-1]["active"] is False
    assert len(decay_finite_effect_turns(second)) == 1
    assert second.effects[-1]["active"] is False


def test_pass31_frontend_surfaces_qte_stakes_and_level_up_modal() -> None:
    qte = read("features/adventure/QuickEventModal.tsx")
    level = read("features/adventure/LevelUpModal.tsx")
    adventure = read("pages/game/AdventurePage.tsx")
    styles = read("styles/components.css")

    assert "1 RIGHT ANSWER IN" in qte
    assert 'key === "3"' in qte
    assert "RIGHT REACTION" in qte
    assert "WRONG REACTION" in qte
    assert "NEXT ROUND" in qte
    assert "qte-stakes" in qte
    assert "HERO ADVANCEMENT // CONGRATULATIONS" in level
    assert "REACHED LEVEL" in level
    assert "showLevelUp" in adventure
    assert "theater.phase === \"none\" && !showLevelUp" in adventure
    assert ".level-up-backdrop" in styles
    assert ".qte-options.has-3" in styles


def test_pass31_director_prompt_demands_grounded_novel_like_prose_and_scene_qtes() -> None:
    director = (ROOT / "app" / "generation" / "director.py").read_text(encoding="utf-8")

    assert "NOVEL-LIKE, GAME-READABLE STORY PRESENTATION" in director
    assert "Mystery is allowed. Confusing prose is not." in director
    assert "annex handler" in director
    assert "runtime.quick_event_requested" in director
    assert "Exactly ONE is correct" in director
    assert "duration_turns=1" in director
