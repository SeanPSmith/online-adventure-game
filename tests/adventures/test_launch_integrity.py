"""Regression checks for fatal endings, published arcade rotation and 3-way QTEs."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.arcade.store import ArcadePublicationStore
from app.game.fatal_outcome import reconcile_fatal_outcome
from app.game.micro_events import build_micro_event, public_micro_event, resolve_micro_event
from app.game.session import GameSessionManager
from app.generation.director import SYSTEM_INSTRUCTIONS


def _fatal_game():
    room = SimpleNamespace(players={"p1": SimpleNamespace(name="Rook")})
    session = SimpleNamespace(
        completed=False,
        pending_micro_event={"id": "should-not-run"},
        ending_label="",
        last_resolution="Rook escapes the dragon.",
        dynamic_scene={"title": "SAFE AT LAST", "body": "Rook walks unharmed into town.", "choices": [{"id": "keep_going"}]},
        story_state={"recent_consequences": []},
    )
    result = {"resolution": "Rook escapes the dragon.", "completed": False}
    updates = {"p1": {"died_this_turn": True, "death_record": {"cause": "The dragon's burning talons"}}}
    return room, session, result, updates


def test_fatal_damage_overrides_happy_scene_and_closes_solo_adventure():
    room, session, result, updates = _fatal_game()
    reconcile_fatal_outcome(
        room=room, session=session, progression_updates=updates,
        result=result, living_after_turn=False,
    )
    assert session.completed is True
    assert session.pending_micro_event is None
    assert result["completed"] is True
    assert result["ending_label"] == "THE HERO HAS FALLEN"
    assert session.dynamic_scene["choices"] == []
    assert "The dragon's burning talons" in session.dynamic_scene["body"]
    assert "walks unharmed" not in session.dynamic_scene["body"]
    assert "escapes the dragon" not in result["resolution"]
    assert session.last_resolution == result["resolution"]
    assert session.story_state["recent_consequences"][-1]["health_delta"] == 0


def test_survivor_continues_but_companion_death_enters_story():
    room, session, result, updates = _fatal_game()
    room.players["p2"] = SimpleNamespace(name="Mira")
    reconcile_fatal_outcome(
        room=room, session=session, progression_updates=updates,
        result=result, living_after_turn=True,
    )
    assert not session.completed
    assert "Rook falls" in result["resolution"]
    assert session.dynamic_scene["body"].startswith("Rook falls")
    assert session.dynamic_scene["choices"]


def _authored_qte():
    return {
        "kind": "danger_beat", "title": "THE FLOOD GATE",
        "story_context": "Water surges against the north gate and rocks the bridge.",
        "prompt": "The bridge dips. Choose a stance before the next wave.",
        "options": [
            {"id": "best", "label": "GRAB THE CHAIN", "description": "Anchor yourself to the iron chain."},
            {"id": "neutral", "label": "STEP BACK", "description": "Retreat to the bridge support."},
            {"id": "bad", "label": "JUMP INTO CURRENT", "description": "Leap into the deep current below."},
        ],
        "correct_option_id": "best",
        "success_text": "Your grip keeps you upright against the flood.",
        "failure_text": "The current knocks you across the bridge.",
        "success_effect": {"name":"STEADY", "modifier_stat":"agility", "modifier_value":1},
        "failure_effect": {"name":"STAGGERED", "modifier_stat":"agility", "modifier_value":-1},
    }


def test_three_way_qte_is_brief_hidden_and_roles_are_stable():
    roles = {}
    for index in range(24):
        event = build_micro_event(
            room_code=f"ROOM{index:03}", resolved_turn_number=3,
            scene_title="FLOOD", story_state={}, authored_event=_authored_qte(),
        )
        assert len(event["options"]) == 3
        assert event["neutral_option_id"] == "neutral"
        assert event["correct_option_id"] == "best"
        public = public_micro_event(event)
        assert "correct_option_id" not in public
        assert "neutral_option_id" not in public
        roles.setdefault(event["options"][0]["id"], 0)
        roles[event["options"][0]["id"]] += 1
        assert all(len(option["description"]) <= 90 for option in event["options"])
    assert len(roles) == 3, f"QTE first position never changed: {roles}"


def test_qte_neutral_costs_opportunity_not_status_effect():
    event = build_micro_event(
        room_code="NEUTRAL", resolved_turn_number=3,
        scene_title="FLOOD", story_state={}, authored_event=_authored_qte(),
    )
    event["responses"] = {"p1": "neutral"}
    result = resolve_micro_event(event=event, response_names={"p1": "Rook"})
    outcome = result["outcomes"][0]
    assert outcome["tag"] == "qte_neutral"
    assert outcome["success"] is False
    assert outcome["effect"] == {}
    assert "Retreat to the bridge support" in outcome["result"]


def test_live_arcade_selector_pins_and_rotates_published_cabinets():
    mgr = GameSessionManager()
    # Built-in story is registered when session manager is imported.
    session = mgr.create("ARCR54", "old_chapel")
    published = ["bowling", "outlier", "war_cards", "hangman"]
    selected = [mgr.select_intermission_game("ARCR54", n, published) for n in range(1, 9)]
    assert set(selected[:4]) == set(published)
    assert selected[:4] == selected[4:]
    assert mgr.select_intermission_game("ARCR54", 2, ["pong"]) == selected[1]
    restored = mgr.restore_session("ARCR55", {
        "adventure_id": "old_chapel", "scene_id": "entry", "turn_number": 3,
        "intermission_game_selections": dict(session.intermission_game_selections),
    })
    assert restored.intermission_game_selections["2"] == selected[1]
    assert mgr.select_intermission_game("ARCR55", 2, ["pong"]) == selected[1]
    # Empty publication is intentional: no unapproved fallback may appear.
    empty = mgr.create("EMPTY54", "old_chapel")
    assert mgr.select_intermission_game("EMPTY54", 1, []) == "intermission_wait"


@pytest.mark.asyncio
async def test_admin_publication_updates_cached_live_rotation(tmp_path):
    store = ArcadePublicationStore(tmp_path / "publication.sqlite3")
    await store.initialize()
    assert "mahjong_match" not in store.live_game_ids()
    await store.set_live("mahjong_match", True, "admin")
    assert "mahjong_match" in store.live_game_ids()
    await store.set_live("mahjong_match", False, "admin")
    assert "mahjong_match" not in store.live_game_ids()


def test_director_has_story_scale_pacing_and_three_distinct_qte_roles():
    assert "lighting a campfire" in SYSTEM_INSTRUCTIONS
    assert "At least every TWO turns" in SYSTEM_INSTRUCTIONS
    assert "(1) BEST, (2) NEUTRAL" in SYSTEM_INSTRUCTIONS


def test_local_hero_progression_is_looked_up_by_player_id():
    from pathlib import Path
    page = Path("frontend/src/pages/game/AdventurePage.tsx").read_text()
    assert "live.lastTurn.hero_progression[live.playerId]" in page
    assert "update.character_id === characterId" in page
    assert "<HeroDeathModal" in page
    assert "!showLevelUp && !showDeath" in page


def test_fatal_notification_and_reward_ledger_are_visible_to_players():
    from pathlib import Path
    results = Path("frontend/src/features/adventure/TurnResolutionTheater.tsx").read_text()
    modal = Path("frontend/src/features/adventure/HeroDeathModal.tsx").read_text()
    assert "XP EARNED" in results
    assert "outcome_multiplier" in results
    assert "health_events" in results
    assert "THE HERO HAS FALLEN" in results
    assert "ACKNOWLEDGE THE FALL" in modal
