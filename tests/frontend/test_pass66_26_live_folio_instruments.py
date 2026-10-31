"""Pass 66.26 - live instruments are a reskin of real bindings, not a second system."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIVE = ROOT / "frontend/src/pages/game/InkboundLiveRoom.tsx"
STYLE = ROOT / "frontend/src/styles/quillairoFolioToolsPass6626.css"
MAIN = ROOT / "frontend/src/main.tsx"


def test_real_actions_and_source_data_are_preserved():
    source = LIVE.read_text()
    for required in (
        'props.hero.health', 'props.hero.max_health', 'props.hero.experience',
        '<HeroEffectList effects={props.hero?.effects}',
        'props.party.map((person)', 'person.is_online', 'person.is_host',
        'props.history.length', '[...props.history].reverse()',
        'entry.choices.map', 'entry.resolution', 'props.notes',
        'props.onNotesChange(event.target.value)', 'props.messages.map',
        'props.onSendChat(text)', 'maxLength={500}', 'props.connected',
        'props.sessionUtilities', 'setPanel("notes")',
        'setPanel("history")', 'role="dialog"', 'aria-modal="true"',
        'props.onLockChoice', 'props.onSelectChoice',
    ):
        assert required in source, required
    for forbidden in ('fetch(', 'socket.emit(', 'new WebSocket(', 'window.confirm(', 'localStorage.setItem('):
        assert forbidden not in source, forbidden


def test_panel_a11y_chat_and_real_effects():
    source = LIVE.read_text()
    for required in (
        'aria-label="Room party members"',
        'aria-label="Current Hero effects"',
        'aria-label="Party chat messages"',
        'role="log"', 'role="status"',
        'onSubmit={send}', 'disabled={!props.connected || !chatText.trim()}',
        'role="dialog"', 'onKeyDown={(event) => {',
        'setPanel(null)',
    ):
        assert required in source, required


def test_styles_are_scoped_and_theme_aware():
    css = STYLE.read_text()
    main = MAIN.read_text()
    assert 'import "./styles/quillairoFolioToolsPass6626.css";' in main
    for selector in (
        '.inkbound-live .ibl-drawer', '.ibl-folio-card',
        '.ibl-folio-history', '.ibl-folio-chat', '.ibl-folio-party-list',
        '.ibl-folio-utilities', ':focus-visible', '@media(max-width:760px)',
        '@media(prefers-reduced-motion:reduce)',
    ):
        assert selector in css
    assert 'var(--ia-paper)' in css and 'var(--ia-text)' in css
    assert ':root' not in css and '.intermission-game-feedback-host' not in css
