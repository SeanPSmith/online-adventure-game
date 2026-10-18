"""Pass 64.4E — isolated masked ink-motion laboratory contracts.

The alpha-mask asset checks deliberately use only the Python standard library.
The runtime decodes WebP in the browser; the test suite shouldn't require Pillow.
"""
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def test_ink_lab_is_separate_protected_route() -> None:
    router = (FRONTEND / "src/router.tsx").read_text()
    assert 'path: "game/ink-lab"' in router
    assert "InkBookPlaygroundPage" in router
    assert 'path: "game/visual-playground"' in router
    assert 'path: "game",' in router
    assert 'element: <RequireAuth />' in router


def test_original_visual_playground_remains_blank() -> None:
    component = (FRONTEND / "src/pages/game/VisualBookPlaygroundPage.tsx").read_text()
    assert 'export function VisualBookPlaygroundPage()' in component
    assert 'return <VisualBookPlaygroundShell />;' in component
    assert '{inkLab ? <InkLabBook activeTab={active} /> : null}' in component
    assert 'className="vb-book-space"' in component
    assert 'aria-label="Visual playground — menu style preview"' in component
    assert 'alt="An open, blank ivory-paged book' in component


def test_ink_transition_has_real_mask_frames_and_halo() -> None:
    script = (FRONTEND / "src/pages/game/InkLabBook.tsx").read_text()
    css = (FRONTEND / "src/pages/game/inkLabBook.css").read_text()
    assert "const FRAMES = 33" in script
    assert "style.webkitMaskImage" in script
    assert "style.maskImage" in script
    assert "cancelAnimationFrame" in script
    assert "prefers-reduced-motion: reduce" in script
    assert "alt={ex.alt}" in script
    assert "setDisplayed" in script
    assert "requestAnimationFrame" in script
    assert ".vb-lab.has-ink .vb-book-space" in css
    assert ".ink-lab-pigment" in css
    assert "mask-size:100% 100%" in css
    assert "opacity:0" not in css  # no opacity-only hide/reveal choreography


def _webp_chunks(path: Path) -> dict[bytes, bytes]:
    """Read WebP RIFF container/chunk metadata, without a pixel-decoding library."""
    data = path.read_bytes()
    assert len(data) >= 20, f"WebP too short: {path.name}"
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", path.name
    assert struct.unpack_from("<I", data, 4)[0] == len(data) - 8, path.name
    pos = 12
    chunks: dict[bytes, bytes] = {}
    while pos < len(data):
        assert pos + 8 <= len(data), f"Incomplete WebP chunk: {path.name}"
        kind = data[pos : pos + 4]
        size = struct.unpack_from("<I", data, pos + 4)[0]
        end = pos + 8 + size
        assert end <= len(data), f"Truncated WebP chunk: {path.name}"
        assert kind not in chunks, f"Duplicate WebP chunk: {path.name}"
        chunks[kind] = data[pos + 8 : end]
        pos = end + (size % 2)  # RIFF chunks are padded to even lengths
    assert pos == len(data), f"Invalid WebP padding: {path.name}"
    return chunks


def test_mask_assets_are_small_real_alpha_textures() -> None:
    directory = FRONTEND / "public/art/pass64/ink-masks"
    frames = sorted(directory.glob("ink-*.webp"))
    assert [p.name for p in frames] == [f"ink-{n:02d}.webp" for n in range(33)]

    # Frames 0–31 use actual extended WebP alpha chunks, not just RGB images.
    # Frame 32 is fully opaque and WebP's encoder optimizes its alpha away.
    for n, frame in enumerate(frames):
        assert 0 < frame.stat().st_size < 60000
        chunks = _webp_chunks(frame)
        assert b"VP8 " in chunks or b"VP8L" in chunks, frame.name
        if n < 32:
            assert b"VP8X" in chunks and b"ALPH" in chunks, frame.name
            header = chunks[b"VP8X"]
            assert len(header) == 10 and bool(header[0] & 0x10), frame.name
            width = 1 + int.from_bytes(header[4:7], "little")
            height = 1 + int.from_bytes(header[7:10], "little")
            assert (width, height) == (420, 420), frame.name
        else:
            assert b"ALPH" not in chunks, frame.name

    # A nearly empty first mask and visually complex intermediate masks.
    # Exact pixel extrema require a WebP decoder and are covered by browser QA.
    assert frames[0].stat().st_size < frames[16].stat().st_size
    assert frames[-1].stat().st_size < frames[16].stat().st_size
