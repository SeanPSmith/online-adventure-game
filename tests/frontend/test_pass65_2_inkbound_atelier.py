"""Pass 65.2: editor-approved, real-alpha art and fully interactive design atelier.
No backend mutations are permitted from the mockup route.
"""
from pathlib import Path
import runpy
_image_alpha_bbox = runpy.run_path(str(Path(__file__).with_name("test_pass65_inkbound_foundation.py")))["_image_alpha_bbox"]

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "frontend/src/pages/game/InkboundFoundationPage.tsx"
STYLES = ROOT / "frontend/src/pages/game/inkboundEditorial.css"
IMAGE = ROOT / "frontend/public/art/inkbound/north-road-editorial.png"


def test_original_watercolor_is_inset_true_rgba_without_canvas_edge_ink():
    w, h, (left, top, right, bottom) = _image_alpha_bbox(IMAGE)
    assert (w, h) == (1800, 930)
    assert left >= w * .10 and top >= h * .10
    assert right < w * .90 and bottom < h * .90


def test_real_workshop_contains_editorial_surfaces_and_reusable_design_actions():
    src = PAGE.read_text()
    css = STYLES.read_text()
    for token in ["i65-panorama", "i65-story-leaf", "i65-marginalia", "i65-choice-row",
                  "i65-instruments", "i65-folio", 'role="dialog" aria-modal="true"',
                  'aria-label="Preview party messages"', "submitChat", "setNotes", "setPaper"]:
        assert token in src
    assert '/north-road-editorial.png' in src
    for bad in ["preloadInkMasks(", "applyInkMask(", "window.confirm(", "useLiveAdventure(", "socket.emit("]:
        assert bad not in src
    assert "-webkit-mask-image:none!important" in css
    assert "mask-image:none!important" in css
    assert "radial-gradient" not in css
    assert "prefers-reduced-motion:reduce" in css


def test_workshop_does_not_change_core_adventure_actions_or_routes():
    router = (ROOT / "frontend/src/router.tsx").read_text()
    adventure = (ROOT / "frontend/src/pages/game/AdventurePage.tsx").read_text()
    assert 'path: "dev/inkbound"' in router
    assert "<InkboundLiveRoom" in adventure
    assert "live.submitChoice(selectedChoiceId)" in adventure
    assert "live.sendChat(message)" in adventure
