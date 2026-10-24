"""Pass 66.36: protect real saved-story recovery, not a decorative button."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def source(relative):
    return (ROOT/relative).read_text()

def test_recovery_handshake_and_theater_reset_are_connected():
    live=source('frontend/src/state/useLiveAdventure.ts')
    page=source('frontend/src/pages/game/AdventurePage.tsx')
    hook=source('frontend/src/features/adventure/useTurnTheater.ts')
    assert 'socket.emit("sync_adventure_state"' in live
    assert 'syncWatchdogRef.current = setTimeout' in live
    assert 'restoreRef.current();' in live
    assert 'clearSyncWatchdog();' in live
    assert 'setResumeEpoch((current) => current + 1)' in live
    assert 'resumeEpoch: live.resumeEpoch' in page
    assert 'onRecover={live.restore}' in page
    assert 'committedTurnReady={Boolean(' in page
    assert '[roomCode, characterId, resumeEpoch, finishTurnPresentation]' in hook

def test_arcade_recovery_is_visible_without_scrolling_to_footer():
    theater=source('frontend/src/features/adventure/TurnTheater.tsx')
    css=source('frontend/src/styles/quillairoTurnRecovery6636.css')
    assert 'writingSeconds >= 20' in theater
    assert 'onClick={onRecover}' in theater
    assert 'window.setTimeout(onRecover, 2500)' in theater
    assert 'onClick={onSync}' in theater
    assert 'position: fixed' in css
    assert '.intermission-game-feedback-host' not in css

def test_recovery_is_in_default_release_checks():
    script=source('scripts/check-project.sh')
    assert 'node --test scripts/tests/socket-rejoin.cjs' in script
