"""Pass 66.60 — persistent, readable dice are a pure presentation contract."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
COMPONENT=(ROOT/'frontend/src/features/adventure/TurnResolutionTheater.tsx').read_text()
CSS=(ROOT/'frontend/src/features/adventure/inkscapeHeldDicePass6660.css').read_text()
HOOK=(ROOT/'frontend/src/features/adventure/useTurnTheater.ts').read_text()


def test_no_automatic_fade_from_settled_dice_to_consequences():
    assert 'if (!inkbound || !finished || folioStage !== "dice") return;' not in COMPONENT
    assert 'setFolioStage("consequences")' in COMPONENT
    assert 'onClick={() => setFolioStage("consequences")}' in COMPONENT
    assert 'inkbound && finished && folioStage === "dice"' in COMPONENT
    assert 'View consequences' in COMPONENT


def test_multiplayer_rolls_wait_for_an_explicit_next_roll():
    assert 'setSettledIndex(activeIndex)' in COMPONENT
    assert 'settledIndex === activeIndex' in COMPONENT
    assert 'Next player\'s roll' in COMPONENT
    assert 'setActiveIndex(activeIndex + 1)' in COMPONENT


def test_full_authoritative_dice_receipt_is_retained_with_consequences():
    assert 'aria-label="Recorded dice and check results"' in COMPONENT
    assert 'className="q6660-resolved-rolls"' in COMPONENT
    assert 'results.map((result)' in COMPONENT
    assert 'complete={true}' in COMPONENT
    assert 'active={false}' in COMPONENT
    assert 'result.check.roll' in COMPONENT
    assert 'CheckBreakdown result={result}' in COMPONENT
    assert 'receipt.resolution' in COMPONENT
    assert 'receipt.hero_progression' in COMPONENT


def test_existing_authoritative_flow_remains_owned_by_hook():
    assert 'onDone={finishCurrent}' in COMPONENT
    assert 'onClick={onContinue}' in COMPONENT
    assert 'setDisplayRoll(check.roll)' in COMPONENT
    assert 'cosmeticD20Face()' in COMPONENT
    assert 'Reveal saved roll and consequences' in COMPONENT
    assert 'acknowledgeResolution' in HOOK
    assert 'writeAcknowledgedReceipt' in HOOK


def test_fullscreen_receipt_scrolling_and_mobile_layout():
    assert 'inkscapeHeldDicePass6660.css' in COMPONENT
    assert 'max-height:min(69dvh,650px)' in CSS
    assert '@media (max-width:850px)' in CSS
    assert '@media (max-width:420px)' in CSS
    assert '@media (prefers-reduced-motion:reduce)' in CSS
    assert ':root' not in CSS
    assert '.arcade-' not in CSS


def test_ui_only_scope_and_no_new_art_fabrication():
    assert 'useGameSocket' not in COMPONENT
    assert 'apiFetch' not in COMPONENT
    assert 'Math.random' not in COMPONENT
    assert 'cosmeticD20Face()' in COMPONENT
    assert 'new Date' not in COMPONENT
