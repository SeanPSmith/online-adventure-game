"""Pass 65.0 contract: non-invasive private ink preview and actual alpha artwork.

stdlib-only, so tests run without installing Pillow or a browser automation library.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend" / "src"
ART = ROOT / "frontend" / "public" / "art" / "inkbound"


def _image_alpha_bbox(path):
    data = path.read_bytes()
    assert data.startswith(b"\x89PNG\r\n\x1a\n"), path
    pos = 8
    compressed = bytearray()
    width = height = None
    while pos < len(data):
        size = struct.unpack(">I", data[pos:pos+4])[0]
        tag = data[pos+4:pos+8]
        content = data[pos+8:pos+8+size]
        pos += 12 + size
        if tag == b"IHDR":
            width, height, bits, mode, *_ = struct.unpack(">IIBBBBB", content)
            assert (bits, mode) == (8, 6), "Artwork must be actual 8-bit RGBA"
        if tag == b"IDAT":
            compressed += content
        if tag == b"IEND":
            break
    raw = zlib.decompress(compressed)
    stride = width * 4
    offset = 0
    previous = bytearray(stride)
    bounds = [width, height, -1, -1]
    for y in range(height):
        filter_type = raw[offset]
        offset += 1
        line = bytearray(raw[offset:offset + stride])
        offset += stride
        for idx in range(stride):
            left = line[idx - 4] if idx >= 4 else 0
            above = previous[idx]
            upper_left = previous[idx - 4] if idx >= 4 else 0
            if filter_type == 1:
                line[idx] = (line[idx] + left) & 255
            elif filter_type == 2:
                line[idx] = (line[idx] + above) & 255
            elif filter_type == 3:
                line[idx] = (line[idx] + (left + above) // 2) & 255
            elif filter_type == 4:
                p = left + above - upper_left
                distances = (abs(p-left), abs(p-above), abs(p-upper_left))
                prediction = (left, above, upper_left)[distances.index(min(distances))]
                line[idx] = (line[idx] + prediction) & 255
            else:
                assert filter_type == 0, f"Unexpected PNG filter {filter_type}"
        for x in range(width):
            if line[x*4+3]:
                bounds[0] = min(bounds[0], x)
                bounds[1] = min(bounds[1], y)
                bounds[2] = max(bounds[2], x)
                bounds[3] = max(bounds[3], y)
        previous = line
    return width, height, bounds


def test_all_provisional_cutouts_have_true_alpha_and_no_boundary_ink():
    for filename in ["north-road.png", "hero-vista.png", "signpost.png", "lantern-books.png", "camp-cups.png"]:
        width, height, (left, top, right, bottom) = _image_alpha_bbox(ART / filename)
        assert right > left and bottom > top, filename
        assert left >= width * 0.07 and top >= height * 0.07, filename
        assert right <= width * 0.93 and bottom <= height * 0.93, filename


def test_inkbound_preview_is_not_exposed_as_public_or_game_route():
    router = (UI / "router.tsx").read_text()
    assert 'path: "dev/inkbound"' in router
    # The new route lives in the existing nested administrator DevLabGate group.
    idx = router.index('path: "dev/inkbound"')
    assert router.rfind("element: <DevLabGate />", 0, idx) > router.rfind('path: "game",', 0, idx)
    assert 'path: "inkbound"' not in router


def test_preview_uses_real_react_actions_and_the_existing_modal():
    code = (UI / "pages" / "game" / "InkboundFoundationPage.tsx").read_text()
    assert "useModal()" in code
    assert "openModal({" in code
    assert "onClick={() => setChoice(index)}" in code
    assert "onClick={() => setCommitted(true)}" in code
    assert "preloadInkMasks()" in code and "clearInkMask(element)" in code
    assert 'prefers-reduced-motion: reduce' in code
    assert "import { useLiveAdventure" not in code and "socket.emit(" not in code


def test_skin_is_scoped_and_preserves_live_game():
    styles = (UI / "pages" / "game" / "inkboundFoundation.css").read_text()
    assert "--ink-paper" in styles and ".inkbound-choice" in styles
    assert "body:has(.inkbound) #modal-root" in styles
    assert 'mask-image:radial-gradient' not in styles
    assert (UI / "pages" / "game" / "AdventurePage.tsx").is_file()
