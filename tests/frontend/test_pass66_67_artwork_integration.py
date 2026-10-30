"""Pass 66.67 — one illustration, true-alpha approved art, no game changes."""
from pathlib import Path
import re
import pytest

ROOT = Path(__file__).resolve().parents[2]
READER = ROOT / 'frontend/src/pages/game/InkboundLiveRoom.tsx'
CSS = ROOT / 'frontend/src/pages/game/inkscapeArtworkPass6667.css'
ART = ROOT / 'frontend/public/art'


def test_one_visible_illustration_when_scene_art_is_ready():
    source = READER.read_text()
    assert 'loadedSceneArtUrl === props.sceneArtUrl' in source
    assert 'onLoad={() => setLoadedSceneArtUrl(props.sceneArtUrl ?? null)}' in source
    assert 'setLoadedSceneArtUrl(null); props.onSceneArtError?.()' in source
    assert 'data-artwork-state={sceneArtReady ? "scene-ready"' in source
    assert 'aria-hidden={sceneArtReady}' in source
    assert 'aria-hidden={!sceneArtReady}' in source
    stylesheet = CSS.read_text()
    assert '[data-artwork-state="scene-ready"] .ibl-art-fallback' in stylesheet
    assert '[data-artwork-state="scene-ready"] .ibl-art-scene' in stylesheet
    assert 'visibility:hidden' in stylesheet


def test_no_painted_edge_hiding_or_rectangular_crop():
    css = CSS.read_text()
    assert 'mask-image:none!important' in css
    assert 'clip-path:none!important' in css
    assert 'object-fit:contain!important' in css
    assert 'overflow:visible!important' in css
    assert not re.search(r'linear-gradient\(|radial-gradient\(|filter:blur\(|feather', css.replace('feathering',''))


def test_only_production_approved_alpha_fallbacks():
    production = (ROOT/'frontend/src/features/appearance/quillairoGenreArt.ts').read_text()
    for name in ('home-vista.png','living-worlds.png','auth-journey.png'):
        assert f'/art/quillairo-public/{name}' in production
        assert (ART/'quillairo-public'/name).is_file()
    assert 'pass64' not in production


def test_canonical_art_margin_samples_are_true_transparency():
    pillow = pytest.importorskip('PIL.Image', reason='Pillow optional in production; audited in build environment')
    targets = [
        ART/'quillairo-public/home-vista.png',
        ART/'quillairo-public/living-worlds.png',
        ART/'quillairo-public/auth-journey.png',
        ART/'quillairo-heroes/hero-hall-vista.png',
        ART/'quillairo-heroes/memorial-crossroads.png',
        ART/'inkbound/hero-vista.png',
        ART/'inkbound/north-road-editorial.png',
    ]
    for path in targets:
        with pillow.open(path) as im:
            assert 'A' in im.getbands(), f'not true RGBA: {path}'
            alpha = im.getchannel('A')
            bounds = alpha.point(lambda value:255 if value >= 8 else 0).getbbox()
            assert bounds is not None
            width,height=im.size
            left,top,right,bottom=bounds
            margin=(left/width, top/height, (width-right)/width, (height-bottom)/height)
            assert all(margin[index]+1/(width if index in (0,2) else height)>=.1 for index in range(4)), (path,margin)


def test_dice_and_server_flow_are_untouched():
    reader = READER.read_text()
    assert '<StoryReveal' in reader
    assert 'onLockChoice' in reader
    assert 'onResolutionHost' in reader
    assert 'sceneArtUrl?: string | null' in reader
    assert 'props.onSceneArtError?.()' in reader
    assert 'import "./inkscapeArtworkPass6667.css";' in reader
