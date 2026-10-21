"""Cross-surface Inkbound contrast and visual scoping; no browser runtime dependency."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
CSS = (ROOT / "frontend/src/styles/inkboundLegibilityPass661.css").read_text()
MAIN = (ROOT / "frontend/src/main.tsx").read_text()
READER = (ROOT / "frontend/src/pages/game/InkboundLiveRoom.tsx").read_text()
THEATER = (ROOT / "frontend/src/features/adventure/TurnTheater.tsx").read_text()

def test_legibility_import_is_last_shared_css():
    assert 'import "./styles/inkboundSystemPass660.css";' in MAIN
    assert MAIN.index('inkboundLegibilityPass661.css') > MAIN.index('inkboundSystemPass660.css')
    assert (ROOT / "frontend/src/styles/inkboundLegibilityPass661.css").is_file()

def test_live_gameplay_unaltered():
    assert "onSubmitIntermissionScore" in THEATER
    assert "onStoryReadyComplete" in (ROOT / "frontend/src/features/adventure/IntermissionRuntime.tsx").read_text()
    assert "onSelectChoice" in READER and "onLockChoice" in READER
    assert "StoryReveal" in READER and "narrationCue" in READER

def test_controls_and_surfaces_scoped_and_readable():
    for selector in (".inkbound-live", ".inkbound-lobby", ".inkbound-turn-theater",
                     ".inkbound-global-dialog", ".inkbound-system-shell",
                     ".intermission-runtime", ".ibl-drawer", ".narrator-voice-library"):
        assert selector in CSS
    assert "--ia-text" in CSS and "--ia-paper" in CSS
    assert "--ib-highlight" in CSS and "--ib-button-ink" in CSS
    assert "color-scheme:dark" in CSS
    assert ".story-follow-sentence.is-speaking" in CSS
    assert "background:var(--ia-wash)!important" in CSS

def test_arcade_game_board_styling_is_not_overwritten():
    assert ".intermission-game-feedback-host descendants" in CSS
    assert not re.search(r"\.intermission-game-feedback-host\s*\{",CSS)
    assert not re.search(r"\.intermission-game-feedback-host\s+\*",CSS)

def test_folio_focus_restores_to_opener():
    assert "panelOpener.current.focus()" in READER
    assert 'document.body.style.overflow = "hidden"' in READER
    assert "closeButton.current?.focus()" in READER

def test_no_new_rectangular_image_fades():
    assert "mask-image:" not in CSS
    assert "background-image:url" not in CSS.replace(" ","")

def test_all_relative_css_imports_exist():
    src=ROOT / "frontend/src"
    for source in src.rglob("*.tsx"):
        body=source.read_text()
        for rel in re.findall(r'import\s+["\'](\.{1,2}/[^"\']+\.css)["\']',body):
            assert (source.parent / rel).is_file(),f"Missing {rel} imported from {source}"
