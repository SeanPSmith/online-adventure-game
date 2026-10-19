"""Pass 64.4F — isolated cosmetic/environment preview contract guards."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
ART = ROOT / "frontend/public/art/pass64/pass64-4d-tabletop-book.webp"


def test_protected_environment_preview_route_is_isolated():
    router = (SRC / "router.tsx").read_text()
    assert 'path: "game/space-lab"' in router
    assert 'element: <RequireAuth />' in router
    assert 'SpaceBookPlaygroundPage' in router
    assert 'path: "game/ink-lab"' in router
    assert 'path: "game/visual-playground"' in router
    assert 'path: "game",' in router


def test_stage_keeps_blank_baseline_and_existing_ink_experiment():
    text = (SRC / "pages/game/VisualBookPlaygroundPage.tsx").read_text()
    assert 'return <VisualBookPlaygroundShell />;' in text
    assert 'return <VisualBookPlaygroundShell inkLab />;' in text
    assert 'return <VisualBookPlaygroundShell spaceLab />;' in text
    assert '{inkLab ? <InkLabBook activeTab={active} /> : null}' in text
    assert '{spaceLab ? <SpaceLab onLightingChange={setLighting} /> : null}' in text
    assert 'pass64-4d-tabletop-book.webp' in text


def test_only_local_catalog_assets_and_no_billing_or_gameplay_mutations():
    model = (SRC / "features/cosmetics/environmentCatalog.ts").read_text()
    scene = (SRC / "pages/game/SpaceLab.tsx").read_text()
    assert "function resolveScene(" in model
    assert '"follow_world" | "my_setup" | "custom_mix"' in model
    assert 'owned.has(id)' in model
    assert 'item.slot !== slot' in model
    assert 'item.layoutVersion !== SCENE_COMPOSITING.layoutVersion' in model
    assert 'isCatalogAssetPath(item.asset)' in model
    assert 'bakedProps: true' in model
    assert 'cleanPlateAvailable: false' in model
    assert 'type="checkbox"' in scene
    assert 'type="radio"' in scene
    assert 'aria-expanded={isOpen}' in scene
    assert 'onLightingChange(light)' in scene
    for text in (model, scene):
        for forbidden in ("stripe", "checkout", "fetch(", "axios", "localStorage.", "script src", "innerHTML"):
            assert forbidden not in text


def test_safe_zones_use_source_aligned_cover_coordinates():
    """Check real page geometry rather than freezing an old Pass 64.4F inset.

    Later manuscript passes intentionally widen the printable leaves, so the
    original 0.267/0.563/0.258 coordinates are no longer the desired layout.
    Assert the scene-to-book projection and the actual readable margins.
    """
    css = (SRC / "pages/game/spaceLab.css").read_text(encoding="utf-8")
    scene = (SRC / "pages/game/SpaceLab.tsx").read_text(encoding="utf-8")
    model = (SRC / "features/cosmetics/environmentCatalog.ts").read_text(encoding="utf-8")

    # The projection is calibrated to the 1672x941 source image. This must
    # remain scene-relative even as the numerical ink-safe bounds evolve.
    assert '177.6833vh' in css and '56.2799vw' in css
    for token in ('.space-scene-plane', '.space-safe-space', '.space-spine-guide',
                  '.vb-lab.has-space .vb-scene',
                  '@media(prefers-reduced-motion:reduce)'):
        assert token in css
    assert ART.is_file() and ART.stat().st_size > 100_000

    # Either the 64.4G dashed-rectangle guides OR the optional 64.4G.2 SVG
    # polygon renderer may be installed. Both must use the SAME source image
    # geometry as Inkspace; mixing JSX from one renderer with CSS from the
    # other is a real bug, not an acceptable compatibility variation.
    for side in ('left', 'right'):
        assert f'sceneRectStyle(SCENE_COMPOSITING.contentSafeZones.{side})' in scene
    story = (SRC / 'pages/game/InkspaceStoryPage.tsx').read_text(encoding='utf-8')
    assert 'sceneRectStyle(SCENE_COMPOSITING.contentSafeZones[side])' in story
    has_polygon_markup = 'className="space-page-polygon"' in scene
    has_polygon_css = '.space-page-polygon{' in css
    assert has_polygon_markup == has_polygon_css, 'Space Lab guide markup/CSS versions must match'
    if has_polygon_markup:
        assert '<svg' in scene and '<polygon points={safeZonePolygonPoints(' in scene
        assert 'viewBox="0 0 100 100"' in scene
        assert 'vector-effect:non-scaling-stroke' in css
        for side in ('left', 'right'):
            assert f'safeZonePolygonPoints("{side}")' in scene
    else:
        assert 'safeZonePolygonPoints(' not in scene
        assert 'border:2px dashed' in css, 'legacy guides must remain visible'

    assert 'validatesSpineAlignedSafeZones' in model
    assert 'contentSafePolygons:' in model
    spine = re.search(r'\bspineX:\s*([\d.]+)', model)
    assert spine is not None
    spine_x = float(spine.group(1))

    def rect(name: str):
        found = re.search(rf'\b{name}:\s*\{{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*width:\s*([\d.]+),\s*height:\s*([\d.]+)', model)
        assert found is not None, f'missing scene rectangle: {name}'
        return tuple(float(value) for value in found.groups())

    left_page, right_page = rect('leftPage'), rect('rightPage')
    left, right = rect('left'), rect('right')
    assert left_page[0] + left_page[2] < spine_x < right_page[0]
    assert left[0] + left[2] < spine_x < right[0]
    for page, ink in ((left_page, left), (right_page, right)):
        assert page[0] < ink[0] < ink[0] + ink[2] < page[0] + page[2]
        assert page[1] < ink[1] < ink[1] + ink[3] < page[1] + page[3]

    # Both leaves may be different widths, but must keep comparable page-relative
    # outer and gutter insets, with extra clearance for exterior botanicals.
    lo = (left[0] - left_page[0]) / left_page[2]
    lg = (left_page[0] + left_page[2] - left[0] - left[2]) / left_page[2]
    ro = (right_page[0] + right_page[2] - right[0] - right[2]) / right_page[2]
    rg = (right[0] - right_page[0]) / right_page[2]
    assert 0 < lg < lo < 0.2
    assert 0 < rg < ro < 0.2
    assert abs(lo - ro) < 0.015
    assert abs(lg - rg) < 0.015


def test_same_origin_catalog_paths_and_no_external_scripts():
    model = (SRC / "features/cosmetics/environmentCatalog.ts").read_text()
    urls = re.findall(r'asset: "([^"]+)"', model)
    assert urls
    for url in urls:
        assert url.startswith('/art/') and '..' not in url
        assert (ROOT / 'frontend/public' / url.lstrip('/')).exists(), url
