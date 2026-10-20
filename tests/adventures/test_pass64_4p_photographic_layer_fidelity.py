"""Pass 64.4P — independent scene photomaterials (no game-state changes)."""
from pathlib import Path
import re
import struct
import zlib

def rgba_alpha_samples(path: Path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    off = 8
    packed = bytearray()
    width = height = color = None
    while off < len(data):
        count = int.from_bytes(data[off:off+4], "big")
        kind = data[off+4:off+8]
        payload = data[off+8:off+8+count]
        if kind == b"IHDR":
            width, height, depth, color, *_ = struct.unpack(">IIBBBBB", payload)
            assert depth == 8 and color == 6, "Expected true RGBA PNG"
        if kind == b"IDAT": packed.extend(payload)
        off += count+12
    raw = zlib.decompress(bytes(packed))
    stride = width*4
    prev = bytearray(stride)
    alphas = []
    pos = 0
    for _ in range(height):
        mode = raw[pos]; pos+=1
        row = bytearray(raw[pos:pos+stride]); pos+=stride
        for i in range(stride):
            left = row[i-4] if i >= 4 else 0
            up = prev[i]
            ul = prev[i-4] if i >= 4 else 0
            if mode == 1: predictor = left
            elif mode == 2: predictor = up
            elif mode == 3: predictor = (left+up)//2
            elif mode == 4:
                q=left+up-ul
                a,b,c=abs(q-left),abs(q-up),abs(q-ul)
                predictor=left if a <= b and a <= c else (up if b <= c else ul)
            elif mode == 0: predictor = 0
            else: raise ValueError("Unsupported PNG filter")
            row[i] = (row[i]+predictor)&255
        alphas.extend(row[3::4])
        prev=row
    return width,height,alphas


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'frontend/src'
ART = ROOT / 'frontend/public/art/pass64/scene-kit'


def test_real_alpha_cutouts_have_translucent_edges_not_rectangular_photos():
    for name in ('wax-seal-photographic.png', 'brass-compass-photographic.png'):
        path = ART / name
        assert path.is_file()
        width, height, alpha = rgba_alpha_samples(path)
        assert width >= 200 and height >= 150
        assert alpha.count(0) > width * height * .13
        assert sum(a >= 240 for a in alpha) > width * height * .32
        assert sum(0 < a < 239 for a in alpha) > 150
        assert alpha[0] == 0



def test_photo_materials_are_opt_in_catalog_only_and_scene_stays_server_safe():
    model = (SRC / 'features/cosmetics/environmentCatalog.ts').read_text()
    for name in ('wax-seal-photographic.png', 'brass-compass-photographic.png'):
        assert f'/art/pass64/scene-kit/{name}' in model
    assert 'photographic-alpha' in model
    assert 'physicalLayerOrder:' in model
    assert 'cleanPlateAvailable: false' in model and 'bakedProps: true' in model
    assert 'Photographic Study' in model
    for forbidden in ('checkout(', 'purchase(', 'localStorage.setItem(', 'fetch('):
        assert forbidden not in model


def test_alpha_props_use_shared_source_projection_and_silhouette_shadows():
    ui = (SRC/'pages/game/SpaceLab.tsx').read_text()
    css = (SRC/'pages/game/spaceLab.css').read_text()
    assert 'sceneRectStyle(anchor)' in ui and 'SCENE_COMPOSITING.propAnchors' in ui
    assert 'is-photographic' in ui
    assert 'alt=""' in ui  # imagery is intentionally decorative; picker names items
    assert 'pointer-events:none' in css
    assert '.space-overlay-prop.is-photographic' in css
    assert 'drop-shadow(' in css and 'box-shadow:0' not in css.split('.space-overlay-prop.is-photographic')[1][:250]
    assert 'prefers-reduced-motion:reduce' in css


def test_photo_ink_ribbon_has_real_fibers_without_baked_menu_labels():
    texture = ART/'parchment-ribbon-grain.webp'
    assert texture.is_file()
    assert texture.stat().st_size > 5_000
    assert texture.read_bytes()[:4] == b"RIFF"
    css = (SRC/'pages/game/visualBookPlayground.css').read_text()
    assert 'parchment-ribbon-grain.webp' in css
    assert 'background-repeat:no-repeat' in css
    ui = (SRC/'pages/game/VisualBookPlaygroundPage.tsx').read_text()
    assert 'className={`vb-nav-item' in ui
    assert 'aria-label="Visual playground — menu style preview"' in ui


def test_dev_workshop_not_player_store_and_public_routes_untouched():
    page = (SRC/'pages/game/DevWorkshopPage.tsx').read_text()
    assert 'path: "space-lab"' in page
    assert '/dev/${lab.path}' in page
    assert 'Photographic alpha anchors' in page
    assert 'to="/game"' in page
