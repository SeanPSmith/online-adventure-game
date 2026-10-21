"""Pass 66.3: the server-driven waiting stage matches the manuscript reference.

All checks use the Python standard library. No UI test requires Pillow or
backend sockets just to verify a rendered CSS/JS contract.
"""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT/'frontend/src'
WAIT = (FRONT/'features/adventure/InkboundWaitingFolio.tsx').read_text()
RUNTIME = (FRONT/'features/adventure/IntermissionRuntime.tsx').read_text()
THEATER = (FRONT/'features/adventure/TurnTheater.tsx').read_text()
ADVENTURE = (FRONT/'pages/game/AdventurePage.tsx').read_text()
CSS = (FRONT/'styles/inkboundWaitingPass663.css').read_text()
MAIN = (FRONT/'main.tsx').read_text()


def test_real_turn_handoff_remains_authoritative():
    assert 'onStoryReadyComplete={theater.finishIntermissionStoryReady}' in THEATER
    assert 'onSubmitScore={onSubmitIntermissionScore}' in THEATER
    assert 'onRetry={theater.phase === "retry" ? onRetry : undefined}' in THEATER
    assert 'storyReadySeconds={theater.countdownValue}' in THEATER
    assert 'onSync={showResync ? onSync : undefined}' in THEATER
    assert 'if (payload.game_id === "intermission_wait")' in RUNTIME
    assert 'mode === "waiting"' in RUNTIME
    assert 'submitFinalScore();' in RUNTIME
    assert 'onStoryReadyComplete();' in RUNTIME
    assert 'choiceLabel={choiceLocked ? (live.choiceAccepted?.choice_label ?? selectedChoice?.label) : null}' in ADVENTURE
    for forbidden in ('Math.random(', 'window.confirm(', '<select', 'onStoryReadyComplete()'):
        assert forbidden not in WAIT


def test_waiting_ui_never_fakes_eta_or_outcome():
    assert 'TIME WRITING · NOT AN ESTIMATED ARRIVAL' in WAIT
    assert 'Math.floor' in WAIT and 'Number.isFinite' in WAIT
    assert 'const ready = storyReady && !retry' in WAIT
    assert 'storyReady' in RUNTIME
    assert 'payload.turn_number' in RUNTIME
    assert 'choiceLabel ?' in WAIT
    assert 'Recorded for this turn' in WAIT
    assert 'role="timer" aria-live="off"' in WAIT
    assert 'role="status" aria-live="polite"' in WAIT


def test_exact_six_theme_and_transparent_art_contracts():
    assert 'import "./styles/inkboundWaitingPass663.css"' in MAIN
    for key in ('navy', 'midnight', 'phosphor'):
        assert 'data-ink-paper="'+key+'"' in CSS
    for selector in ('.ibw-stage','.ibw-main','.ibw-clock','.ibw-progress','.ibw-choice-line','.ibw-status-footer'):
        assert selector in CSS
    assert '@media(max-width:600px)' in CSS
    assert 'prefers-reduced-motion:reduce' in CSS
    assert 'mask-image' not in CSS
    assert 'radial-gradient(' not in CSS
    for file in ('signpost.png','lantern-books.png'):
        path = ROOT/'frontend/public/art/inkbound'/file
        png=path.read_bytes()
        assert png[:8] == b'\x89PNG\r\n\x1a\n' and png[25] == 6  # RGBA


def test_all_relative_react_css_imports_exist():
    # Guard the missing-CSS failures seen in 65.7/65.8, without testing fake selectors.
    for filename in FRONT.rglob('*.tsx'):
        for value in re.findall(r'^import\s+[\'\"]([^\'\"]+\.css)[\'\"]', filename.read_text(), re.M):
            assert (filename.parent/value).resolve().is_file(), (filename, value)
    for value in re.findall(r'^import\s+[\'\"]([^\'\"]+\.css)[\'\"]', MAIN, re.M):
        assert (FRONT/value).resolve().is_file(), value
