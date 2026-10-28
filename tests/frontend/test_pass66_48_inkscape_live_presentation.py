"""Pass 66.48: live Inkscape visual parity without touch of turn logic."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[2]
READER=ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx'
CSS=ROOT/'frontend/src/pages/game/quillairoInkscapeLivePass6648.css'

def test_stylesheet_is_loaded_by_existing_live_reader():
    text=READER.read_text()
    assert text.count('import "./quillairoInkscapeLivePass6648.css";') == 1
    assert text.index('import "./inkboundLiveRoom.css";') < text.index('import "./quillairoInkscapeLivePass6648.css";')

def test_visual_rules_are_scoped_and_responsive():
    css=CSS.read_text()
    assert css.count('{') == css.count('}')
    for selector in ('.inkbound-live .ibl-layout', '.inkbound-live .ibl-main', '.inkbound-live .ibl-instruments-disclosure', '.inkbound-live .ibl-prose', '.inkbound-live .ibl-choices', '.inkbound-live .ibl-choice', '.inkbound-live .ibl-sidebar-section'):
        assert selector in css
    for expected in ('@media (min-width:1100px)', '@media (max-width:760px)', 'prefers-reduced-motion:reduce'):
        assert expected in css
    assert 'url(' not in css, 'Pass may not introduce unapproved embedded artwork'
    assert not re.search(r'(^|\n)\s*(?:\.game-site-shell|\.arcade-|\.turn-|\.theater-)',css)

def test_existing_gameplay_handlers_are_present():
    reader=READER.read_text()
    for required in ('props.onSelectChoice(choice)', 'props.onLockChoice', 'props.onSendChat(text)', 'props.onToggleStoryTime','props.onNotesChange','props.chapterReleased','props.scene.choices.map','props.hero','props.party.map'):
        assert required in reader
