"""Pass 66.29: a finished room cannot trap a Hero in the live game."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_real_dashboard_exposes_completed_room_release():
    hall = source("frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx")
    parent = source("frontend/src/pages/game/GameHomePage.tsx")
    assert 'onLeaveAdventure: (roomCode: string, characterId: string) => void;' in hall
    assert 'onLeaveAdventure={leaveAdventure}' in parent
    assert 'onAbandonAdventure={abandonAdventure}' in parent
    assert 'item.completed ? "Release Hero" : "Exit this adventure"' in hall
    assert 'onLeaveAdventure(exitJourney.room_code, exitJourney.character_id)' in hall
    assert 'else onAbandonAdventure(exitJourney.room_code)' in hall
    assert '"Release a Hero"' in hall or 'Release a Hero' in hall
    assert 'disabled={!connected}' in hall


def test_old_completed_room_has_emergency_exit_without_a_finale_payload():
    adventure = source("frontend/src/pages/game/AdventurePage.tsx")
    assert 'live.game?.director_complete && !live.finale' in adventure
    assert 'completedRoomRecovery ?? (theater.chapterReleased ? finalePanel : null)' in adventure
    assert 'chapterReleased={theater.chapterReleased' in adventure
    assert '|| Boolean(completedRoomRecovery)' in adventure
    assert 'RELEASE HERO // RETURN TO HALL' in adventure
    assert 'END ADVENTURE HERE // RETURN TO HALL' in adventure


def test_reuse_completed_room_release_without_rewriting_room_ownership():
    main = source("app/main.py")
    assert 'async def release_finished_hero_before_new_room(' in main
    helper = main.split('async def release_finished_hero_before_new_room(', 1)[1].split('# =========================================================\n# CREATE ROOM', 1)[0]
    assert 'not old_session.completed' in helper
    assert 'member.user_id != user_id' in helper
    assert 'await leave_adventure(sid,' in helper
    assert main.count('await release_finished_hero_before_new_room(') == 2
    assert 'if not any(str(entry.get("room_code", "")).upper() == room_code' in main
    assert 'await store.record_completed_adventure(room_before, completed_session)' in main
    assert 'rooms.remove_character_from_room(' in main
    assert 'await store.delete_room(' in main


def test_does_not_replace_existing_auth_server_or_dice_theater():
    main = source("app/main.py")
    adventure = source("frontend/src/pages/game/AdventurePage.tsx")
    assert 'async def commit_completed_adventure_advancement(' in main
    assert 'build_adventure_finale_payload(' in main
    assert 'export function TurnResolutionTheater' in source("frontend/src/features/adventure/TurnResolutionTheater.tsx")
    assert 'hero={partyHeroes.find' in adventure
