"""Pass 66.24: editorial turn-receipt surface, zero gameplay ownership."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]
RECEIPT=(ROOT/'frontend/src/features/adventure/TurnResolutionTheater.tsx').read_text()
THEATER=(ROOT/'frontend/src/features/adventure/TurnTheater.tsx').read_text()
CSS=(ROOT/'frontend/src/styles/quillairoTurnReceiptPass6624.css').read_text()
ENTRY=(ROOT/'frontend/src/main.tsx').read_text()

def test_receipt_is_real_and_server_authoritative():
    for token in ('receipt.results ?? []', 'receipt.hero_progression', 'receipt.resolution',
                  'result.check.roll', 'check.total', 'check.difficulty',
                  'result.check?.outcome', 'update.health_change', 'update.died_this_turn',
                  'receipt.completed', 'onClick={onContinue}', 'onDone={finishCurrent}',
                  'setDisplayRoll(check.roll)', 'cosmeticD20Face()'):
        assert token in RECEIPT, token
    assert 'Math.random()' not in RECEIPT
    assert 'onContinue={theater.acknowledgeResolution}' in THEATER
    assert 'aria-labelledby="q24-turn-title"' in THEATER
    assert 'if (theater.phase === "resolution" && theater.activeReceipt)' in THEATER

def test_story_transition_is_not_accidentally_advanced():
    state=(ROOT/'frontend/src/features/adventure/useTurnTheater.ts').read_text()
    assert 'if (!final || final.preliminary) return;' in state
    assert 'transition("resolution")' in state
    assert 'const durationMs = 3000' in state
    assert 'acknowledgeResolution' in state
    assert 'onStoryReadyComplete={theater.finishIntermissionStoryReady}' in THEATER
    assert 'onSubmitScore={onSubmitIntermissionScore}' in THEATER

def test_manuscript_progress_and_coop_are_dynamic():
    for token in ('steps.map(', 'aria-current=', 'receiptStage = finished',
                  'results.length > 1', 'Math.min(activeIndex + 1, results.length)',
                  'result.character_id === update.character_id',
                  'role="status"', 'What the Choice Changed', 'q24-page-handoff'):
        assert token in RECEIPT, token
    assert '/art/inkbound/signpost.png' in RECEIPT
    assert (ROOT/'frontend/public/art/inkbound/signpost.png').exists()

def test_theme_and_mobile_scope():
    assert 'import "./styles/quillairoTurnReceiptPass6624.css";' in ENTRY
    assert ENTRY.index('quillairoLiveFolioPass6623.css') < ENTRY.index('quillairoTurnReceiptPass6624.css')
    for theme in ('cream','parchment','navy','midnight','phosphor'):
        assert f'data-ink-paper="{theme}"' in CSS
    for token in ('inkbound-turn-theater', 'is-inkbound-manuscript',
                  'var(--ia-text)', 'var(--ia-paper)', 'aria', ':focus-visible',
                  '@media(max-width:730px)', '@media(prefers-reduced-motion:reduce)'):
        assert token in (CSS+'aria'), token
    for accidental in ('.arcade-', '.intermission-game-', 'mask-image', 'radial-gradient(', ':root'):
        assert accidental not in CSS, accidental
    assert re.search(r'\.q24-turn-steps\s*\{', CSS)
