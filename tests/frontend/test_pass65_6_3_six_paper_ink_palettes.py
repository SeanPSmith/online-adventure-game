"""Pass 65.6.3 — six intentionally curated Inkbound palettes and account storage.

Uses no dependencies outside Python's stdlib; protects existing release contracts.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
THEMES = (ROOT / 'frontend/src/features/appearance/inkboundPaper.ts').read_text()
SWATCHES = (ROOT / 'frontend/src/features/appearance/inkboundPaperPreferences.css').read_text()
COMPONENT = (ROOT / 'frontend/src/features/appearance/InkboundPaperPreferences.tsx').read_text()
HOME = (ROOT / 'frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx').read_text()
HOME_CSS = (ROOT / 'frontend/src/pages/game/inkboundAuthenticatedDashboard.css').read_text()
ACCOUNT = (ROOT / 'frontend/src/pages/account/AccountPage.tsx').read_text()
IDS = ('chalk', 'ivory', 'cream', 'navy', 'phosphor', 'midnight')


def test_all_six_themes_present_on_dashboard_and_swatches():
    for paper in IDS:
        assert f'id: "{paper}"' in THEMES
        assert f'.inkbound-home[data-ink-paper="{paper}"]' in HOME_CSS
        assert f'.inkpaper-option[data-ink-paper="{paper}"]' in SWATCHES
        assert re.search(rf'\.inkbound-home\[data-ink-paper="{paper}"\]\s*\{{[^}}]*--paper-text:', HOME_CSS)
    assert 'data-ink-paper={paper}' in HOME
    assert 'data-ink-paper={paper.id}' in COMPONENT


def test_account_preferences_is_owner_of_swatch_picker():
    assert '<InkboundPaperPreferences />' in ACCOUNT
    assert 'activeTab === "preferences"' in ACCOUNT
    assert 'aria-pressed={selectedPaper === paper.id}' in COMPONENT
    assert 'role="group" aria-label="Inkbound paper and ink theme"' in COMPONENT
    assert 'id="inkbound-paper"' in COMPONENT
    assert 'to="/account?tab=preferences#inkbound-paper"' in HOME
    assert 'i656-paper-menu' not in HOME
    assert '<select' not in HOME and '<select' not in COMPONENT


def test_saved_preference_is_player_scoped_and_previous_tan_migrates():
    assert 'tot:inkbound:paper:${userId}' in THEMES
    assert 'if (value === "parchment") return "cream";' in THEMES
    assert 'localStorage.setItem(inkPaperStorageKey(userId), value)' in THEMES
    assert 'useInkboundPaper(userId)' in HOME
    assert 'useInkboundPaper(user?.user_id ?? "")' in COMPONENT
    assert 'window.addEventListener("storage", onStorage)' in THEMES
    assert 'window.addEventListener(INKBOUND_PAPER_EVENT, onLocalChange)' in THEMES


def test_dark_palette_is_readable_and_ink_art_keeps_alpha():
    for paper in ('navy', 'phosphor', 'midnight'):
        palette = re.search(rf'\.inkbound-home\[data-ink-paper="{paper}"\]\s*\{{([^}}]*)\}}', HOME_CSS)
        assert palette and 'color-scheme:dark' in palette.group(1)
        assert f'[data-ink-paper="{paper}"]' in HOME_CSS
    for forbidden in ('mask-image:', 'clip-path:', 'mix-blend-mode:screen'):
        assert forbidden not in HOME_CSS
    assert 'north-road-editorial.png' in HOME
    assert 'position:absolute' not in HOME


def test_existing_game_and_scroll_contracts_retained():
    assert 'onCreate(selectedStory,mode)' in HOME
    assert 'onJoin(roomCode.trim().toUpperCase())' in HOME
    assert 'onChange={onSelectHero}' in HOME
    assert '<TerminalSelect' in HOME
    assert 'max-height:none!important' in HOME_CSS
    assert 'overflow:visible!important' in HOME_CSS
