"""Pass 64.4C: persistent paper, accessible image copy and ink-only navigation."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
HOME = (ROOT/'frontend/src/pages/game/GameHomePage.tsx').read_text()
CSS = (ROOT/'frontend/src/pages/game/livingBook644Ink.css').read_text()

def test_persistent_book_and_leaf_nodes_are_not_keyed():
    assert '<div className="p644-pages p644-spread-content">' in HOME
    assert 'className="p644-paper-leaf p644-paper-leaf-left"' in HOME
    assert 'className="p644-paper-leaf p644-paper-leaf-right"' in HOME
    assert '<div className="p644-ink-layer" key={bookSpread} data-ink-leaving={inkLeaving}>' in HOME
    assert '.p644-pages {' in CSS and 'animation:none!important' in CSS
    assert '.p644-ink-layer[data-ink-leaving="true"]' in CSS
    assert 'p644c-ink-arrive' in CSS

def test_navigation_is_in_place_and_routes_keep_their_actions():
    for page in ('home','heroes','journeys','discover','wardrobe','tools'):
        assert f'bookSpread === "{page}"' in HOME
    for handler in ('createRoom(selectedHeroId, adventureId, pendingPlayMode)',
                    'joinRoom(selectedHeroId, roomCode)', 'abandonAdventure(adventure.room_code)',
                    'leaveAdventure(adventure.room_code, adventure.character_id)',
                    'setSelectedHeroId(', 'onClick={beginPendingAdventure}',
                    'RoomInviteButton', 'FirstRunGuide', 'setPendingJourneyExit('):
        assert handler in HOME, handler
    assert 'role="status"' in HOME

def test_graphics_are_described_and_not_baked_in_as_controls():
    assert 'alt={`Illustrated cover for ${a.adventure_title}`}' in HOME
    assert 'alt={`Illustrated cover for ${adventure.title}`}' in HOME
    assert 'role="img" aria-label="Watercolor view across a sunlit fantasy coast"' in HOME
    assert 'aria-label={`Select ${hero.name} as your Hero`}' in HOME
    assert 'p644-ink-button-ornament.svg' in CSS
    assert '<select' not in HOME

def test_accessibility_and_older_gpu_performance():
    assert 'prefers-reduced-motion:reduce' in CSS
    assert 'data-reduced-motion="true"' in CSS
    assert 'opacity:0;' in CSS and 'opacity:1;' in CSS
    assert 'filter:blur(' not in CSS
    assert '@media (max-width:800px)' in CSS
    assert '.p644-paper-leaf {display:none!important;}' in CSS
