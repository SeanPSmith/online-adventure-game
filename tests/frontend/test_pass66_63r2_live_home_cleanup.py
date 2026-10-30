"""Pass 66.63 R2: live Adventure Hall never bundles the retired physical book.

The test checks genuine client-side wiring and absence of obsolete runtime CSS.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"


def read(path):
    return (SRC / path).read_text(encoding="utf-8")


def test_current_game_route_renders_only_real_dashboard():
    router = read("router.tsx")
    home = read("pages/game/GameHomePage.tsx")
    assert '.GameHomePage' in router
    assert 'path: "home-lab", element: <Navigate to="/game" replace />' in router
    assert '.LivingBookHomeLabPage' not in router
    assert 'export function GameHomePage()' in home
    assert '<InkboundAuthenticatedDashboard' in home
    assert 'homeLab' not in home
    assert 'p644-' not in home


def test_live_game_handlers_and_eligibility_not_replaced_by_fake_data():
    home = read("pages/game/GameHomePage.tsx")
    hall = read("pages/game/InkboundAuthenticatedDashboard.tsx")
    for contract in (
        'useGameSocket()', 'listCharacters()', 'refreshCatalog();',
        'hero.is_alive && hero.hero_status === "active"',
        'selectableHeroes[0]?.character_id', 'lastRoomEntry.room.code',
        'clearRoomEntry()', 'createRoom(selectedHeroId, item.adventure_id, mode)',
        'joinRoom(selectedHeroId, code)', 'onLeaveAdventure={leaveAdventure}',
        'onAbandonAdventure={abandonAdventure}',
    ):
        assert contract in home, contract
    for contract in ('onCreate(selectedStory,mode)', 'onJoin(roomCode.trim().toUpperCase())',
                     'onLeaveAdventure(exitJourney.room_code, exitJourney.character_id)',
                     'onAbandonAdventure(exitJourney.room_code)'):
        assert contract in hall, contract


def test_removed_book_styles_are_not_loaded_anywhere_in_production():
    home = read("pages/game/GameHomePage.tsx")
    layout = read("layouts/GameLayout.tsx")
    for filename in (
        'gameHomePass64.css', 'deskFidelityPass64.css', 'deskScrapbookPass64.css',
        'gameBrighterWorld.css', 'inkspaceAuthenticatedHome.css',
        'livingBook644.css', 'livingBook644Fidelity.css', 'livingBook644Ink.css',
        'deskScrapbookShell64.css', 'deskShellFidelityPass64.css', 'pass64_2cPerformance.css',
    ):
        assert filename not in home + layout
    assert 'is-desk-home' not in layout
    assert not (SRC / 'pages/game/InkspaceAuthenticatedHome.tsx').exists()


def test_admin_lab_retirement_does_not_break_reader_or_auth_gate():
    router = read("router.tsx")
    layout = read("layouts/GameLayout.tsx")
    assert not (SRC / 'pages/game/DevWorkshopPage.tsx').exists()
    assert 'DevLabGate' not in router
    assert 'element: <RequireAuth />' in router
    assert 'path: "adventure/:roomId"' in router
    assert 'path: "home-lab", element: <Navigate to="/game" replace />' in router
    assert 'const isInkspaceAdventure = isAdventureMode' in layout
    assert 'const isInkspaceHome' in layout
