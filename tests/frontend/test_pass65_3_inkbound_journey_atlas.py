"""Pass 65.3 — isolated style atlas: no accidental game-state mutations."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "frontend/src/pages/game/InkboundFoundationPage.tsx"
ATLAS = ROOT / "frontend/src/pages/game/InkboundJourneyGallery.tsx"
STYLE = ROOT / "frontend/src/pages/game/inkboundJourney.css"


def test_atlas_has_all_primary_player_surfaces_and_canonical_turn_order():
    source = ATLAS.read_text()
    for word in ("Dashboard", "Heroes", "Dice", "Intermission", "Result", "Arcade",
                 '"dice" | "intermission" | "result"', "listCharacters", "useGameSocket"):
        assert word in source
    for route in ("/game/adventures", "/game/heroes", "/game/arcade"):
        assert route in source
    assert 'aria-label="Turn sequence preview"' in source
    assert "The server—not this preview—will determine" in source


def test_mock_dice_and_intermission_do_not_write_game_state():
    source = ATLAS.read_text()
    for forbidden in ("submitChoice(", "rollDice(", "socket.emit(", "createRoom(",
                      "startSolo(", "onLockChoice", "applyOutcome(", "applyXp(", "fetch("):
        assert forbidden not in source
    assert "PREVIEW" in source and "THE SERVER OWNS" in source


def test_workshop_preserves_editorial_reference_art_and_adds_midnight_theme():
    foundation = PAGE.read_text()
    style = STYLE.read_text()
    assert '/north-road-editorial.png' in foundation
    assert '<InkboundJourneyGallery' in foundation
    assert 'data-ink-paper={paper}' in foundation
    for mode in ('"ivory"', '"parchment"', '"slate"', '"midnight"'):
        assert mode in foundation
    assert 'data-ink-paper="midnight"' in style
    assert 'data-ink-paper="slate"' in style
    assert "font-family:var(--i65-type)" in style
    assert "prefers-reduced-motion:reduce" in style
    assert 'radial-gradient(circle at 50% 20%' in style  # atmospheric tone, not an image feather mask
    assert 'mask-image:' not in style


def test_workshop_routes_remain_admin_gated():
    router = (ROOT / "frontend/src/router.tsx").read_text()
    assert 'path: "dev/inkbound"' in router
    assert "element: <DevLabGate />" in router
    assert "element: <RequireAuth />" in router
