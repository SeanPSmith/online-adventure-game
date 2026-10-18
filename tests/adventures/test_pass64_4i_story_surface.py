"""Pass 64.4I: isolated illustrated manuscript surface; no game-state changes."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend/src/pages/game"


def read(path):
    return path.read_text(encoding="utf-8")


def test_protected_route_uses_existing_physical_shell_not_gameplay():
    router = read(ROOT / "frontend/src/router.tsx")
    shell = read(UI / "VisualBookPlaygroundPage.tsx")
    assert 'path: "game/inkspace-story"' in router
    assert "InkspaceStoryPlaygroundPage" in router
    assert 'element: <RequireAuth />' in router
    assert '<InkspaceStorySurface activeTab={active} />' in shell
    assert 'return <VisualBookPlaygroundShell />;' in shell  # blank-playground contract
    assert '<InkLabBook activeTab={active} />' in shell
    assert 'alt="An open, blank ivory-paged book' in shell
    assert 'className="vb-book-space"' in shell


def test_page_schema_real_art_accessible_and_three_modes():
    source = read(UI / "inkspaceStorySamples.ts")
    component = read(UI / "InkspaceStoryPage.tsx")
    assert '"narrative" | "art-forward" | "illuminated"' in source
    assert 'leftPage: InkspacePageContent' in source
    assert 'rightPage: InkspacePageContent' in source
    for style in ("narrative", "art-forward", "illuminated"):
        assert f'{style}:' in source or f'"{style}":' in source
    assert 'alt: string' in source and '<img src={art.src} alt={art.alt}' in component
    assert '<h1 className="inkspace-title">' in component
    assert '<span className="inkspace-dropcap"' in component
    assert '<blockquote className="inkspace-quote">' in component
    assert 'inkspace-rubric' in component and 'inkspace-marginalia' in component
    assert '<select' not in component and 'window.confirm' not in component
    assert 'onClick={() => setSelected(option.id)}' in component
    for image in ("river-fortress.webp", "forgotten-crossroads.webp"):
        p = ROOT / "frontend/public/art/pass64/inkspace" / image
        assert 10000 < p.stat().st_size < 200000, p


def test_polygon_aligned_ink_no_scene_motion_or_mutations():
    comp = read(UI / "InkspaceStoryPage.tsx")
    css = read(UI / "inkspaceStory.css")
    assert 'SCENE_COMPOSITING.contentSafeZones[side]' in comp
    assert 'sceneRectStyle(' in comp
    assert 'const MASK_FRAMES = 33' in comp
    assert 'style.maskImage = maskURL' in comp
    assert 'style.webkitMaskImage = maskURL' in comp
    assert 'cancelAnimationFrame' in comp
    assert 'prefers-reduced-motion: reduce' in comp
    assert 'requestAnimationFrame' in comp
    assert 'mask-size:100% 100%' in css
    assert '.inkspace-leaf--left{clip-path:polygon(' in css
    assert '.inkspace-leaf--right{clip-path:polygon(' in css
    assert 'pointer-events:none' in css
    assert 'overflow-y:auto' in css
    assert '.vb-lab.has-story .vb-scene{position:fixed}' in css
    assert 'fetch(' not in comp and 'localStorage' not in comp
    assert re.search(r'width:max\(100%,calc\(100vh \* 1672 / 941\)\)', css)
