"""Pass 66.12: real React public conversion, transparent assets, real auth flows."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'frontend'


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding='utf-8')


def test_home_is_live_react_not_a_flat_image_or_broken_deep_link():
    home = read('frontend/src/pages/public/PublicHomePage.tsx')
    assert 'function PublicHomePage()' in home
    assert 'useAuth()' in home
    assert 'useState<number | null>(null)' in home
    assert 'setSampleChoice(index)' in home
    assert 'authenticated ? "/game" : "/register"' in home
    assert 'to="/game"' in home
    assert 'id="how-it-works"' in home and 'id="story-preview"' in home
    assert 'AN INTERACTIVE SAMPLE · NOT A LIVE GAME' in home
    assert 'Browse playable adventures' in home
    assert 'Google' not in home and 'Apple' not in home


def test_auth_not_simulated_and_return_path_survives():
    login = read('frontend/src/pages/auth/LoginPage.tsx')
    register = read('frontend/src/pages/auth/RegisterPage.tsx')
    recovery = read('frontend/src/pages/auth/ForgotPasswordPage.tsx')
    for name in ('login', 'register', 'forgot-password'):
        assert f'path: "{name}"' in read('frontend/src/router.tsx')
    assert 'await login(identifier, password)' in login
    assert 'await register(email, username, password)' in register
    assert 'state?.returnTo ?? "/game"' in login
    assert 'state: { returnTo: state?.returnTo }' in register
    assert 'autoComplete="current-password"' in login
    assert 'autoComplete="new-password"' in register
    assert 'role="alert"' in login and 'role="alert"' in register
    assert 'Password reset is not connected.' in recovery
    assert 'sendResetEmail' not in recovery


def test_auth_reuses_brand_image_and_real_public_wrapper():
    frame = read('frontend/src/pages/auth/QuillairoAuthFrame.tsx')
    layout = read('frontend/src/layouts/PublicLayout.tsx')
    css = read('frontend/src/styles/quillairoPublicPass6612.css')
    assert 'QuillairoMonogram' in frame
    assert 'auth-journey.png' in frame
    assert 'useInkboundPaper(user?.user_id ?? "")' in layout
    assert 'data-ink-paper={paper}' in layout
    assert 'public-shell.qpub-shell' in css
    for token in ('"cream"', '"parchment"', '"navy"', '"phosphor"', '"midnight"'):
        assert token in css
    assert '@media (max-width:760px)' in css
    assert '@media (max-width:440px)' in css
    assert 'prefers-reduced-motion' in css
    assert 'import "./styles/quillairoPublicPass6612.css";' in read('frontend/src/main.tsx')


def _png_alpha_bounds(data: bytes):
    """Read the alpha plane of a non-interlaced, RGBA-8 PNG using stdlib only.

    PNG filtering acts independently on each color channel, so we can unfilter
    alpha without allocating or decoding the RGB planes. No Pillow dependency.
    """
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    width, height, depth, color, compression, filtering, interlace = struct.unpack(
        ">IIBBBBB", data[16:29]
    )
    assert (depth, color, compression, filtering, interlace) == (8, 6, 0, 0, 0)
    payload = bytearray()
    offset = 8
    while offset < len(data):
        size = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        if kind == b"IDAT":
            payload.extend(data[offset + 8:offset + 8 + size])
        offset += 12 + size
        if kind == b"IEND":
            break
    scanlines = zlib.decompress(payload)
    stride = width * 4
    assert len(scanlines) == height * (stride + 1)
    prior = bytearray(width)
    min_x, min_y, max_x, max_y = width, height, -1, -1
    minimum, maximum = 255, 0
    corners = {}
    for y in range(height):
        line_start = y * (stride + 1)
        filter_kind = scanlines[line_start]
        assert filter_kind in (0, 1, 2, 3, 4)
        current = bytearray(width)
        for x in range(width):
            raw = scanlines[line_start + 1 + 4*x + 3]
            left = current[x - 1] if x else 0
            above = prior[x]
            upper_left = prior[x - 1] if x else 0
            if filter_kind == 0:
                predictor = 0
            elif filter_kind == 1:
                predictor = left
            elif filter_kind == 2:
                predictor = above
            elif filter_kind == 3:
                predictor = (left + above) // 2
            else:
                p = left + above - upper_left
                diffs = (abs(p-left), abs(p-above), abs(p-upper_left))
                predictor = (left, above, upper_left)[diffs.index(min(diffs))]
            a = (raw + predictor) & 255
            current[x] = a
            if a:
                min_x, min_y = min(min_x,x), min(min_y,y)
                max_x, max_y = max(max_x,x), max(max_y,y)
                maximum = max(maximum,a)
            minimum = min(minimum,a)
            if (x, y) in ((0,0), (width-1,0), (0,height-1),
                          (width-1,height-1), (width//2,0), (0,height//2)):
                corners[(x,y)] = a
        prior = current
    return width, height, (minimum,maximum), corners, (min_x,min_y,max_x+1,max_y+1)


def test_reusable_art_images_are_rgba_with_safe_transparent_margins():
    for name in ('home-vista','living-worlds','auth-journey'):
        path = WEB / 'public' / 'art' / 'quillairo-public' / (name + '.png')
        width, height, extrema, corners, bbox = _png_alpha_bounds(path.read_bytes())
        assert extrema == (0, 255)
        assert all(value == 0 for value in corners.values())
        assert bbox[0] >= .07 * width and bbox[1] >= .07 * height
        assert bbox[2] <= .93 * width and bbox[3] <= .93 * height


def test_existing_public_routes_stay_in_place():
    router = read('frontend/src/router.tsx')
    for route in ('rulebook','privacy','terms','join/:roomCode'):
        assert f'path: "{route}"' in router
