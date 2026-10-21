"""Pass 65.6.1: all dashboard selectors share the existing custom contract."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DASHBOARD = (ROOT / "frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx").read_text()
STYLE = (ROOT / "frontend/src/pages/game/inkboundAuthenticatedDashboard.css").read_text()


def test_dashboard_uses_the_shared_custom_select_for_all_four_picker_sites():
    assert 'import { TerminalSelect } from "../../components/ui/TerminalSelect"' in DASHBOARD
    assert DASHBOARD.count('<TerminalSelect') == 4
    assert '<select' not in DASHBOARD
    assert 'ariaLabel="Find your kind of story"' in DASHBOARD
    assert 'ariaLabel="Hero used to start an adventure"' in DASHBOARD
    assert 'ariaLabel="Hero used to join the adventure"' in DASHBOARD
    assert 'ariaLabel="Hero used to enter the lobby"' in DASHBOARD


def test_picker_callbacks_and_unavailable_hero_guard_remain_connected():
    assert 'onChange={setFilter}' in DASHBOARD
    assert DASHBOARD.count('onChange={onSelectHero}') == 3
    assert DASHBOARD.count('disabled={!freeHeroes.length}') == 3
    assert 'value={selectedHeroId}' in DASHBOARD
    assert 'onJoin(roomCode.trim().toUpperCase())' in DASHBOARD
    assert 'onCreate(selectedStory,mode)' in DASHBOARD


def test_picker_visuals_derive_from_ink_theme_not_terminal_green():
    assert '.i656-select .terminal-select-trigger' in STYLE
    assert '.i656-select .terminal-select-menu button' in STYLE
    assert 'background:var(--paper)' in STYLE
    assert 'color:var(--paper-text)' in STYLE
    assert 'border:1px solid var(--paper-strong-rule)' in STYLE
