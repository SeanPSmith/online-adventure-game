import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.admin.operations import OperationsStore
from app.auth.models import StoredUser
from app.auth.store import SQLiteAuthStore
from app.database import connect_database
from app.game.rooms import RoomManager
from app.game.session import GameSessionManager
from app.persistence.store import SQLiteStateStore
from app.usage.store import AIUsageStore, UsageLimitExceeded


async def stores(path):
    auth, state, usage, ops = SQLiteAuthStore(path), SQLiteStateStore(path), AIUsageStore(path), OperationsStore(path)
    for store in (auth, state, usage, ops):
        await store.initialize()
    now = datetime.now(timezone.utc)
    for user_id in ('admin', 'player'):
        await auth.create_user(StoredUser(user_id=user_id, email=f'{user_id}@example.com', username=user_id, password_hash='x', created_at=now))
    await auth.grant_permission('admin', 'admin')
    return auth, state, usage, ops


async def begin(usage, user='player', operation='director_story', reserve=5000):
    return await usage.begin_event(user_id=user, room_code='ROOM01', adventure_id='story', generated_adventure_id=None,
        surface='live_adventure', operation=operation, provider='openai', model='gpt-5.6-sol', reserved_cost_microusd=reserve)


@pytest.mark.asyncio
async def test_pause_is_persistent_blocks_admin_and_player_and_is_audited(tmp_path):
    path = tmp_path/'game.sqlite3'
    auth, state, usage, ops = await stores(path)
    await ops.set_pause('admin', True)
    await usage.initialize()  # A restart must not unpause the platform.
    for user in ('admin', 'player'):
        with pytest.raises(UsageLimitExceeded) as error:
            await begin(usage, user)
        assert error.value.code == 'operator_paused'
    snapshot = await ops.snapshot()
    assert snapshot['ai_paused']
    assert snapshot['metrics']['requests'] == 0
    assert snapshot['actions'][0]['action'] == 'ai_pause'
    await ops.set_pause('admin', False)
    assert await begin(usage)


@pytest.mark.asyncio
async def test_account_disable_revokes_sessions_and_blocks_ai(tmp_path):
    path = tmp_path/'game.sqlite3'
    auth, state, usage, ops = await stores(path)
    now = datetime.now(timezone.utc)
    with connect_database(path) as db:
        db.execute('INSERT INTO auth_sessions (session_id, user_id, token_hash, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
                   ('session', 'player', 'hash', now.isoformat(), (now+timedelta(days=1)).isoformat(), now.isoformat()))
        db.commit()
    await ops.set_account_active('admin', 'player', False)
    assert not (await auth.get_user_by_id('player')).is_active
    with connect_database(path) as db:
        assert db.execute('SELECT COUNT(*) AS n FROM auth_sessions').fetchone()['n'] == 0
    with pytest.raises(UsageLimitExceeded) as error:
        await begin(usage)
    assert error.value.code == 'account_disabled'
    with pytest.raises(PermissionError):
        await ops.set_account_active('admin', 'admin', False)
    with pytest.raises(LookupError):
        await ops.set_account_active('admin', 'missing', False)
    await ops.set_account_active('admin', 'player', True)
    assert await begin(usage)


@pytest.mark.asyncio
async def test_snapshot_aggregates_failures_costs_and_deduplicates_qte(tmp_path):
    path = tmp_path/'game.sqlite3'
    auth, state, usage, ops = await stores(path)
    event = await begin(usage)
    await usage.finish_event(event_id=event, status='succeeded', input_tokens=100, output_tokens=20, estimated_cost_microusd=1234, latency_ms=200)
    event = await begin(usage, operation='director_json_repair')
    await usage.finish_event(event_id=event, status='failed', error_type='TimeoutError', latency_ms=400)
    await begin(usage, reserve=9000)
    for _ in range(2):
        await ops.record_qte('ROOM01', {'id': 'one', 'responses': {'player': '__timeout__'}})
    await ops.record_qte('ROOM01', {'id': 'two', 'responses': {'player': 'a'}})
    data = await ops.snapshot()
    assert data['metrics']['requests'] == 3
    assert data['metrics']['retry_call_share'] is None
    assert data['metrics']['failed'] == 1
    assert data['metrics']['pending'] == 1
    assert data['metrics']['average_latency_ms'] == 300
    assert data['metrics']['repair_call_share'] == 33.3
    assert data['adventures'][0]['estimated_cost_usd'] == .001234
    assert data['adventures'][0]['reserved_usd'] == .009
    assert data['qte'] == {'resolved': 2, 'timed_out': 1, 'timeout_rate': 50.0}
    assert data['failures'][0]['error_type'] == 'TimeoutError'
    assert 'metadata_json' not in data['failures'][0]


