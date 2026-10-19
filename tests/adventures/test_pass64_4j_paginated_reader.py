"""Pass 64.4J contracts: pagination and journal remain cosmetic/read-only.

The server, room state, dice, XP, and active adventure reader are unchanged.
"""
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def source(relative: str) -> str:
    return (FRONTEND / relative).read_text(encoding="utf-8")


def test_reader_is_protected_isolated_route_not_real_adventure():
    router = source("src/router.tsx")
    assert 'path: "game/inkspace-reader"' in router
    assert 'InkspaceReaderPlaygroundPage' in router
    assert 'path: "adventure/:roomId"' in router
    assert 'element: <RequireAuth />' in router
    shell = source("src/pages/game/VisualBookPlaygroundPage.tsx")
    assert 'readerLab ? <InkspaceReaderLab />' in shell
    assert '<InkspaceStorySurface activeTab={active}' in shell
    assert 'src="/art/pass64/pass64-4d-tabletop-book.webp"' in shell


def test_page_pagination_is_not_scroll_only_or_manual_two_column_fiction():
    text = source("src/pages/game/inkspaceReaderPagination.ts")
    ui = source("src/pages/game/InkspaceReaderLab.tsx")
    assert "paginateReader" in text and "lineCounter" in text
    assert "const pages:" in text and "const newPage" in text
    assert "split(/\\s+/)" in text and "pages.length % 2" in text
    assert "ResizeObserver" in ui
    assert 'goTo(index - 1)' in ui and 'goTo(index + 1)' in ui
    assert "READER_DEMO.paragraphs" not in ui  # renders paginated leaves, not full story repeated
    assert 'aria-label="Turn manuscript pages"' in ui


def test_journal_tabs_are_real_usable_previews_without_server_writes():
    ui = source("src/pages/game/InkspaceReaderLab.tsx")
    for token in ('"character"', '"chat"', '"notes"', "aria-pressed", "aria-label", "<textarea", "<form onSubmit={send}>"):
        assert token in ui
    assert "not connected to co-op chat" in ui.lower()
    assert "nothing is saved or sent" in ui.lower()
    assert "no roll or gameplay action" in ui.lower()
    assert "window.confirm" not in ui and "<select" not in ui
    assert "fetch(" not in ui and "socket.emit" not in ui


def test_ink_animation_is_commit_safe_and_reduced_motion_aware():
    ui = source("src/pages/game/InkspaceReaderLab.tsx")
    css = source("src/pages/game/inkspaceReaderLab.css")
    assert "preloadInkMasks" in ui and "useLayoutEffect" in ui
    assert "pendingReveal.current" in ui
    assert "cancelAnimationFrame" in ui
    assert "prefers-reduced-motion:reduce" in css
    assert ".reader-ink" in css and "mask-image" in css
    # The scene is fixed for mobile, never given an ink mask or motion.
    import re
    scene_rules = re.findall(r"\.vb-scene\s*\{([^}]+)\}", css)
    assert all("mask" not in rule and "animation" not in rule for rule in scene_rules)
    assert "mask-image:none!important" in css


def test_story_illustration_is_separate_64_bit_free_png_with_real_alpha():
    ui = source("src/pages/game/inkspaceReaderPagination.ts")
    assert "/art/pass64/inkspace/river-fortress-cutout.png" in ui
    assert 'alt: "Transparent watercolor' in ui
    file = FRONTEND / "public/art/pass64/inkspace/river-fortress-cutout.png"
    assert file.is_file()
    blob = file.read_bytes()
    assert blob.startswith(b"\x89PNG\r\n\x1a\n")
    width, height, depth, color, *_ = struct.unpack(">IIBBBBB", blob[16:29])
    assert width >= 500 and height >= 300 and depth == 8 and color == 6  # RGBA PNG
