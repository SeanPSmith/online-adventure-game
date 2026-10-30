"""Regression guard: a completed adventure can always return to the Hall."""
from pathlib import Path

SOURCE = (Path(__file__).resolve().parents[2] / "frontend/src/pages/game/AdventurePage.tsx").read_text(encoding="utf-8")


def test_finale_return_safely_handles_optional_hero_id():
    assert "if (characterId) {\n                      leaveAdventure(normalizedRoomCode, characterId);" in SOURCE
    assert "navigate(\"/game\");" in SOURCE
    assert "END ADVENTURE HERE // RETURN TO HALL" in SOURCE


def test_live_reader_still_uses_server_hero_first():
    expression = "hero={partyHeroes.find((p) => p.character_id === characterId) ?? hero ?? null}"
    assert SOURCE.count(expression) == 1
    # The one remaining use must belong to the Inkbound live reader element.
    assert SOURCE.index(expression) > SOURCE.index("<InkboundLiveRoom")
