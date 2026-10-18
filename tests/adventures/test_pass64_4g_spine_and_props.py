"""Pass 64.4G: measured spine composition and catalog-only prop proofs."""
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[2]
F = ROOT / "frontend"
MODEL = (F / "src/features/cosmetics/environmentCatalog.ts").read_text()
CSS = (F / "src/pages/game/spaceLab.css").read_text()
UI = (F / "src/pages/game/SpaceLab.tsx").read_text()
INK_CSS = (F / "src/pages/game/inkLabBook.css").read_text()


def parse_rect(name: str):
    match = re.search(rf"{name}:\s*\{{\s*x:\s*([0-9.]+),\s*y:\s*([0-9.]+),\s*width:\s*([0-9.]+),\s*height:\s*([0-9.]+)", MODEL)
    assert match, name
    return tuple(float(x) for x in match.groups())


def test_scene_plate_is_original_unmodified_and_spine_calibrated():
    scene = F / "public/art/pass64/pass64-4d-tabletop-book.webp"
    assert scene.exists() and scene.stat().st_size > 100_000
    assert 'imageWidth: 1672, imageHeight: 941' in MODEL
    assert 'spineX: 0.523' in MODEL
    left_page, right_page, left, right = (parse_rect(k) for k in ('leftPage','rightPage','left','right'))
    spine = .523
    assert left_page[0] < left[0] < left[0] + left[2] < spine
    assert spine < right[0] < right[0] + right[2] < right_page[0] + right_page[2]
    assert left[0] - left_page[0] > spine - (left[0] + left[2])
    assert right_page[0] + right_page[2] - (right[0] + right[2]) > right[0] - spine
    for p, r in ((left_page,left),(right_page,right)):
        assert p[1] < r[1] and r[1] + r[3] < p[1] + p[3]
    assert '.space-spine-guide' in CSS
    assert 'sceneRectStyle(SCENE_COMPOSITING.contentSafeZones.left)' in UI
    assert 'sceneRectStyle(SCENE_COMPOSITING.contentSafeZones.right)' in UI
    assert 'sceneRectStyle(SCENE_COMPOSITING.propAnchors' not in UI or 'const anchor = SCENE_COMPOSITING.propAnchors[item.anchorId]' in UI


def test_catalog_assets_are_real_transparent_local_webp():
    for name in ('pressed-fern','wax-seal','ink-bottle','wildflowers'):
        p = F / f'public/art/pass64/scene-kit/{name}.webp'
        raw = p.read_bytes()
        assert raw.startswith(b'RIFF') and raw[8:12] == b'WEBP'
        assert struct.unpack_from('<I',raw,4)[0] == len(raw)-8
        assert 1_000 < len(raw) < 60_000
        # WebP extended format contains alpha flag in VP8X first byte.
        x = raw.index(b'VP8X')
        assert raw[x+8] & 0x10, name
        assert f'/art/pass64/scene-kit/{name}.webp' in MODEL


def test_optional_prop_slots_are_independently_resolved_and_non_gameplay():
    assert '"prop.left.none"' in MODEL and '"prop.right.none"' in MODEL
    assert 'prop_left: "prop.left.none", prop_right: "prop.right.none"' in MODEL
    assert 'prop_left: myLeft, prop_right: myRight' in UI
    assert 'prop_left: followForProps, prop_right: followForProps' in UI
    assert 'result[slot].item' in UI
    assert 'alt=""' in UI and 'aria-hidden="true"' in UI
    assert '<select' not in UI
    assert 'type="radio"' in UI and 'TerminalSelect' in UI
    assert 'cleanPlateAvailable: false' in MODEL and 'bakedProps: true' in MODEL
    for content in (UI,MODEL):
        assert all(s not in content for s in ('checkout','stripe','localStorage.','fetch(','innerHTML'))


def test_ink_content_is_inset_further_from_outer_paper_edges():
    assert 'inset:7% 12% 8% 10%' in INK_CSS
    assert 'grid-template-columns:44% 44%;gap:12%' in INK_CSS
    assert 'mask-size:100% 100%' in INK_CSS
    assert 'opacity:0' not in INK_CSS
    assert '@media(max-width:860px)' in INK_CSS
    assert 'prefers-reduced-motion:reduce' in INK_CSS
