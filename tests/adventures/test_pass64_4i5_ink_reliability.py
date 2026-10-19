"""Pass 64.4I.5: preserve a stable photographic book and isolated pigment art.
No Pillow, native Chromium, or remote APIs required to run these regressions.
"""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / 'frontend/src/pages/game'
ART = ROOT / 'frontend/public/art/pass64/inkspace'


def read(name: str) -> str:
    return (UI / name).read_text(encoding='utf-8')


def alpha_samples(path: Path) -> tuple[int, int, list[int]]:
    data = path.read_bytes()
    assert data.startswith(b'\x89PNG\r\n\x1a\n')
    cursor = 8
    compressed = bytearray()
    width = height = 0
    while cursor < len(data):
        size = struct.unpack_from('>I', data, cursor)[0]
        kind = data[cursor + 4:cursor + 8]
        chunk = data[cursor + 8:cursor + 8 + size]
        assert zlib.crc32(kind + chunk) & 0xffffffff == struct.unpack_from('>I', data, cursor + 8 + size)[0]
        cursor += 12 + size
        if kind == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', chunk)
            assert depth == 8 and color == 6 and compression == filtering == interlace == 0
        elif kind == b'IDAT':
            compressed.extend(chunk)
        elif kind == b'IEND':
            break
    assert width >= 400 and height >= 250
    raw = zlib.decompress(bytes(compressed))
    assert len(raw) == height * (1 + width * 4)
    prev = bytearray(width * 4)
    samples = []
    pos = 0
    for _ in range(height):
        mode = raw[pos]
        assert mode in range(5)
        pos += 1
        curr = bytearray(raw[pos:pos + width * 4])
        pos += width * 4
        for j in range(len(curr)):
            a = curr[j - 4] if j >= 4 else 0
            b = prev[j]
            c = prev[j - 4] if j >= 4 else 0
            if mode == 1: curr[j] = (curr[j] + a) % 256
            elif mode == 2: curr[j] = (curr[j] + b) % 256
            elif mode == 3: curr[j] = (curr[j] + ((a + b) // 2)) % 256
            elif mode == 4:
                p = a + b - c
                da, db, dc = abs(p-a), abs(p-b), abs(p-c)
                curr[j] = (curr[j] + (a if da <= db and da <= dc else b if db <= dc else c)) % 256
        samples.extend(curr[3::4])
        prev = curr
    return width, height, samples


def test_illustrations_have_real_transparency_not_baked_page_rectangles():
    data = read('inkspaceStorySamples.ts')
    css = read('inkspaceStory.css')
    for name in ('river-fortress-cutout.png', 'forgotten-crossroads-cutout.png', 'harbor-traveler-cutout.png'):
        width, height, a = alpha_samples(ART / name)
        assert len(a) == width * height
        assert a[0] == 0 and a[-1] == 0  # transparent beyond artwork
        zero_ratio = a.count(0) / len(a)
        assert .10 < zero_ratio < .80, (name, zero_ratio)
        assert max(a) == 255 and any(0 < v < 255 for v in a)
        assert name in data
    assert 'object-fit:contain' in css
    assert '-webkit-mask-image:none;mask-image:none' in css
    assert 'alt: string' in data


def test_poetic_ink_waits_for_decoded_masks_and_never_swaps_before_commit():
    assets = read('inkMaskAssets.ts')
    story = read('InkspaceStoryPage.tsx')
    lab = read('InkLabBook.tsx')
    assert 'INK_MASK_FRAMES = 33' in assets
    assert 'image.decode()' in assets
    assert 'preloadPromise' in assets and 'Promise.all(' in assets
    for source in (story, lab):
        assert 'preloadInkMasks()' in source
        assert 'useLayoutEffect' in source
        assert 'pendingRevealRef' in source
        assert 'revealAfterCommitRef' in source
        assert 'cancelAnimationFrame' in source
        assert 'replaySeenRef' in source
        assert 'maskStatus === "pending"' in source
        assert 'maskStatus === "failed"' in source
        assert 'clearInkMask' in source
        assert 'prefers-reduced-motion: reduce' in source
        assert 'paint(0)' in source and 'paint(1)' in source
        assert 'displayedRef.current = ' in source and 'setDisplayed(' in source
    # The old page must fully vanish before any next-copy swap.
    assert story.index('paint(0);\n        pendingRevealRef.current = true') < story.index('setDisplayed(selected);', story.index('paint(0);\n        pendingRevealRef.current = true'))
    assert lab.index('paint(0);\n        pendingRevealRef.current = true') < lab.index('setDisplayed(activeTab);', lab.index('paint(0);\n        pendingRevealRef.current = true'))


def test_no_gameplay_mutation_and_no_native_ui_regression():
    sources = [read(name) for name in ('InkspaceStoryPage.tsx', 'InkLabBook.tsx')]
    for source in sources:
        assert '<select' not in source
        assert 'window.confirm' not in source
        assert 'localStorage' not in source
        assert 'fetch(' not in source
        assert 'document.body.style' not in source
