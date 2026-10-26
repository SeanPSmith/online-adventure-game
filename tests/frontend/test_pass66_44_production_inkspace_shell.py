"""Regression guard: the live Adventure Hall must not inherit the retired desk shell.

The classic book preview remains available, but it must not own /game, its first
paint, or the default adventure's eager CSS. These tests require no new tools.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"


def read(relative: str) -> str:
    return (SRC / relative).read_text(encoding="utf-8")


def test_production_home_has_a_distinct_inkspace_shell_from_first_render() -> None:
    layout = read("layouts/GameLayout.tsx")
    boot = read("styles/quillairoAdventureBoot.css")
    assert 'const isInkspaceHome = location.pathname === "/game"' in layout
    assert 'const isDeskHome = location.pathname === "/game/home-lab"' in layout
    assert 'isInkspaceHome ? "is-inkspace-home"' in layout
    assert '.game-site-shell.is-inkspace-home > .game-header { display:none !important; }' in boot
    assert '.game-site-shell.is-inkspace-home > .game-main' in boot
    assert 'max-height: none;' in boot and 'overflow:visible;' in boot
    for theme in ("ivory", "cream", "parchment", "navy", "midnight", "phosphor"):
        if theme != "ivory":
            assert f'.game-site-shell.is-inkspace-home[data-ink-paper="{theme}"]' in boot


def test_document_style_does_not_depend_on_legacy_book_or_has_selector() -> None:
    dashboard = read("pages/game/inkboundAuthenticatedDashboard.css")
    assert 'body:has(.inkbound-home)' not in dashboard
    assert '.game-site-shell.p64-shell.is-inkspace-home .game-main' in dashboard
    assert 'overflow:visible!important' in dashboard
    assert '.inkbound-home{' in dashboard


def test_legacy_book_stays_opt_in_and_off_shared_game_layout() -> None:
    layout = read("layouts/GameLayout.tsx")
    home = read("pages/game/GameHomePage.tsx")
    for old_import in (
        'import "../styles/deskShellFidelityPass64.css"',
        'import "../styles/deskScrapbookShell64.css"',
        'import "../styles/pass64_2cPerformance.css"',
        'import "../pages/game/livingBook644.css"',
    ):
        assert old_import not in layout, old_import
    for kept_import in (
        'import "../../styles/deskShellFidelityPass64.css"',
        'import "../../styles/deskScrapbookShell64.css"',
        'import "../../styles/pass64_2cPerformance.css"',
        'import "./livingBook644.css"',
    ):
        assert kept_import in home, kept_import
    assert 'if (!homeLab) return (' in home
    assert '<InkboundAuthenticatedDashboard' in home
    assert 'className="p644-scene"' in home


def test_protected_lab_and_live_adventure_are_independent() -> None:
    layout = read("layouts/GameLayout.tsx")
    router = read("router.tsx")
    assert 'const isInkspaceAdventure = isAdventureMode' in layout
    assert 'isInkspaceRoute' not in layout or 'is-inkspace-route' in layout
    assert 'element: <DevLabGate />' in router
    assert 'path: "dev/home-lab"' in router
    assert 'path: "adventure/:roomId"' in router
