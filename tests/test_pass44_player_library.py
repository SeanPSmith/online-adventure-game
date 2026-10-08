import asyncio
from types import SimpleNamespace
from app.persistence.store import SQLiteStateStore
from tests import test_adventure_history as history_fixture

def run(coro):
    return asyncio.run(coro)

def test_library_is_private_and_survives_restart(tmp_path):
    store = SQLiteStateStore(tmp_path / 'game.sqlite3')
    run(store.initialize())
    payload = {'room': {'code': 'ABC123', 'play_mode': 'solo', 'players': [
        {'user_id': 'owner', 'character_id': 'hero', 'name': 'Hero'}]},
        'game': {'adventure_id': 'story', 'turn_number': 4, 'last_resolution': 'A door opens.'}}
    store._save_room_snapshot_sync('ABC123', payload)
    restarted = SQLiteStateStore(tmp_path / 'game.sqlite3')
    assert run(restarted.list_player_library('stranger')) == {'active': [], 'completed': [], 'abandoned': []}
    active = run(restarted.list_player_library('owner'))['active'][0]
    assert active['character_id'] == 'hero'
    assert active['recap'] == 'A door opens.'
    assert active['updated_at']

def test_abandon_archive_preserves_party_without_resumable_room(tmp_path):
    store = SQLiteStateStore(tmp_path / 'game.sqlite3')
    run(store.initialize())
    room, session = history_fixture.AdventureHistoryTests().build_room_and_session()
    room.play_mode = 'coop'
    session.completed = False
    run(store.archive_abandoned_adventure(room, session))
    run(store.archive_abandoned_adventure(room, session))
    run(store.delete_room(room.code))
    for user in ['user-1', 'user-2']:
        library = run(store.list_player_library(user))
        assert not library['active']
        assert len(library['abandoned']) == 1
        assert len(library['abandoned'][0]['players']) == 2
        assert 'user_id' not in library['abandoned'][0]['players'][0]
    assert not run(store.list_player_library('stranger'))['abandoned']

def test_completed_library_deduplicates_same_account_heroes(tmp_path):
    store = SQLiteStateStore(tmp_path / 'game.sqlite3')
    run(store.initialize())
    room, session = history_fixture.AdventureHistoryTests().build_room_and_session()
    room.players['p2'].user_id = 'user-1'
    run(store.record_completed_adventure(room, session))
    assert len(run(store.list_player_library('user-1'))['completed']) == 1
    assert not run(store.list_player_library('user-2'))['completed']


def test_library_endpoint_rejects_unauthenticated_users(monkeypatch):
    from app import main
    from fastapi import HTTPException
    import pytest
    async def no_user(token):
        return None
    monkeypatch.setattr(main.auth_service, "authenticate_session", no_user)
    with pytest.raises(HTTPException) as error:
        run(main.player_adventure_library(None))
    assert error.value.status_code == 401


def test_endpoint_keeps_party_display_shape(monkeypatch):
    from app import main
    async def user(token):
        return SimpleNamespace(user_id="owner")
    async def library(user_id):
        return {"active": [{"room_code": "ABC123", "character_id": "hero", "players": [{"character_name": "Hero", "character_id": "hero"}]}], "completed": [], "abandoned": []}
    monkeypatch.setattr(main.auth_service, "authenticate_session", user)
    monkeypatch.setattr(main.store, "list_player_library", library)
    monkeypatch.setattr(main, "build_adventure_list", lambda user_id: [{"room_code": "ABC123", "character_id": "hero", "adventure_title": "Story", "players": [{"name": "Hero"}]}])
    row = run(main.player_adventure_library("token"))["active"][0]
    assert row["adventure_title"] == "Story"
    assert row["players"][0]["character_name"] == "Hero"
