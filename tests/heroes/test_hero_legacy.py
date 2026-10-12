"""The finality of Hero death, voluntary memorials, and selectable identity."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
import json
import sys
from pathlib import Path

import pytest

from app.characters.models import Character
from app.characters.service import CharacterService, CharacterValidationError
from app.characters.store import SQLiteCharacterStore


def hero(name='Fallen', health=0, **kw):
    now = datetime.now(timezone.utc)
    return Character(character_id=name, owner_user_id='owner', name=name,
                     created_at=now, updated_at=now, health=health, max_health=12, **kw)


def test_legacy_hero_defaults_active_but_dead_stays_dead():
    previous = hero().to_dict()
    for key in ('hero_status', 'retired_at', 'buried_at', 'epitaph'):
        previous.pop(key)
    restored = Character.from_dict(previous)
    assert restored.hero_status == 'active'
    assert not restored.is_alive
    assert restored.health == 0


def test_burial_preserves_original_character_and_epitaph(monkeypatch):
    model = hero(death_record={'cause': 'An ancient trap'})
    svc = CharacterService()
    async def owned(user, character_id):
        assert user == 'owner' and character_id == 'Fallen'
        return model
    async def save(user, character):
        assert user == 'owner'
        return character
    monkeypatch.setattr(svc, 'get_owned_character', owned)
    monkeypatch.setattr(svc, 'save_owned_character', save)
    monkeypatch.setattr(svc, 'ensure_not_in_active_room', lambda cid: None)
    buried = asyncio.run(svc.change_disposition('owner', 'Fallen', action='bury', epitaph='Never forgotten'))
    assert buried.hero_status == 'buried'
    assert buried.epitaph == 'Never forgotten'
    assert buried.buried_at
    assert buried.death_record == {'cause': 'An ancient trap'}
    saved = Character.from_dict(buried.to_dict())
    assert saved.hero_status == 'buried' and saved.health == 0
    with pytest.raises(CharacterValidationError):
        asyncio.run(svc.change_disposition('owner', 'Fallen', action='bury'))
    with pytest.raises(CharacterValidationError):
        asyncio.run(svc.change_disposition('owner', 'Fallen', action='restore'))


def test_retire_and_restore_only_living_heroes(monkeypatch):
    svc = CharacterService()
    model = hero('Living', 9)
    async def owned(*args): return model
    async def save(*args): return model
    monkeypatch.setattr(svc, 'get_owned_character', owned)
    monkeypatch.setattr(svc, 'save_owned_character', save)
    monkeypatch.setattr(svc, 'ensure_not_in_active_room', lambda cid: None)
    assert asyncio.run(svc.change_disposition('owner', 'Living', action='retire')).hero_status == 'retired'
    assert asyncio.run(svc.change_disposition('owner', 'Living', action='restore')).hero_status == 'active'
    with pytest.raises(CharacterValidationError):
        asyncio.run(svc.change_disposition('owner', 'Living', action='bury'))
    model.health = 0
    with pytest.raises(CharacterValidationError):
        asyncio.run(svc.change_disposition('owner', 'Living', action='retire'))


def test_public_memorials_only_include_voluntarily_buried_heroes(monkeypatch):
    archive = [hero('Unburied'), hero('Buried', hero_status='buried', buried_at='2026-10-12', epitaph='Rest'),
               hero('Retired', 7, hero_status='retired')]
    class Conn:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def execute(self, sql):
            assert 'SELECT payload FROM characters' in sql
            return SimpleNamespace(fetchall=lambda: [{'payload': json.dumps(h.to_dict())} for h in archive])
    db = SQLiteCharacterStore()
    monkeypatch.setattr(db, '_connect', lambda: Conn())
    memorials = db._list_memorials_sync(100)
    assert [h.name for h in memorials] == ['Buried']


def test_selector_filters_and_server_join_guard_are_present():
    root = Path(__file__).resolve().parents[2]
    home = (root / 'frontend/src/pages/game/GameHomePage.tsx').read_text()
    invite = (root / 'frontend/src/pages/public/JoinInvitePage.tsx').read_text()
    server = (root / 'app/main.py').read_text()
    assert 'hero.is_alive && hero.hero_status === "active"' in home
    assert 'playableHeroes.slice(0, 4)' in home
    assert 'hero.is_alive && hero.hero_status === "active"' in invite
    assert 'if not character.is_alive or character.hero_status != "active"' in server
    assert 'await require_owned_character(' in server


def test_live_room_prevents_disposition_but_completed_room_releases(monkeypatch):
    import app
    svc = CharacterService()
    session = SimpleNamespace(completed=False)
    room = SimpleNamespace(code='CODE12')
    fake_main = SimpleNamespace(
        rooms=SimpleNamespace(room_for_character=lambda cid: room),
        game_sessions=SimpleNamespace(get=lambda code: session),
    )
    # Replace BOTH references: `from app import main` may resolve a cached attribute.
    monkeypatch.setitem(sys.modules, 'app.main', fake_main)
    monkeypatch.setattr(app, 'main', fake_main, raising=False)
    with pytest.raises(CharacterValidationError):
        svc.ensure_not_in_active_room('Fallen')
    session.completed = True
    svc.ensure_not_in_active_room('Fallen')
