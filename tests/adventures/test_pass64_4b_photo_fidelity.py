"""Pass 64.4B: art-directed photographic book without altering game state.

No pillow or browser package required for this source and asset contract check.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
ART = FRONTEND / "public/art/pass64"


def test_living_book_fidelity_is_opt_in_and_rooted_in_real_home() -> None:
    home = (FRONTEND / "src/pages/game/GameHomePage.tsx").read_text(encoding="utf8")
    css = (FRONTEND / "src/pages/game/livingBook644Fidelity.css").read_text(encoding="utf8")
    assert 'import "./livingBook644.css";' in home
    assert 'import "./livingBook644Fidelity.css";' in home
    assert 'data-edition-family="brighter-world"' in css
    assert 'data-edition-mode="day"' in css
    assert "p644-physical-book-edges.webp" in css
    assert "p644-tabletop-clean.webp" in css
    assert "p644-watercolor-clean.webp" in css
    assert "p644-hero-portrait-fallback.webp" in css
    assert "[data-ink-leaving" in css
    assert "prefers-reduced-motion" in css
    # Existing server-authoritative action paths remain live.
    for literal in ('createRoom(', 'joinRoom(', 'abandonAdventure(', 'leaveAdventure(', 'setSelectedHeroId(', 'refreshCatalog(', 'rememberGameRoute('):
        assert literal in home, literal


def test_book_art_is_local_and_not_a_fake_clickable_ui() -> None:
    for name in ("p644-physical-book-edges.webp", "p644-tabletop-clean.webp", "p644-watercolor-clean.webp", "p644-hero-portrait-fallback.webp"):
        blob = (ART / name).read_bytes()
        assert len(blob) > 12_000, name
        assert blob[:4] == b"RIFF" and blob[8:12] == b"WEBP", name
    css = (FRONTEND / "src/pages/game/livingBook644Fidelity.css").read_text(encoding="utf8")
    assert "pointer-events:none" in css
    assert "https://" not in css and "http://" not in css
    assert "@import" not in css
    assert "position:fixed" not in css
