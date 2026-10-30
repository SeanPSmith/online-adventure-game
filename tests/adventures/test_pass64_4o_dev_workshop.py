"""Pass 64.4O — isolate legacy experimental routes from player-facing /game."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
ROUTER = (SRC / "router.tsx").read_text(encoding="utf-8")
GATE = (SRC / "components/auth/DevLabGate.tsx").read_text(encoding="utf-8")
INDEX = (SRC / "pages/game/DevWorkshopPage.tsx").read_text(encoding="utf-8")
LABS = ("visual-playground", "ink-lab", "inkspace-story", "inkspace-reader", "tabletop-kit", "space-lab")

def test_all_experiments_canonical_dev_only_and_legacy_redirects():
    assert 'element: <RequireAuth />' in ROUTER
    assert 'element: <DevLabGate />' in ROUTER
    assert ROUTER.index('element: <DevLabGate />') < ROUTER.index('path: "dev/visual-playground"')
    for lab in LABS:
        assert f'path: "dev/{lab}"' in ROUTER
        assert f'path: "game/{lab}", element: <Navigate to="/dev/{lab}" replace />' in ROUTER
    assert 'path: "home-lab", element: <Navigate to="/dev" replace />' in ROUTER
    assert 'path: "dev/home-lab", element: <Navigate to="/dev" replace />' in ROUTER
    assert 'path: "adventure/:roomId"' in ROUTER
    assert 'index: true' in ROUTER

def test_only_admin_can_access_labs_and_gate_cannot_write_game_state():
    assert 'user?.permissions.includes("admin")' in GATE
    assert 'status !== "authenticated"' in GATE
    assert 'return <Outlet />' in GATE
    assert '<Navigate to="/game" replace />' in GATE
    for forbidden in ('useGameSocket', 'sendChat', 'submitChoice', 'createRoom', 'fetch('):
        assert forbidden not in GATE

def test_dev_index_is_explicit_and_player_shell_is_unchanged():
    assert 'DEVELOPMENT ONLY' in INDEX
    assert 'to="/game"' in INDEX
    for lab in LABS:
        assert f'path: "{lab}"' in INDEX
    layout = (SRC / "layouts/GameLayout.tsx").read_text(encoding="utf-8")
    assert 'isDeskHome' not in layout
    assert 'location.pathname === "/game"' in layout
    # No menu is added to primary player navigation.
    assert 'to="/dev' not in layout
