"""Pass 66.9 - no duplicate wordmarks, safe manuscript initial, theme integrity."""
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]

def src(name): return (ROOT / name).read_text(encoding='utf-8')


def test_lockup_renders_one_approved_image_only_and_selects_theme():
    component = src('frontend/src/components/brand/BrandLockup.tsx')
    assert component.count('<img className="quillairo-lockup__art"') == 1
    assert 'paper?: InkPaper' in component
    assert 'paper === "midnight"' in component
    assert 'paper === "navy"' in component and 'paper === "phosphor"' in component
    assert '/brand/primary-light.png' in component
    assert '/brand/secondary-dark.png' in component
    assert 'const src = dark ? ' in component
    assert 'quillairo-lockup__on-light' not in component
    assert 'quillairo-lockup__on-dark' not in component


def test_all_authenticated_brand_headers_supply_theme():
    for name, expected in [
        ('layouts/GameLayout.tsx', 'paper'),
        ('layouts/AccountLayout.tsx', 'paper'),
        ('pages/game/InkboundAuthenticatedDashboard.tsx', 'paper'),
        ('pages/game/InkboundLiveRoom.tsx', 'props.paper'),
        ('pages/game/InkboundLobby.tsx', 'props.paper'),
    ]:
        code = src('frontend/src/' + name)
        assert f'<BrandLockup paper={{{expected}}} />' in code, name


def test_new_dark_wordmark_is_true_alpha_png():
    data = (ROOT/'frontend/public/brand/secondary-dark.png').read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    width,height,depth,kind=struct.unpack('>IIBB', data[16:26])
    assert width >= 1200 and height >= 400 and depth == 8 and kind == 6


def test_dropcap_keeps_one_word_per_reveal_token_in_both_modes():
    story = src('frontend/src/features/adventure/StoryReveal.tsx')
    assert story.count('withOpeningInitial(token, decorativeInitials && current === 0)') == 2
    assert 'const current = wordIndex++;' in story
    assert 'sceneId, text, animate, totalWords' in story
    assert 'story-reveal-dropcap' in story
    assert 'data-decorative-initials={decorativeInitials}' in story
    css = src('frontend/src/styles/inkboundStoryParityPass662.css')
    assert '.inkbound-live .ibl-prose .story-reveal[data-decorative-initials="true"] .story-reveal-dropcap' in css
    assert 'float:left' in css


def test_midnight_uses_cream_ink_and_does_not_change_paper():
    css = src('frontend/src/styles/inkboundSystemPass660.css')
    pos = css.index('[data-ink-paper="midnight"]')
    declaration=css[pos:css.index('}',pos)]
    assert '--ib-paper:#141516' in declaration
    assert '--ib-text:#f4e9d6' in declaration
    for name in ['frontend/src/pages/game/inkboundAuthenticatedDashboard.css', 'frontend/src/pages/game/inkboundPass658.css']:
        sheet=src(name)
        ix=sheet.index('[data-ink-paper="midnight"]')
        rule=sheet[ix:sheet.index('}',ix)]
        assert '#f4e9d6' in rule
