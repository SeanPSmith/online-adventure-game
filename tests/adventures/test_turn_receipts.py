"""Server authority and recoverability of dice revealed after the Arcade."""

from copy import deepcopy

from app.adventures.bootstrap import register_builtin_adventures
from app.adventures.content.first_light import FIRST_LIGHT
from app.game.session import GameSessionManager
from tests.support import PROJECT_ROOT


def test_last_committed_receipt_survives_room_snapshot_restore() -> None:
    register_builtin_adventures()
    manager = GameSessionManager()
    original = manager.create("RECEIPT01", adventure_id=FIRST_LIGHT.id)
    frozen = {"resolved_turn_number": 1, "results": [
        {"player_id": "p1", "check": {"roll": 17, "total": 21, "outcome": "success"}},
    ]}
    original.last_turn_result = deepcopy(frozen)

    restored = manager.restore_session("RECEIPT02", {
        "adventure_id": original.adventure_id,
        "scene_id": original.scene_id,
        "turn_number": 2,
        "last_turn_result": deepcopy(original.last_turn_result),
    })
    assert restored.last_turn_result == frozen
    assert restored.last_turn_result is not original.last_turn_result
    restored.last_turn_result["results"][0]["check"]["roll"] = 1
    assert original.last_turn_result["results"][0]["check"]["roll"] == 17


def test_pending_and_final_receipts_are_wired_to_durable_game_state() -> None:
    main = (PROJECT_ROOT / "app/main.py").read_text()
    store = (PROJECT_ROOT / "app/persistence/store.py").read_text()
    live = (PROJECT_ROOT / "frontend/src/state/useLiveAdventure.ts").read_text()
    assert '"last_turn_result":' in store
    assert '"last_turn_result": (' in main
    assert '"pending_turn_receipt": (' in main
    assert '"resolved_turn_number": session.turn_number' in main
    assert '"preliminary": True' in main
    assert 'session.last_turn_result = {' in main
    assert '"resolved_turn_number": resolved_turn_number' in main
    assert 'setTurnReceipt(payload.pending_turn_receipt)' in live


def test_scene_reveal_waits_for_turn_theater_to_release_it() -> None:
    page = (PROJECT_ROOT / "frontend/src/pages/game/AdventurePage.tsx").read_text()
    result = (PROJECT_ROOT / "frontend/src/features/adventure/TurnResolutionTheater.tsx").read_text()
    # Turn theater owns scene release. Reveal remains enabled until the
    # narrator actually starts supplying a spoken cue.
    assert 'wordRevealEnabled={storyPreferences.wordReveal}' in page
    assert 'narration.cue?.kind === "story"' in page
    # Only intermediate visual dice faces are random in the browser; the
    # authoritative check is supplied by the server, never calculated here.
    assert "Math.random()" not in result
    assert 'setDisplayRoll(cosmeticD20Face())' in result
    assert 'setDisplayRoll(check.roll)' in result
    assert "[turnIdentity, results.length]" in result
    assert 'theater.chapterReleased && scene?.body' in page
