"""Pass 64.4A design contract; complements runtime/browser acceptance on staging."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = (ROOT / "frontend/src/pages/game/GameHomePage.tsx").read_text()
CSS = (ROOT / "frontend/src/pages/game/livingBook644.css").read_text()
LAYOUT = (ROOT / "frontend/src/layouts/GameLayout.tsx").read_text()


def test_desktop_book_is_bounded_and_mobile_is_a_journal():
    assert "height:100dvh" in CSS
    assert "overflow:hidden" in CSS
    assert "@media(max-width:800px)" in CSS
    assert "overflow:visible" in CSS
    assert "p644-bound-book" in SRC
    assert 'data-ink-leaving={inkLeaving}' in SRC
    assert "@media(prefers-reduced-motion:reduce)" in CSS


def test_book_content_replaces_long_dashboard_without_removing_controls():
    for screen in ('home', 'heroes', 'journeys', 'discover', 'tools'):
        assert f'bookSpread === "{screen}"' in SRC
    for contract in ('title="CONTINUE JOURNEY"', 'title="JOIN A FRIEND"',
                     'YOUR HEROES', 'ADVENTURE LIBRARY', 'type="search"',
                     'catalogSearch', 'selectedTag', 'title="SYSTEM MENU"',
                     'RoomInviteButton', 'FirstRunGuide', 'setPendingJourneyExit',
                     'onClick={beginPendingAdventure}', 'onClick={joinExistingRoom}'):
        assert contract in SRC, contract
    assert 'aria-label="Continue your adventure"' in SRC
    assert 'className="p64-desk"' in SRC
    assert 'className="p644-scene"' in SRC
    assert 'import "./livingBook644.css"' in SRC
    assert 'import "../pages/game/livingBook644.css"' not in LAYOUT


def test_art_never_supplies_interactive_data():
    assert 'p644-tabletop.webp' in CSS
    assert 'p644-watercolor-scene.webp' in CSS
    assert 'primaryJourney.adventure_title' in SRC
    assert 'hero.name' in SRC
    assert 'a.adventure_title' in SRC
    assert 'setBookSpread(next)' in SRC


def test_existing_theme_compatibility():
    assert 'data-edition-family' in CSS
    assert 'data-edition-mode="night"' in CSS
