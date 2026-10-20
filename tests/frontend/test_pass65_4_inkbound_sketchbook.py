"""Pass 65.4: sketchbook composition and real PNG alpha transparency.

The asset check intentionally uses only the Python standard library. Regression
checks must run in the project's existing venv without installing Pillow.
"""
from pathlib import Path
import re
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'frontend/src/pages/game'


def _rgba_png_alpha_bbox(path: Path):
    """Return PIL-compatible nonzero-alpha bounds for an 8-bit RGBA PNG.

    Reconstruct just the alpha component of each PNG scanline. PNG filters act
    on the corresponding channel of the previous pixel/row, so the RGB data
    does not need to be decoded to validate true transparency and safe margins.
    """
    contents = path.read_bytes()
    assert contents.startswith(b'\x89PNG\r\n\x1a\n'), f'{path}: not a PNG'
    offset = 8
    width = height = None
    compressed = []
    seen_end = False
    while offset < len(contents):
        assert offset + 12 <= len(contents), f'{path}: truncated PNG chunk'
        length = struct.unpack_from('>I', contents, offset)[0]
        chunk_type = contents[offset + 4:offset + 8]
        end = offset + 12 + length
        assert end <= len(contents), f'{path}: truncated {chunk_type!r}'
        chunk = contents[offset + 8:offset + 8 + length]
        expected_crc = struct.unpack_from('>I', contents, offset + 8 + length)[0]
        assert zlib.crc32(chunk, zlib.crc32(chunk_type)) == expected_crc, f'{path}: bad PNG CRC'
        if chunk_type == b'IHDR':
            assert length == 13, f'{path}: invalid IHDR'
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', chunk)
            assert width > 0 and height > 0
            assert (depth, color, compression, filtering, interlace) == (8, 6, 0, 0, 0), (
                f'{path}: expected noninterlaced 8-bit RGBA PNG (with real alpha)'
            )
        elif chunk_type == b'IDAT':
            compressed.append(chunk)
        elif chunk_type == b'IEND':
            seen_end = True
            break
        offset = end
    assert seen_end and width is not None and compressed, f'{path}: missing PNG data'

    raw = zlib.decompress(b''.join(compressed))
    row_size = 4 * width
    assert len(raw) == height * (row_size + 1), f'{path}: unexpected scanline length'
    bounds = [width, height, -1, -1]
    previous = bytearray(width)
    offset = 0
    for y in range(height):
        filter_type = raw[offset]
        assert filter_type in (0, 1, 2, 3, 4), f'{path}: invalid PNG filter'
        alpha = bytearray(raw[offset + 4:offset + 1 + row_size:4])
        assert len(alpha) == width
        for x in range(width):
            left = alpha[x - 1] if x else 0
            above = previous[x]
            upper_left = previous[x - 1] if x else 0
            if filter_type == 1:  # Sub
                predictor = left
            elif filter_type == 2:  # Up
                predictor = above
            elif filter_type == 3:  # Average
                predictor = (left + above) // 2
            elif filter_type == 4:  # Paeth
                p = left + above - upper_left
                dl, da, dul = abs(p - left), abs(p - above), abs(p - upper_left)
                predictor = left if dl <= da and dl <= dul else above if da <= dul else upper_left
            else:  # None
                predictor = 0
            alpha[x] = (alpha[x] + predictor) & 255
            if alpha[x]:
                bounds[0] = min(bounds[0], x)
                bounds[1] = min(bounds[1], y)
                bounds[2] = max(bounds[2], x)
                bounds[3] = max(bounds[3], y)
        previous = alpha
        offset += row_size + 1

    if bounds[2] == -1:
        return width, height, None
    return width, height, (bounds[0], bounds[1], bounds[2] + 1, bounds[3] + 1)


def test_workshop_alone_imports_new_composition():
    source = (BASE / 'InkboundFoundationPage.tsx').read_text()
    style = (BASE / 'inkboundSketchbook.css').read_text()
    assert 'import "./inkboundSketchbook.css";' in source
    assert 'data-layout="manuscript"' in source
    assert '.i65 .i65-choice-row[data-layout="manuscript"]' in style
    assert '.i653-dashboard-lead>.i654-dashboard-letter' in style
    assert 'i654-margin-sketch' in source
    assert 'inkboundSketchbook.css' not in (BASE / 'AdventurePage.tsx').read_text()


def test_sketchbook_illustration_is_source_alpha_not_a_mask():
    w, h, bbox = _rgba_png_alpha_bbox(ROOT / 'frontend/public/art/inkbound/north-road-editorial.png')
    assert bbox, 'artwork must contain nontransparent pixels'
    x0, y0, x1, y1 = bbox
    assert x0 >= int(w * .055) and y0 >= int(h * .055)
    assert x1 <= int(w * .945) and y1 <= int(h * .945)
    style = (BASE / 'inkboundSketchbook.css').read_text()
    assert 'mask-image:' not in style and 'clip-path:' not in style
    assert 'border-radius:50%' not in style


def test_custom_dice_and_game_states_are_preview_only():
    source = (BASE / 'InkboundJourneyGallery.tsx').read_text()
    assert 'function InkDieSketch' in source
    assert '<InkDieSketch />' in source
    assert '<InkDieSketch face="14" />' in source
    assert 'VISUAL PREVIEW' in source or 'Visual preview' in source
    for forbidden in ('submitChoice(', 'socket.emit(', 'rollDice(', 'applyOutcome(', 'fetch('):
        assert forbidden not in source


def test_reader_options_and_theme_modes_unchanged():
    s = (BASE / 'InkboundFoundationPage.tsx').read_text()
    for mode in ('"ivory"', '"parchment"', '"slate"', '"midnight"'):
        assert mode in s
    for action in ('openPanel("journal")', 'openPanel("party")', 'openPanel("chat")', 'openPanel("inventory")'):
        assert action in s
    style = (BASE / 'inkboundSketchbook.css').read_text()
    assert 'prefers-reduced-motion:reduce' in style
    assert re.search(r'@media\(max-width:640px\)', style)
