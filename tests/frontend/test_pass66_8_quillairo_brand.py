"""Approved Quillairo brand integration contracts; stdlib only."""
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'frontend'
BRAND = WEB / 'public' / 'brand'


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def png_rgba(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path.name
    assert data[25] == 6, f'{path.name}: RGBA with real alpha required'
    return struct.unpack('>II', data[16:24])


def test_approved_logo_library_preserved_and_has_alpha():
    for asset in ['primary-light.png', 'secondary-dark.png', 'monogram-ink.png', 'seal-gold.png']:
        w, h = png_rgba(BRAND / asset)
        assert w >= 300 and h >= 100
    for asset in ['primary-original.png', 'secondary-original.png', 'monogram-original.png', 'seal-original.png']:
        png_rgba(BRAND / asset)
    assert (BRAND / 'favicon.ico').read_bytes()[:4] == b'\x00\x00\x01\x00'


def test_logo_component_uses_approved_real_images_and_preserves_ai():
    component = source('frontend/src/components/brand/BrandLockup.tsx')
    css = source('frontend/src/styles/quillairoBrand.css')
    assert '/brand/primary-light.png' in component
    assert '/brand/secondary-dark.png' in component
    assert 'filter:none!important' in css
    assert 'data-ink-paper="navy"' in css
    assert 'data-ink-paper="phosphor"' in css
    assert 'data-ink-paper="midnight"' in css
    assert 'mix-blend-mode:normal!important' in css


def test_primary_surfaces_use_approved_wordmark():
    for f in [
        'frontend/src/layouts/PublicLayout.tsx',
        'frontend/src/layouts/GameLayout.tsx',
        'frontend/src/layouts/AccountLayout.tsx',
        'frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx',
        'frontend/src/pages/game/InkboundLiveRoom.tsx',
        'frontend/src/pages/game/InkboundLobby.tsx',
    ]:
        s = source(f)
        assert 'BrandLockup' in s, f
        assert 'Tales of Two home' not in s, f
    assert 'size="hero"' in source('frontend/src/pages/public/PublicHomePage.tsx')


def test_official_app_metadata_and_six_palettes():
    html = source('frontend/index.html')
    assert '<title>Quillairo' in html
    for filename in ['favicon.ico', 'apple-touch-icon.png', 'site.webmanifest']:
        assert filename in html
    manifest = json.loads((BRAND / 'site.webmanifest').read_text(encoding='utf-8'))
    assert manifest['short_name'] == 'Quillairo'
    assert len(manifest['icons']) >= 2
    tokens = json.loads((BRAND / 'tokens.json').read_text(encoding='utf-8'))
    assert set(tokens['themes']) == {'ivory','cream','parchment','navy','phosphor','midnight'}


def test_gameplay_and_legacy_identifier_contract_preserved():
    assert 'type InkPaper' in source('frontend/src/features/appearance/inkboundPaper.ts')
    assert 'inkbound' in source('frontend/src/pages/game/AdventurePage.tsx').lower()
    assert 'X-TOT-Account-Request' in source('frontend/src/services/auth.ts')
