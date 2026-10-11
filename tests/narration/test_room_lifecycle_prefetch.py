"""Pass 59C: opt-in room leases, safe shutdown, private prefetch + cache identity."""
import asyncio
import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.narration import hosting, prefetch, routes

ROOT = Path(__file__).resolve().parents[2]


def _mock_main(monkeypatch, main_module):
    """Replace both import locations used by `from app import main`.

    Other test modules import app.main during collection, leaving a cached
    `app.main` package attribute. Replacing sys.modules alone does not replace
    that attribute, so full-suite tests can accidentally use the real registry.
    """
    import app
    import sys
    monkeypatch.setitem(sys.modules, "app.main", main_module)
    monkeypatch.setattr(app, "main", main_module, raising=False)


def _watchdog():
    spec = importlib.util.spec_from_file_location("room_watchdog_test", ROOT / "infra/narrator/watchdog.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_room_lease_protects_active_listener_and_disables_without_wake(monkeypatch):
    for key, value in {"KOKORO_BASE_URL": "http://127.0.0.1:8880",
                       "KOKORO_INSTANCE_ID": "i-test",
                       "KOKORO_ACTIVITY_TABLE": "test-table"}.items():
        monkeypatch.setenv(key, value)
    now = 1800000000
    monkeypatch.setattr(hosting.time, "time", lambda: now)
    rows = {}
    class Table:
        def get_item(self, *, Key, **_): return {"Item": rows.get(Key['id'], {})}
        def put_item(self, *, Item): rows[Item['id']] = Item
        def update_item(self, *, Key, **kw): rows.setdefault(Key['id'], {}).update({'last_request_epoch':now})
        def delete_item(self, *, Key): rows.pop(Key['id'], None)
    monkeypatch.setattr(hosting, "_clients", lambda: (None, Table()))
    wakes = []
    monkeypatch.setattr(hosting, "touch", lambda *, wake: wakes.append(wake) or {"state": "running"})
    first = hosting.lease_room('ABC123', 'player-1')
    assert first['state'] == 'running'
    key = hosting._room_key('ABC123', 'player-1')
    assert rows[key]['expires_at_epoch'] == now + 300
    assert 'player-1' not in str(rows[key]) and 'ABC123' not in key
    assert hosting.lease_room('ABC123', 'player-1')['state'] == 'running'
    assert wakes == [False, False]
    assert hosting.lease_room('ABC123', 'player-1', enabled=False) == {'state': 'disabled'}
    assert key not in rows and wakes == [False, False]


def test_heartbeat_cannot_wake_unknown_or_unowned_room(monkeypatch):
    # The route deliberately resolves room membership through the app entrypoint.
    fake_main = SimpleNamespace(rooms=SimpleNamespace(room_by_code=lambda code: None))
    _mock_main(monkeypatch, fake_main)
    calls = []
    monkeypatch.setattr(hosting, 'lease_room', lambda *a, **kw: calls.append(kw))
    with pytest.raises(HTTPException) as error:
        asyncio.run(routes.narration_heartbeat(routes.RoomHeartbeat(room_code='nope'),
                                               SimpleNamespace(user_id='stranger')))
    assert error.value.status_code == 403
    assert not calls
    fake_main.rooms.room_by_code = lambda code: SimpleNamespace(players={
        'a': SimpleNamespace(user_id='owner', is_online=True)})
    with pytest.raises(HTTPException) as error:
        asyncio.run(routes.narration_heartbeat(routes.RoomHeartbeat(room_code='abc123'),
                                               SimpleNamespace(user_id='stranger')))
    assert error.value.status_code == 403
    assert not calls


def test_authorized_lobby_wakes_and_disable_releases(monkeypatch):
    fake_main = SimpleNamespace(rooms=SimpleNamespace(room_by_code=lambda code: SimpleNamespace(players={
        'a': SimpleNamespace(user_id='owner', is_online=True)})))
    _mock_main(monkeypatch, fake_main)
    monkeypatch.setattr(hosting, 'configured', lambda: True)
    events = []
    monkeypatch.setattr(hosting, 'lease_room', lambda *args, **kw:
                        events.append((args, kw)) or {'state': 'pending'})
    enabled = asyncio.run(routes.narration_heartbeat(
        routes.RoomHeartbeat(room_code='abc123'), SimpleNamespace(user_id='owner')))
    disabled = asyncio.run(routes.narration_heartbeat(
        routes.RoomHeartbeat(room_code='abc123', enabled=False), SimpleNamespace(user_id='owner')))
    assert enabled['state'] == disabled['state'] == 'pending'
    assert events == [(('ABC123','owner'),{'enabled':True}),
                      (('ABC123','owner'),{'enabled':False})]


def test_watchdog_protects_room_even_when_quota_exceeded():
    w = _watchdog(); now = 1800000000
    row = {'month': w.month_of(now), 'used_seconds': w.LIMIT,
           'last_request_epoch': now - 4000, 'last_probe_epoch': now,
           'last_room_request_epoch': now - 4000}
    assert not w.reconcile(row, now, True, room_active=True)['should_stop']
    assert w.reconcile(row, now, True, room_active=False)['should_stop']
    row['used_seconds'] = 0
    row['last_request_epoch'] = now - 910
    assert w.reconcile(row, now, True)['should_stop']
    row['last_request_epoch'] = now - 850
    assert not w.reconcile(row, now, True)['should_stop']


def test_watchdog_scan_paginates_and_filters_active_room():
    w = _watchdog()
    calls = []
    def scan(**kw):
        calls.append(kw)
        return ({'Items':[], 'LastEvaluatedKey':{'id':'room#old'}} if len(calls) == 1
                else {'Items':[{'id':'room#active'}]})
    assert w.active_room(SimpleNamespace(scan=scan), 12345)
    assert calls[0]['ExpressionAttributeValues'][':p'] == 'room#'
    assert calls[0]['ExpressionAttributeValues'][':n'] == 12345
    assert calls[1]['ExclusiveStartKey'] == {'id':'room#old'}


def test_python_chunks_match_browser_boundary_contract():
    text = '# The Hollow Road. ' + 'The crooked mountain path flickers under torchlight. '*38
    parts = prefetch.split_passage(text)
    assert len(parts) > 2
    assert all(0 < len(p) <= 280 for p in parts)
    assert ' '.join(parts) == ' '.join(text.replace('# ', '').split())
    assert prefetch.split_passage('') == []


def test_background_prefetch_respects_no_room_and_reuses_cache(monkeypatch):
    monkeypatch.setenv('KOKORO_BASE_URL','http://127.0.0.1:8880')
    monkeypatch.setattr(hosting, 'has_live_room', lambda code: False)
    monkeypatch.setattr(routes, '_read_kokoro', lambda *a: (_ for _ in ()).throw(AssertionError('must not synthesize')))
    asyncio.run(prefetch._prefetch_one(prefetch.Passage('ABC123','am_michael','Secret unrevealed chapter.')))

    monkeypatch.setattr(hosting, 'has_live_room', lambda code: True)
    monkeypatch.setattr(hosting, 'healthy', lambda endpoint: True)
    monkeypatch.setattr(routes, '_shared_audio', lambda key: None)
    stored = []
    monkeypatch.setattr(routes, '_store_shared_audio', lambda key, audio: stored.append((key,audio)))
    async def awake(*,wake): return {'state':'running'}
    monkeypatch.setattr(routes, '_ensure_awake', awake)
    monkeypatch.setattr(hosting, 'begin_generation', lambda: 'generation#test')
    monkeypatch.setattr(hosting, 'finish_generation', lambda lease: None)
    monkeypatch.setattr(routes, '_read_kokoro', lambda *args: b'private-mp3')
    routes._cache.clear()
    job = prefetch.Passage('ABC123','am_michael','The travelers reach the gate.')
    asyncio.run(prefetch._prefetch_one(job))
    assert stored == [(routes._audio_key(job.text,job.voice),b'private-mp3')]
    assert routes._cache[stored[0][0]] == b'private-mp3'
    assert not hasattr(prefetch, 'router')  # no public prefetch endpoint


def test_live_room_check_requires_unexpired_opt_in_and_online_member(monkeypatch):
    monkeypatch.setenv('KOKORO_BASE_URL', 'http://127.0.0.1:8880')
    monkeypatch.setenv('KOKORO_INSTANCE_ID', 'i-test')
    monkeypatch.setenv('KOKORO_ACTIVITY_TABLE', 'table')
    now = 1800000000
    monkeypatch.setattr(hosting.time, 'time', lambda: now)
    member = SimpleNamespace(user_id='owner', is_online=True)
    _mock_main(monkeypatch, SimpleNamespace(rooms=SimpleNamespace(
        room_by_code=lambda code: SimpleNamespace(players={'a': member}))))
    lease = {'expires_at_epoch':now + 30}
    table = SimpleNamespace(get_item=lambda **kw: {'Item':lease})
    monkeypatch.setattr(hosting, '_clients', lambda: (None, table))
    assert hosting.has_live_room('ABC123')
    lease['expires_at_epoch'] = now - 1
    assert not hosting.has_live_room('ABC123')
    lease['expires_at_epoch'] = now + 30
    member.is_online = False
    assert not hosting.has_live_room('ABC123')


def test_background_queue_hook_is_guarded_after_authoritative_commit():
    src = (ROOT / 'app/main.py').read_text()
    # A scene is never handed to the speculative narrator before the Director
    # commits its final output, and the first chapter isn't generated in lobby.
    assert 'game_sessions.commit_director_opening(' in src
    assert 'schedule_committed_scene(room.code, session.scene, session.narrator_voice)' in src
    assert src.index('game_sessions.commit_director_opening(') < src.index(
        'schedule_committed_scene(room.code, session.scene, session.narrator_voice)')
    index = src.index('.commit_director_turn(')
    assert index < src.index('schedule_committed_scene(room.code, session.scene, session.narrator_voice)',index)
    assert 'NARRATION PREFETCH SKIPPED' in src