@pytest.mark.asyncio
async def test_cancelled_metered_call_releases_reservation_but_retains_estimate(tmp_path, monkeypatch):
    from app.usage import meter
    path = tmp_path/'game.sqlite3'
    auth, state, usage, ops = await stores(path)
    monkeypatch.setattr(meter, 'ai_usage_store', usage)
    started = asyncio.Event()
    async def provider():
        started.set()
        await asyncio.Event().wait()
    with meter.ai_usage_scope(user_id='player', room_code='ROOM01'):
        task = asyncio.create_task(meter.metered_openai_call(operation='director_story', model='gpt-5.6-sol', max_output_tokens=100, input_hint='test', request=provider))
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    data = await ops.snapshot()
    assert data['metrics']['pending'] == 0
    assert data['metrics']['reserved_today_usd'] == 0
    assert data['adventures'][0]['estimated_cost_usd'] > 0
    assert data['failures'][0]['error_type'] == 'CancelledError'


@pytest.mark.asyncio
async def test_stale_reservation_remains_estimated_spend(tmp_path):
    path = tmp_path/'game.sqlite3'
    auth, state, usage, ops = await stores(path)
    event = await begin(usage, reserve=10000)
    with connect_database(path) as db:
        db.execute('UPDATE ai_usage_events SET occurred_at = ? WHERE event_id = ?', ((datetime.now(timezone.utc)-timedelta(hours=1)).isoformat(), event))
        db.commit()
    await usage.initialize()
    data = await ops.snapshot()
    assert data['metrics']['pending'] == 0
    assert data['adventures'][0]['estimated_cost_usd'] == .01
    assert data['failures'][0]['error_type'] == 'stale_reservation'


@pytest.mark.asyncio
async def test_operator_termination_waits_for_turn_cleanup_and_archives(tmp_path, monkeypatch):
    from app import main
    path = tmp_path/'game.sqlite3'
    auth, state, usage, ops = await stores(path)
    rooms, sessions = RoomManager(), GameSessionManager()
    room, _ = rooms.create_room(sid='s', user_id='player', character_id='hero', player_name='Hero')
    session = sessions.create(room.code)
    session.started = True
    await state.save_room_snapshot(room, session)
    monkeypatch.setattr(main, 'rooms', rooms)
    monkeypatch.setattr(main, 'game_sessions', sessions)
    monkeypatch.setattr(main, 'store', state)
    monkeypatch.setattr(main, '_turn_resolution_locks', {})
    monkeypatch.setattr(main, '_director_tasks', {})
    monkeypatch.setattr(main, '_director_active_rooms', set())
    async def noop(*args, **kwargs): pass
    monkeypatch.setattr(main.sio, 'emit', noop)
    monkeypatch.setattr(main.sio, 'leave_room', noop)
    monkeypatch.setattr(main, 'refresh_adventure_lists', noop)
    provider = asyncio.create_task(asyncio.Event().wait())
    main._director_tasks[room.code] = provider
    main._director_active_rooms.add(room.code)
    entered = asyncio.Event()
    async def resolving():
        async with main.turn_resolution_lock(room.code):
            entered.set()
            try:
                await provider
            except asyncio.CancelledError:
                await state.save_room_snapshot(room, session)
    resolving_task = asyncio.create_task(resolving())
    await entered.wait()
    await main.terminate_operator_room(room.code, 'admin')
    await resolving_task
    assert provider.cancelled()
    assert rooms.room_by_code(room.code) is None
    assert sessions.get(room.code) is None
    assert await state.load_room_snapshots() == []
    library = await state.list_player_library('player')
    assert library['abandoned'][0]['ended_by'] == 'operator'
    assert (await ops.snapshot())['actions'][0]['action'] == 'room_terminate'
    with pytest.raises(HTTPException) as error:
        await main.terminate_operator_room(room.code, 'admin')
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_cached_socket_cannot_play_after_disable(tmp_path, monkeypatch):
    from app import main
    auth, state, usage, ops = await stores(tmp_path/'game.sqlite3')
    user = (await auth.get_user_by_id('player')).to_user()
    monkeypatch.setattr(main, 'auth_store', auth)
    monkeypatch.setattr(main.socket_auth, 'get_user', lambda sid: user)
    disconnected = []
    monkeypatch.setattr(main.socket_auth, 'disconnect', disconnected.append)
    async def noop(*args, **kwargs): pass
    monkeypatch.setattr(main.sio, 'emit', noop)
    assert await main.require_socket_user('socket')
    await ops.set_account_active('admin', 'player', False)
    assert await main.require_socket_user('socket') is None
    assert disconnected == ['socket']


