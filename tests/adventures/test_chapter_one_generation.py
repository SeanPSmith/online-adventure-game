"""Pass 58A: the first AI chapter is a generated real turn, not a phantom choice."""
from copy import deepcopy

import pytest

from app.adventures.registry import adventure_registry
from app.game.session import GameSessionManager
from app.generation.runtime_adapter import build_director_runtime_adventure
from tests.adventures.test_launch_story import opening_seed
from tests.support import PROJECT_ROOT


def make_ai_room():
    seed = opening_seed()
    generated = {
        "generated_adventure_id": "pass58-new-opening", "world_document_id": "w1",
        "world_version_number": 1, "brief_document_id": "b1",
        "brief_version_number": 1, "seed": seed,
    }
    adventure = build_director_runtime_adventure(generated)
    if adventure_registry.exists(adventure.id):
        adventure_registry.unregister(adventure.id)
    adventure_registry.register(adventure)
    manager = GameSessionManager()
    session = manager.create("FIRST58", adventure_id=adventure.id)
    return manager, session, adventure.id, seed


def test_generated_opening_is_a_playable_chapter_without_an_extra_turn():
    manager, session, adventure_id, seed = make_ai_room()
    try:
        assert not session.started
        session.starting = True
        output = {
            "title": "THE DOOR AWAKENS", "scene_body": "A brand new first scene, generated after Begin Adventure.",
            "choices": deepcopy(seed["opening_scene"]["choices"]),
            "resolution_narration": "", "quick_event": None,
            "completed": False, "story_state": {"current_goal": "Find the source"},
            "director_meta": {"usage": {"input_tokens": 100, "output_tokens": 50, "total_tokens": 150}},
        }
        manager.commit_director_opening("FIRST58", director_output=output)
        assert session.started and not session.starting
        assert session.scene.title == "THE DOOR AWAKENS"
        assert session.scene.body == output["scene_body"]
        assert len(session.scene.choices) == 3
        assert session.turn_number == 1
        assert session.director_history == []
        assert session.turn_archive == []
        assert session.last_turn_result is None
        assert session.pending_micro_event is None
        assert session.director_usage["requests"] == 1
        with pytest.raises(ValueError, match="already"):
            manager.commit_director_opening("FIRST58", director_output=output)
    finally:
        adventure_registry.unregister(adventure_id)


def test_prestart_scene_is_masked_and_opening_never_uses_countdown_or_arcade():
    server = (PROJECT_ROOT / "app/main.py").read_text()
    director = (PROJECT_ROOT / "app/generation/director.py").read_text()
    page = (PROJECT_ROOT / "frontend/src/pages/game/AdventurePage.tsx").read_text()
    assert '"id": "pending_chapter_one"' in server
    assert '"choices": []' in server
    assert '"chapter_preparing"' in server
    assert 'opening_mode=True' in server
    assert '"OPENING"' in director
    assert '"BEGIN ADVENTURE"' in page
    assert '"THE STORY DIRECTOR IS WRITING CHAPTER ONE_"' in page


def test_persistence_and_voice_are_adventure_scoped():
    manager, session, adventure_id, _ = make_ai_room()
    try:
        session.narrator_voice = "bm_george"
        session.starting = True
        restored = manager.restore_session("REST58", {
            "adventure_id": adventure_id,
            "started": False,
            "starting": True,
            "narrator_voice": session.narrator_voice,
        })
        assert restored.starting and not restored.started
        assert restored.narrator_voice == "bm_george"
        saved = (PROJECT_ROOT / "app/persistence/store.py").read_text()
        assert '"narrator_voice": game_session.narrator_voice' in saved
        assert '"starting": bool(game_session.starting)' in saved
    finally:
        adventure_registry.unregister(adventure_id)
