"""Pass 64.2b presentation-only contracts for the living desk homepage.

No game truth changes: room selection, dice, recovery and invites remain server-owned.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'frontend' / 'src'
HOME = (SRC / 'pages/game/GameHomePage.tsx').read_text()
LAYOUT = (SRC / 'layouts/GameLayout.tsx').read_text()
DESK = (SRC / 'pages/game/deskScrapbookPass64.css').read_text()
SHELL = (SRC / 'styles/deskScrapbookShell64.css').read_text()


def test_scrapbook_art_direction_is_real_dom_not_a_baked_image():
    assert 'import "./deskScrapbookPass64.css"' in HOME
    assert 'p64b-postcard' in HOME
    assert 'p64b-portrait' in HOME
    assert 'p644-home-heading' in HOME
    assert 'p644-pinned-note' in HOME
    assert 'aria-label="Continue your adventure"' in HOME
    assert 'background:url(' not in HOME


def test_game_home_still_exposes_critical_actions():
    for expected in (
        'createRoom(selectedHeroId, adventureId, pendingPlayMode)',
        'joinRoom(selectedHeroId, roomCode)',
        'setSelectedHeroId(hero.character_id)',
        'setPendingJourneyExit({',
        'abandonAdventure(adventure.room_code)',
        'leaveAdventure(adventure.room_code, adventure.character_id)',
        'catalogSearch', 'selectedTag', 'RoomInviteButton', 'FirstRunGuide',
        'setPendingAdventure(adventure)',
    ):
        assert expected in HOME, expected


def test_mobile_is_one_journal_and_world_skin_not_overwritten():
    assert '@media(max-width:1050px)' in DESK
    assert 'grid-template-columns:1fr' in DESK
    assert '@media(max-width:640px)' in DESK
    assert '@media(max-width:410px)' in DESK
    assert 'prefers-reduced-motion:reduce' in DESK
    assert 'data-platform-skin=' in HOME
    # Site-wide theme and Reader styling are separate from home-only skin.
    assert 'import "../styles/deskScrapbookShell64.css"' in LAYOUT
    assert '.p64-shell.is-desk-home' in SHELL


def test_overlapping_cards_stay_keyboard_accessible():
    assert ':focus-within' in DESK
    assert ':focus-visible' in SHELL
    assert 'pointer-events:none' in DESK
    assert '<button' in HOME and '<Link' in HOME