def test_operations_routes_reject_nonadmin_and_cross_site_writes(monkeypatch):
    from app.auth import routes
    app = FastAPI()
    app.include_router(routes.router)
    async def nonadmin(token): return SimpleNamespace(has_permission=lambda permission: False)
    monkeypatch.setattr(routes.auth_service, 'authenticate_session', nonadmin)
    with TestClient(app) as client:
        assert client.get('/api/auth/admin/operations').status_code == 404
        assert client.put('/api/auth/admin/ai-pause', json={'paused': True}).status_code == 404
        async def admin(token): return SimpleNamespace(user_id='admin', has_permission=lambda permission: True)
        monkeypatch.setattr(routes.auth_service, 'authenticate_session', admin)
        assert client.put('/api/auth/admin/ai-pause', json={'paused': True}).status_code == 403
        assert client.post('/api/auth/admin/rooms/ABC123/terminate', headers={'X-TOT-Admin-Request':'1','Sec-Fetch-Site':'cross-site'}, json={'confirmation':'ABC123'}).status_code == 403
        assert client.post('/api/auth/admin/rooms/ABC123/terminate', headers={'X-TOT-Admin-Request':'1'}, json={'confirmation':'wrong'}).status_code == 400

@pytest.mark.asyncio
async def test_retry_scope_marks_provider_calls(tmp_path, monkeypatch):
    from app.usage import meter
    auth, state, usage, ops = await stores(tmp_path/'game.sqlite3')
    monkeypatch.setattr(meter, 'ai_usage_store', usage)
    async def provider():
        return SimpleNamespace(usage=SimpleNamespace(input_tokens=10, output_tokens=10, total_tokens=20))
    with meter.ai_usage_scope(user_id='player', retry_attempt=True):
        await meter.metered_openai_call(operation='director_story', model='gpt-5.6-sol', max_output_tokens=100, input_hint='retry', request=provider)
    with meter.ai_usage_scope(user_id='player'):
        await meter.metered_openai_call(operation='director_story', model='gpt-5.6-sol', max_output_tokens=100, input_hint='new', request=provider)
    data = await ops.snapshot()
    assert data['metrics']['retry_calls'] == 1
    assert data['metrics']['retry_call_share'] == 50.0


@pytest.mark.asyncio
async def test_audit_failure_rolls_back_account_and_pause_mutations(tmp_path, monkeypatch):
    from app.admin import operations
    auth, state, usage, ops = await stores(tmp_path/'game.sqlite3')
    def fail(*args, **kwargs): raise RuntimeError('audit write failed')
    monkeypatch.setattr(operations, 'insert_action', fail)
    with pytest.raises(RuntimeError): await ops.set_account_active('admin', 'player', False)
    assert (await auth.get_user_by_id('player')).is_active
    with pytest.raises(RuntimeError): await ops.set_pause('admin', True)
    assert not (await ops.snapshot())['ai_paused']


@pytest.mark.asyncio
async def test_deletion_removes_identity_from_audit(tmp_path):
    auth, state, usage, ops = await stores(tmp_path/'game.sqlite3')
    await ops.audit('player', 'test_action', 'player')
    await auth.delete_user_account('player')
    row = (await ops.snapshot())['actions'][0]
    assert row['actor_id'].startswith('deleted:')
    assert row['target_id'].startswith('deleted:')
    assert row['details'] == {}

@pytest.mark.asyncio
async def test_room_archive_transaction_rolls_back_if_audit_fails(tmp_path, monkeypatch):
    from app.admin import operations
    auth, state, usage, ops = await stores(tmp_path/'game.sqlite3')
    rooms, sessions = RoomManager(), GameSessionManager()
    room, _ = rooms.create_room(sid='s', user_id='player', character_id='hero', player_name='Hero')
    session = sessions.create(room.code)
    await state.save_room_snapshot(room, session)
    def fail(*args, **kwargs): raise RuntimeError('audit write failed')
    monkeypatch.setattr(operations, 'insert_action', fail)
    with pytest.raises(RuntimeError):
        await state.archive_abandoned_adventure(room, session, operator_id='admin')
    assert len(await state.load_room_snapshots()) == 1
    assert (await state.list_player_library('player'))['abandoned'] == []


@pytest.mark.asyncio
async def test_disable_socket_cleanup_removes_presence_and_sid_registry(monkeypatch):
    from app import main
    rooms = RoomManager()
    room, _ = rooms.create_room(sid='socket', user_id='player', character_id='hero', player_name='Hero')
    monkeypatch.setattr(main, 'rooms', rooms)
    monkeypatch.setattr(main, '_user_sids', {'player': {'socket'}})
    async def noop(*args, **kwargs): pass
    monkeypatch.setattr(main.sio, 'disconnect', noop)
    monkeypatch.setattr(main, 'persist_room_state', noop)
    monkeypatch.setattr(main, 'broadcast_room_state', noop)
    monkeypatch.setattr(main, 'refresh_adventure_lists', noop)
    await main.disconnect_account_sockets('player')
    assert 'player' not in main._user_sids
    assert room.online_count == 0
