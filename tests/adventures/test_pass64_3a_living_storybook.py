"""Pass 64.3A presentation contract: preserve gameplay while making the flagship real."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'frontend' / 'src'
def read(path): return (SRC / path).read_text(encoding='utf-8')

def test_saved_appearance_preferences_remain_compatible():
    contract = read('features/appearance/themeContract.ts')
    assert "platformSkin: 'brighter-world'" in contract
    for skin in ('brighter-world', 'wanderers-desk', 'midnight-codex', 'clear-journal'):
        assert f"'{skin}'" in contract
    assert 'normalizeAppearance' in contract
    assert 'verifiedEntitlements' in contract

def test_production_home_has_live_service_callbacks_and_no_retired_book():
    home = read('pages/game/GameHomePage.tsx')
    hall = read('pages/game/InkboundAuthenticatedDashboard.tsx')
    for marker in ('useGameSocket()', 'listCharacters()',
                   'createRoom(selectedHeroId, item.adventure_id, mode)',
                   'joinRoom(selectedHeroId, code)',
                   'onLeaveAdventure={leaveAdventure}',
                   'onAbandonAdventure={abandonAdventure}',
                   'clearRoomEntry()', 'refreshCatalog();'):
        assert marker in home
    for marker in ('setSelectedStory(', 'onCreate(selectedStory,mode)',
                   'onAbandonAdventure(exitJourney.room_code)'):
        assert marker in hall
    assert 'p644-bound-book' not in home

def test_narration_and_turns_remain_authoritative():
    adventure = read('pages/game/AdventurePage.tsx')
    assert 'useTurnTheater' in adventure
    assert 'theater.chapterReleased && scene?.body' in adventure
    assert 'StoryReveal' in adventure
    assert 'decorativeInitials={storyPreferences.decorativeInitials' in adventure
    assert 'readingTypeface={worldSkin.reader === "plain"' in adventure
    assert 'storyPreferences.wordReveal && theater.phase === "none"' in adventure

def test_type_options_have_simple_accessible_fallback():
    settings = read('pages/account/SettingsPage.tsx')
    prefs = read('services/storyPreferences.ts')
    reveal = read('features/adventure/StoryReveal.tsx')
    css = read('pages/game/adventureLiterary643.css')
    assert 'readStoryDisplayPreferences' in settings
    assert 'writeStoryDisplayPreferences({ ...storyDisplay,' in settings
    assert 'decorativeInitials: boolean' in prefs
    assert 'readingTypeface:' in prefs
    assert 'data-reading-typeface={readingTypeface}' in reveal
    assert 'sr-only' in reveal
    assert 'data-reading-typeface="plain"' in css
    assert 'prefers-reduced-motion:reduce' in css

def test_no_transition_overlay_or_native_controls_added():
    layout = read('layouts/GameLayout.tsx')
    assert 'BookPageTurn' not in layout
    for p in (SRC/'pages/game/GameHomePage.tsx', SRC/'pages/account/SettingsPage.tsx'):
        assert '<select' not in p.read_text(encoding='utf-8')
    assert 'p643-arrive' in read('styles/brighterWorldShell.css')


def test_curated_images_are_real_small_assets():
    art = ROOT / 'frontend/public/art/pass64'
    for filename in ('brighter-desk.webp', 'brighter-vista.webp', 'brighter-paper.webp'):
        file = art / filename
        assert file.is_file()
        assert 1_000 < file.stat().st_size < 300_000
