"""Pass 66.34: final-turn receipt rescue and Inkspace theater parity."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source(path):
    return (ROOT / path).read_text()


def test_finale_keeps_turn_number_and_client_treats_it_as_committed():
    session = source('app/game/session.py')
    hook = source('frontend/src/features/adventure/useTurnTheater.ts')
    server = source('app/main.py')
    assert 'resolved_turn\n            if completed\n            else resolved_turn + 1' in session
    assert '"director_complete":\n            session.completed' in server
    assert 'let committedSceneReady = false;' in hook
    assert 'if (!game.turn_pending && game.turn_number > resolvedTurnNumber(committed))' in hook
    assert 'if (!game.turn_pending && game.director_complete &&' in hook
    assert 'game.turn_number === resolvedTurnNumber(committed)' in hook
    assert hook.count('if (committedSceneReady) {') == 2
    assert 'readyReceiptRef.current = committed' in hook
    assert 'transition("resolution")' in hook


def test_provisional_receipts_are_never_presented_as_final():
    hook = source('frontend/src/features/adventure/useTurnTheater.ts')
    assert 'if (incoming.preliminary)' in hook
    assert 'if (!final || final.preliminary) return;' in hook
    assert 'writeAcknowledgedReceipt(roomCode, characterId, key)' in hook


def test_dice_use_committed_results_with_a_nonblocking_escape():
    receipt = source('frontend/src/features/adventure/TurnResolutionTheater.tsx')
    assert 'setDisplayRoll(check.roll)' in receipt
    assert 'cosmeticD20Face()' in receipt
    assert 'setDisplayRoll(active && !complete ? "—"' in receipt
    assert 'setShowReceiptRecovery(true)' in receipt
    assert 'Reveal saved roll and consequences' in receipt
    assert 'setFinished(true);' in receipt
    assert 'onClick={onContinue}' in receipt
    assert 'onDone={finishCurrent}' in receipt
    assert 'setActiveIndex((current) => {' not in receipt  # avoids nested React state updates


def test_inkspace_theater_no_crt_scanlines_and_no_arcade_style_leak():
    css = source('frontend/src/styles/quillairoTurnReceiptPass6624.css')
    assert '.turn-theater-overlay.inkbound-turn-theater::before' in css
    assert 'content: none;' in css
    assert '.inkbound-turn-theater .q34-receipt-recovery button:focus-visible' in css
    assert 'var(--ia-scrim' in css
    # All cleanup rules apply only to the active illustrated theater.
    added = css.split('/* Pass 66.34')[1]
    assert ':root' not in added
    assert '.arcade-' not in added
    assert 'components.css' not in added
