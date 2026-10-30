"""Pass 64.4D: stage-only visual playground contracts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def test_visual_playground_is_a_separate_protected_route() -> None:
    router = (FRONTEND / "src/router.tsx").read_text()
    assert 'path: "game/visual-playground"' in router
    assert "VisualBookPlaygroundPage" in router
    # The standard Home route must remain accessible and unchanged.
    assert '{ index: true, lazy:' in router


def test_only_top_menu_and_blank_book_no_gameplay_content() -> None:
    component = (FRONTEND / "src/pages/game/VisualBookPlaygroundPage.tsx").read_text()
    assert 'const MENU = ["Home", "Heroes", "Wardrobe", "My Adventures", "Discover", "System"]' in component
    assert 'className="vb-book-space"' in component
    assert "GameHomePage" not in component
    assert "AdventurePage" not in component
    assert "<select" not in component
    assert "onClick" in component
    assert 'aria-label="Visual playground — menu style preview"' in component
    assert 'alt="An open, blank ivory-paged book' in component


def test_background_is_real_asset_and_header_not_baked_in() -> None:
    asset = FRONTEND / "public/art/pass64/pass64-4d-tabletop-book.webp"
    assert asset.is_file() and asset.stat().st_size > 100000
    raw = asset.read_bytes()
    assert raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    styles = (FRONTEND / "src/pages/game/visualBookPlayground.css").read_text()
    assert ".vb-header" in styles
    assert ".vb-parchment" in styles
    assert ".vb-scene" in styles
    assert "prefers-reduced-motion" in styles
