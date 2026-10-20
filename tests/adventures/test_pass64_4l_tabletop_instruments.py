"""Pass 64.4L: the floating tabletop kit is an isolated, safe UI experiment."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend" / "src"
PAGE = FRONTEND / "pages" / "game"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_study_is_a_separate_authenticated_route():
    router = read(FRONTEND / "router.tsx")
    shell = read(PAGE / "VisualBookPlaygroundPage.tsx")
    assert 'path: "game/tabletop-kit"' in router
    assert 'TabletopInteractionPlaygroundPage' in router
    assert 'export function TabletopInteractionPlaygroundPage()' in shell
    assert 'instrumentsLab />' in shell
    assert 'has-instruments' in shell
    assert '<InkspaceReaderLab floatingInstruments />' in shell
    # No changes to the existing game adventure URL or original attached-tab lab.
    assert 'path: "adventure/:roomId"' in router
    assert 'path: "game/inkspace-reader"' in router


def test_reader_is_opt_in_and_attached_tabs_are_preserved():
    code = read(PAGE / "InkspaceReaderLab.tsx")
    assert 'floatingInstruments = false' in code
    assert '<TabletopInstruments />' in code
    assert 'reader-journal-tabs' in code
    assert '<JournalSheet tab={journal}' in code
    assert '<ManuscriptLeaf side="left"' in code
    assert '<ManuscriptLeaf side="right"' in code
    assert 'paginateReader(READER_DEMO, size)' in code
    assert 'preloadInkMasks()' in code


def test_floating_instruments_have_complete_accessible_controls():
    source = read(PAGE / "TabletopInstruments.tsx")
    for item in ('"character"', '"chat"', '"notes"'):
        assert item in source
    for item in ('aria-pressed', 'aria-expanded', 'aria-controls', 'aria-labelledby',
                 'role="dialog"', 'aria-modal="false"', 'aria-label=', 'onClick=',
                 'event.key === "Escape"', 'requestAnimationFrame', 'heading.current?.focus()'):
        assert item in source
    assert 'aria-live="polite"' in source
    assert 'setMessages(' in source and 'setNotes(' in source and 'setDraft(' in source
    assert 'trim()' in source
    assert '<Link to="/game/inkspace-reader">' in source


def test_preview_cannot_claim_persistence_or_server_authority():
    source = read(PAGE / "TabletopInstruments.tsx")
    for forbidden in ('fetch(', 'axios', 'localStorage', 'sessionStorage',
                      'window.confirm', '<select', 'useGameSocket', 'emit(', 'sendMessage('):
        assert forbidden not in source
    for expected in ('NOT LIVE DATA', 'No Hero stats or progression are changed',
                     'Nothing is sent to co-op chat', 'not saved to your account'):
        assert expected in source
    # The game's live room and authoritative choice handlers are not in the patch.


def test_visual_kit_has_mobile_and_reduced_motion_behavior():
    css = read(PAGE / "tabletopInstruments.css")
    assert '.tti-medallion' in css and '.tti-sheet' in css
    assert '.tti-instrument.is-active' in css
    assert '.tti-instrument:focus-visible' in css
    assert 'max-width:860px' in css
    assert 'position:fixed' in css
    assert 'prefers-reduced-motion:reduce' in css
    # Not an image of fake buttons; these are DOM buttons over the still photograph.
    source = read(PAGE / "TabletopInstruments.tsx")
    assert 'className={`tti-instrument' in source
    assert 'onClick={() => toggle(tool.id)}' in source
