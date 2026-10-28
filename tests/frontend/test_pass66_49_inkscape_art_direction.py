"""Pass 66.49: visual restraint without changing production gameplay contracts."""
from pathlib import Path

from tests.support import PROJECT_ROOT

ROOT=Path(PROJECT_ROOT)

def source(p: str) -> str:
    return (ROOT / p).read_text(encoding='utf-8')


def test_public_home_uses_approved_editorial_headline_and_live_actions():
    home=source('frontend/src/pages/public/PublicHomePage.tsx')
    assert 'Living adventures,' in home
    assert 'written as you play.' in home
    assert 'AI-POWERED ADVENTURES' in home
    assert 'qpub-hero-note' not in home
    for contract in ('authenticated ? "/game" : "/register"','setSampleChoice(index)','id="story-preview"','id="worlds"','id="how-it-works"','dice decide the risk','home-vista.png'):
        assert contract in home, contract


def test_artwork_is_not_flattened_into_uniform_grayscale_or_grain():
    css=source('frontend/src/styles/quillairoPublicPass6612.css')
    dashboard=source('frontend/src/pages/game/inkboundAuthenticatedDashboard.css')
    assert '.qpub-world-frame img{' in css and 'filter:grayscale(.55)' not in css
    assert 'filter:grayscale(1)' not in dashboard
    assert '--paper-grain:' not in dashboard
    assert 'filter:invert(.87)' in css  # retain the explicitly authored dark-paper adaptation


def test_editorial_world_atlas_has_quiet_surfaces_and_live_selection():
    atlas=source('frontend/src/pages/game/quillairoAtlasPass6645.css')
    dashboard=source('frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx')
    assert '--q45-surface:transparent;' in atlas
    assert 'i656-dialog:before' not in atlas
    assert 'const selectedHero = freeHeroes.find' in dashboard
    assert 'onClick={() => inspect(item)}' in dashboard
    assert 'onCreate(selectedStory,mode)' in dashboard
    assert 'onJoin(roomCode.trim().toUpperCase())' in dashboard


def test_non_phosphor_edition_no_longer_defaults_to_typewriter_typography():
    css=source('frontend/src/pages/game/inkboundAuthenticatedDashboard.css')
    assert '--paper-type:"Iowan Old Style","Baskerville"' in css
    assert '--paper-type:ui-monospace,SFMono-Regular,Menlo,monospace' in css
    assert '.i656-primary-action' in css
    assert '.inkbound-home :is(button,a,input):focus-visible' in css


def test_release_patch_explicitly_limits_its_own_targets():
    patch=source('scripts/pass66_49_apply.py')
    assert 'frontend/src/pages/public/PublicHomePage.tsx' in patch
    assert 'frontend/src/pages/game/inkboundAuthenticatedDashboard.css' in patch
    assert 'tests/frontend/test_public_shell.py' in patch
    for forbidden in ('app/main.py', 'app/generation/director.py', 'useTurnTheater.ts', 'TurnResolutionTheater.tsx', 'gameSocket.ts'):
        assert forbidden not in patch
