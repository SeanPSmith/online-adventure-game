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
    css = (SRC / "pages/game/spaceLab.css").read_text()
    assert '177.6833vh' in css and '56.2799vw' in css
    assert '.space-safe-left' in css and '.space-safe-right' in css
    assert '.space-scene-plane' in css and '.space-spine-guide' in css
    assert '.vb-lab.has-space .vb-scene' in css
    assert '@media(prefers-reduced-motion:reduce)' in css
    assert ART.is_file() and ART.stat().st_size > 100_000
    model = (SRC / "features/cosmetics/environmentCatalog.ts").read_text()
    assert 'validatesSpineAlignedSafeZones' in model
    assert 'spineX: 0.523' in model
    for coordinate in ('x: 0.267', 'x: 0.563', 'y: 0.258'):
        assert coordinate in model


def test_same_origin_catalog_paths_and_no_external_scripts():
    model = (SRC / "features/cosmetics/environmentCatalog.ts").read_text()
    urls = re.findall(r'asset: "([^"]+)"', model)
    assert urls
    for url in urls:
        assert url.startswith('/art/') and '..' not in url
        assert (ROOT / 'frontend/public' / url.lstrip('/')).exists(), url
