import asyncio
from datetime import datetime, timezone
from itertools import product
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from app.adventures.bootstrap import register_builtin_adventures
from app.adventures.content.first_light import FIRST_LIGHT
from app.characters.models import Character, Stat, Skill
from app.game.session import GameSessionManager
from app.persistence.store import SQLiteStateStore


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize('party_size', [1, 2])
@pytest.mark.parametrize('route', list(product(range(2), repeat=3)))
def test_every_starter_route_finishes_without_ai(party_size, route, tmp_path):
    register_builtin_adventures()
    manager = GameSessionManager()
    session = manager.create('FIRST1', adventure_id=FIRST_LIGHT.id)
    session.started = True
    now = datetime.now(timezone.utc)
    heroes = {f'p{i}': Character(character_id=f'h{i}', owner_user_id=f'u{i}', name=f'Hero {i}',
               created_at=now, updated_at=now, stats={s: 1 for s in Stat}, skills={s: 0 for s in Skill}) for i in range(party_size)}
    players = {key: SimpleNamespace(player_id=key, user_id=hero.owner_user_id,
               character_id=hero.character_id, name=hero.name, is_host=key == 'p0') for key, hero in heroes.items()}
    assert not session.is_ai_directed
    for turn, index in enumerate(route):
        choice = session.scene.choices[index]
        for key in players:
            manager.submit_choice('FIRST1', key, choice.id)
        result = manager.resolve_turn('FIRST1', players, heroes)
        assert result['completed'] == (turn == 2)
        assert manager.maybe_schedule_micro_event('FIRST1', resolved_turn_number=turn + 1) is None
    assert session.scene_id == 'home'
    assert session.ending_label == 'A LIGHT BROUGHT HOME'
    assert session.director_usage['requests'] == 0
    assert session.pending_turn_facts is None
    assert len(session.turn_archive) == 3
    with pytest.raises(ValueError, match='complete'):
        manager.submit_choice('FIRST1', 'p0', 'knock')
    store = SQLiteStateStore(tmp_path / 'game.sqlite3')
    run(store.initialize())
    run(store.record_completed_adventure(SimpleNamespace(code='FIRST1', play_mode='solo' if party_size == 1 else 'coop', players=players), session))
    story = run(store.list_player_library('u0'))['completed'][0]
    assert story['world_title'] == 'LANTERN HARBOR'
    assert len(story['turn_history']) == 3
    assert 'fishing boat answers' in story['final_resolution']


def test_onboarding_skip_is_account_scoped_and_durable(tmp_path):
    store = SQLiteStateStore(tmp_path / 'game.sqlite3')
    run(store.initialize())
    assert not run(store.onboarding_dismissed('new'))
    run(store.dismiss_onboarding('new'))
    restarted = SQLiteStateStore(tmp_path / 'game.sqlite3')
    assert run(restarted.onboarding_dismissed('new'))
    assert not run(restarted.onboarding_dismissed('other'))


def test_onboarding_api_uses_history_and_requires_auth(monkeypatch):
    from app import main
    async def no_user(token): return None
    monkeypatch.setattr(main.auth_service, 'authenticate_session', no_user)
    with pytest.raises(HTTPException) as error:
        run(main.player_onboarding(None))
    assert error.value.status_code == 401
    async def user(token): return SimpleNamespace(user_id='owner')
    async def not_dismissed(user_id): return False
    async def empty(user_id): return {'active': [], 'completed': [], 'abandoned': []}
    monkeypatch.setattr(main.auth_service, 'authenticate_session', user)
    monkeypatch.setattr(main.store, 'onboarding_dismissed', not_dismissed)
    monkeypatch.setattr(main.store, 'list_player_library', empty)
    assert run(main.player_onboarding('token'))['show_guide']
    async def played(user_id): return {'active': [], 'completed': [{'history_id': 'story'}], 'abandoned': []}
    monkeypatch.setattr(main.store, 'list_player_library', played)
    assert not run(main.player_onboarding('token'))['show_guide']
    request = Request({'type': 'http', 'headers': []})
    with pytest.raises(HTTPException) as error:
        run(main.dismiss_player_onboarding(request, 'token'))
    assert error.value.status_code == 403

@pytest.mark.parametrize('mode', ['solo', 'coop'])
def test_room_creation_preserves_requested_party_mode(monkeypatch, mode):
    from app import main
    from app.game.rooms import RoomManager
    register_builtin_adventures()
    room_manager = RoomManager()
    sessions = GameSessionManager()
    emitted = []
    async def user(sid): return SimpleNamespace(user_id='owner')
    async def hero(sid, user, data): return SimpleNamespace(character_id='hero', name='Hero')
    async def noop(*args, **kwargs): pass
    async def emit(event, payload, **kwargs): emitted.append((event, payload))
    monkeypatch.setattr(main, 'require_socket_user', user)
    monkeypatch.setattr(main, 'require_owned_character', hero)
    monkeypatch.setattr(main, 'detach_active_view', noop)
    monkeypatch.setattr(main, 'persist_room_state', noop)
    monkeypatch.setattr(main, 'broadcast_room_state', noop)
    monkeypatch.setattr(main, 'broadcast_game_state', noop)
    monkeypatch.setattr(main, 'refresh_adventure_lists', noop)
    monkeypatch.setattr(main.sio, 'enter_room', noop)
    monkeypatch.setattr(main.sio, 'emit', emit)
    monkeypatch.setattr(main, 'rooms', room_manager)
    monkeypatch.setattr(main, 'game_sessions', sessions)
    run(main.create_room('socket', {'character_id': 'hero', 'adventure_id': 'first_light', 'play_mode': mode}))
    payload = next(payload for event, payload in emitted if event == 'room_joined')
    room = room_manager.room_by_code(payload['room']['code'])
    assert room.play_mode == mode
    assert room.has_required_party == (mode == 'solo')
    assert not sessions.get(room.code).started
    assert main.room_can_begin_adventure(room, sessions.get(room.code)) == (mode == 'solo')
