"""Pass 63.6: deterministic, atomic Hero health recovery between adventures."""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.characters.models import Character
from app.characters.rest import apply_resting_recovery, recovered_hp_per_hour
from app.characters.service import CharacterService, CharacterValidationError
from app.characters.store import SQLiteCharacterStore


NOW = datetime(2026, 10, 16, 18, 0, tzinfo=timezone.utc)


def make_hero(*, health=5, max_health=20, updated_at=None, **extra):
    return Character(character_id="hero-rest", owner_user_id="owner", name="Resting Hero",
                     created_at=NOW - timedelta(days=4),
                     updated_at=updated_at or NOW - timedelta(hours=3),
                     health=health, max_health=max_health, **extra)


def test_rest_recovery_ticks_once_per_complete_hour_not_per_request():
    hero = make_hero(rest_recovered_at=(NOW - timedelta(hours=2, minutes=50)).isoformat())
    assert recovered_hp_per_hour(20) == 2
    assert apply_resting_recovery(hero, now=NOW)
    assert hero.health == 9
    checkpoint = hero.rest_recovered_at
    assert checkpoint.endswith("+00:00")
    assert not apply_resting_recovery(hero, now=NOW)
    assert hero.health == 9 and hero.rest_recovered_at == checkpoint
    assert apply_resting_recovery(hero, now=NOW + timedelta(minutes=11))
    assert hero.health == 11


def test_legacy_timestamp_defaults_to_last_actual_write_and_clamps_overheal():
    hero = make_hero(health=1, max_health=20, rest_recovered_at=None,
                     updated_at=NOW - timedelta(hours=60))
    assert apply_resting_recovery(hero, now=NOW)
    assert hero.health == 20
    assert not apply_resting_recovery(hero, now=NOW + timedelta(days=2))


def test_never_resurrect_dead_heroes_or_recover_buried_heroes():
    for hero in (make_hero(health=0), make_hero(health=0, hero_status="buried"),
                 make_hero(health=5, hero_status="buried")):
        assert not apply_resting_recovery(hero, now=NOW)
        assert hero.health in (0, 5)
    alive = make_hero(health=10, max_health=10)
    assert not apply_resting_recovery(alive, now=NOW)


def test_clock_skew_is_not_free_recovery():
    hero = make_hero(rest_recovered_at=(NOW + timedelta(days=2)).isoformat())
    assert not apply_resting_recovery(hero, now=NOW)
    assert hero.health == 5


def db_with_hero(tmp_path: Path, hero: Character) -> SQLiteCharacterStore:
    db = SQLiteCharacterStore(tmp_path / "hero-rest.sqlite3")
    with db._connect() as conn:
        conn.execute("CREATE TABLE users (user_id TEXT PRIMARY KEY)")
        conn.execute("INSERT INTO users (user_id) VALUES (?)", ("owner",))
    db._initialize_sync()
    db._save_sync(hero)
    return db


def test_persisted_rest_survives_repeated_reads_and_restart(tmp_path):
    db = db_with_hero(tmp_path, make_hero())
    first = db._recover_resting_sync("hero-rest", "owner", NOW)
    assert first and first.health == 11  # 3 hours * 2 HP
    assert db._recover_resting_sync("hero-rest", "owner", NOW).health == 11
    reopened = SQLiteCharacterStore(tmp_path / "hero-rest.sqlite3")
    assert reopened._recover_resting_sync("hero-rest", "owner", NOW).health == 11
    assert reopened._recover_resting_sync("hero-rest", "stranger", NOW) is None
    with db._connect() as connection:
        stored = json.loads(connection.execute("SELECT payload FROM characters").fetchone()["payload"])
    assert stored["rest_recovered_at"] == NOW.isoformat()


def test_active_room_guard_prevents_grant(monkeypatch, tmp_path):
    db = db_with_hero(tmp_path, make_hero())
    svc = CharacterService()
    import app.characters.service as service_module
    monkeypatch.setattr(service_module, "character_store", db)
    def active(_):
        raise CharacterValidationError("In active adventure")
    monkeypatch.setattr(svc, "ensure_not_in_active_room", active)
    current = asyncio.run(svc.get_owned_character("owner", "hero-rest"))
    assert current.health == 5
    assert db._get_by_id_sync("hero-rest").health == 5
    monkeypatch.setattr(svc, "ensure_not_in_active_room", lambda _: None)
    assert asyncio.run(svc.get_owned_character("owner", "hero-rest")).health >= 5


def test_json_roundtrip_preserves_rest_checkpoint():
    hero = make_hero(rest_recovered_at=NOW.isoformat())
    clone = Character.from_dict(hero.to_dict())
    assert clone.rest_recovered_at == NOW.isoformat()
    assert clone.health == hero.health


def test_turn_flow_resets_rest_clock_and_saves_injured_heroes():
    root = Path(__file__).resolve().parents[2]
    main = (root / "app/main.py").read_text()
    assert 'character.rest_recovered_at = utc_now().isoformat()' in main
    assert '(character.is_alive and character.health < character.max_health)' in main


def test_concurrent_owner_reads_do_not_stack_recovery(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    db = db_with_hero(tmp_path, make_hero(health=1, updated_at=NOW - timedelta(hours=2)))
    with ThreadPoolExecutor(max_workers=6) as pool:
        outcomes = list(pool.map(lambda _: db._recover_resting_sync('hero-rest', 'owner', NOW), range(12)))
    assert all(outcome is not None and outcome.health == 5 for outcome in outcomes)
    assert db._get_by_id_sync('hero-rest').health == 5
