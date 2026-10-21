"""Pass 66.6: questionnaire, private portrait ownership, immutable paid attempt budget."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

import pytest

from app.characters.models import Character
from app.characters import creation_routes as creation
from app.characters.schemas import CreateCharacterRequest
from datetime import datetime, timezone


def png_rgba(width: int, height: int, *, interior: bool) -> bytes:
    def chunk(tag: bytes, contents: bytes) -> bytes:
        return struct.pack(">I", len(contents)) + tag + contents + struct.pack(">I", zlib.crc32(tag + contents) & 0xffffffff)
    scanlines = bytearray()
    for y in range(height):
        scanlines.append(0)  # unfiltered row
        for x in range(width):
            allowed = (width // 4 < x < width * 3 // 4 and height // 4 < y < height * 3 // 4) if interior else x == 0
            scanlines.extend((0, 0, 0, 230 if allowed else 0))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(scanlines))) + chunk(b"IEND", b"")


def test_isolated_art_requirements_reject_edge_pixels_and_mattes():
    creation._verify_transparent_margins(png_rgba(80, 120, interior=True))
    with pytest.raises(ValueError, match="safety margin"):
        creation._verify_transparent_margins(png_rgba(80, 120, interior=False))


def test_three_attempts_are_atomic_and_selected_is_final(monkeypatch, tmp_path):
    monkeypatch.setattr(creation, "DATABASE_PATH", tmp_path / "portraits.sqlite3")
    assert [creation._reserve_sync("hero1") for _ in range(4)] == [1, 2, 3, None]
    assert creation._state_sync("hero1")["attempts_used"] == 3
    creation._record_sync("hero1", 1, "hero-portraits/hero1/1.png")
    assert not creation._select_sync("hero1", 2)
    assert creation._select_sync("hero1", 1)
    assert creation._state_sync("hero1")["selected_attempt"] == 1
    assert creation._reserve_sync("hero1") is None


def test_appearance_and_archetype_survive_character_round_trip():
    now = datetime.now(timezone.utc)
    hero = Character(character_id="id", owner_user_id="owner", name="Kesh", created_at=now, updated_at=now,
                     bio="An alien wanderer.", archetype="Noble emissary",
                     appearance={"species":"Alien", "gender":"nonbinary", "build":"lanky", "height":"2.2m"})
    after = Character.from_dict(hero.to_dict())
    assert after.archetype == "Noble emissary"
    assert after.appearance["species"] == "Alien"
    assert after.appearance["height"] == "2.2m"
    payload = CreateCharacterRequest(name="Kesh", bio="", archetype="Envoy", appearance={"species":"Alien"}, stats={},skills={})
    assert payload.appearance["species"] == "Alien"


@pytest.mark.asyncio
async def test_portrait_routes_are_private(monkeypatch):
    class User:
        user_id = "user-1"
    class Hero:
        owner_user_id = "user-2"
    async def identity(_token): return User()
    async def wrong_hero(_id): return Hero()
    monkeypatch.setattr(creation, "require_user", identity)
    monkeypatch.setattr(creation.character_store, "get_by_id", wrong_hero)
    with pytest.raises(creation.HTTPException) as err:
        await creation._owned("foreign-hero", None)
    assert err.value.status_code == 404


def test_frontend_uses_real_api_and_all_six_themes():
    root = Path(__file__).resolve().parents[2]
    frontend = (root / "frontend/src/pages/heroes/HeroCreatePage.tsx").read_text()
    assert "proposeHeroBiography" in frontend
    assert "generateHeroPortrait" in frontend
    assert "chooseHeroPortrait" in frontend
    assert "suggestedBuild" in frontend
    assert "archetype" in frontend and "species" in frontend and "height" in frontend and "weight" in frontend
    assert "createCharacter(" in frontend
    css = (root / "frontend/src/pages/heroes/quillairoHeroCreator.css").read_text()
    for theme in ("ivory", "cream", "parchment", "navy", "phosphor", "midnight"):
        assert f'data-ink-paper="{theme}"' in css or theme == "ivory" # ivory inherits default
    assert "<select" not in frontend
