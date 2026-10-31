"""Pass 66.2: real story presentation tracks the approved chapter reference.

Static contract tests deliberately avoid requiring Pillow or new runtime packages.
No backend mechanics, Story Time sequencing, dice receipts, or tests are altered.
"""
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[2]
ROOM = (ROOT / 'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text(encoding='utf-8')
CSS = (ROOT / 'frontend/src/styles/inkboundStoryParityPass662.css').read_text(encoding='utf-8')
MAIN = (ROOT / 'frontend/src/main.tsx').read_text(encoding='utf-8')


def test_story_reference_production_screens_not_a_decorative_mockup():
    assert 'import "./styles/inkboundStoryParityPass662.css";' in MAIN
    assert 'props.scene.choices.map' in ROOM
    assert 'props.scene.body' in ROOM
    assert '<StoryReveal' in ROOM
    assert 'props.narrationCue' in ROOM and 'followNarration' in ROOM
    assert 'props.onSelectChoice(choice)' in ROOM
    assert 'props.onLockChoice' in ROOM
    assert 'Only the server decides the outcome' in ROOM
    assert '<figure className="ibl-chapter-illustration"' in ROOM
    assert '<section className="ibl-status-strip"' in ROOM
    assert '<details className="ibl-instruments-disclosure" open>' in ROOM
    assert 'props.messages.map' in ROOM
    assert 'props.sessionUtilities' in ROOM
    for forbidden in ('window.confirm(', '<select', 'Math.random(', 'fetch('):
        assert forbidden not in ROOM


def test_marginal_controls_stay_reachable_with_sticky_sidebar():
    for panel in ('menu','journal','party','chat','hero','history','notes'):
        assert f'"{panel}"' in ROOM
    assert 'panel === "menu"' in ROOM
    assert 'role="dialog"' in ROOM and 'aria-modal="true"' in ROOM
    assert 'event.key === "Escape"' in ROOM
    assert 'onToggleStoryTime' in ROOM
    assert 'onNotesChange' in ROOM
    assert 'onSendChat' in ROOM


def test_reference_composition_scopes_styles_to_live_story_only():
    for selector in ('.ibl-layout','.ibl-main','.ibl-chapter-illustration',
                     '.ibl-prose','.ibl-choices','.ibl-choice','.ibl-status-strip',
                     '.ibl-instruments-disclosure','.ibl-drawer'):
        assert '.inkbound-live ' + selector in CSS, selector
    assert 'grid-template-columns:repeat(3,minmax(0,1fr))' in CSS
    assert 'grid-template-columns:1fr!important' in CSS
    assert 'min-width:0' in CSS
    assert 'prefers-reduced-motion:reduce' in CSS
    assert 'object-fit:cover' in CSS and 'object-position:center center' in CSS
    assert 'feather' not in CSS.lower()
    assert 'mask-image' not in CSS
    assert 'radial-gradient' not in CSS
    for theme in ('ivory','cream','parchment','navy','phosphor','midnight'):
        assert theme in (ROOT / 'frontend/src/pages/game/inkboundAdventurePass657.css').read_text()


def test_panorama_has_real_png_rgba_channel_and_is_independent_of_css_paper():
    art = ROOT / 'frontend/public/art/inkbound/north-road-editorial.png'
    content = art.read_bytes()
    assert content[:8] == b'\x89PNG\r\n\x1a\n'
    assert content[12:16] == b'IHDR'
    width,height,bit_depth,color_type = struct.unpack('>IIBB',content[16:26])
    assert width >= 1400 and height >= 700
    assert bit_depth == 8 and color_type == 6  # true RGBA, not flattened RGB
    assert "background-image:" not in CSS


def test_css_imports_resolve_and_no_native_dropdowns_reintroduced():
    for css_rel in re.findall(r'import\s+[\'"]([^\'"]+\.css)[\'"]', MAIN):
        assert (ROOT/'frontend/src'/css_rel).is_file(),css_rel
    react = '\n'.join(f.read_text(encoding='utf-8') for f in (ROOT/'frontend/src').rglob('*.tsx'))
    assert '<select' not in react
