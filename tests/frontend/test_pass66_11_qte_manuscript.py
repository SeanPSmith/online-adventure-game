from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODAL = (ROOT / 'frontend/src/features/adventure/QuickEventModal.tsx').read_text(encoding='utf-8')
PAGE = (ROOT / 'frontend/src/pages/game/AdventurePage.tsx').read_text(encoding='utf-8')
MAIN = (ROOT / 'frontend/src/main.tsx').read_text(encoding='utf-8')
CSS_PATH = ROOT / 'frontend/src/styles/inkboundQuickEventPass6611.css'
CSS = CSS_PATH.read_text(encoding='utf-8')


def test_qte_uses_real_game_event_and_choice_callbacks():
    assert 'onChoose(optionId);' in MODAL
    assert 'onChoose("__timeout__");' in MODAL
    assert 'resolution?.outcomes ?? []' in MODAL
    assert 'activeEvent.correct_option_label' in MODAL
    assert 'activeEvent.success_effect' in MODAL
    assert 'activeEvent.failure_effect' in MODAL
    assert 'event?.timeout_seconds ?? 12' in MODAL
    assert 'window.addEventListener("keydown", onKeyDown)' in MODAL
    assert 'onClick={onDismissResolution}' in MODAL
    assert 'data-ink-paper={inkPaper}' in MODAL


def test_presentation_is_tied_to_live_adventure_and_not_to_fake_data():
    assert 'inkPaper={inkspacePaper}' in PAGE
    assert 'const inkspacePaper = inkPaper' in PAGE
    assert 'fantasyArtwork={fantasyIllustration}' in PAGE
    assert 'event={' in PAGE and 'live.game?.pending_micro_event' in PAGE
    assert 'resolution={' in PAGE and 'live.microEventResolution' in PAGE
    assert 'onChoose={live.submitMicroEventChoice}' in PAGE
    assert 'onDismissResolution={live.dismissMicroEventResolution}' in PAGE
    assert '<figure className="ibq-artwork" aria-hidden="true">' in MODAL
    assert '/art/inkbound/hero-vista.png' in MODAL
    assert 'if (!activeEvent)' in MODAL


def test_css_is_integrated_for_all_six_themes_with_mobile_and_contrast():
    assert 'import "./styles/inkboundQuickEventPass6611.css";' in MAIN
    assert CSS_PATH.is_file()
    for paper in ('ivory','cream','parchment','navy','phosphor','midnight'):
        assert f'.ibq-backdrop[data-ink-paper="{paper}"]' in CSS
    assert '.ibq-backdrop .qte-option:disabled' in CSS
    assert ':focus-visible' in CSS
    assert '@media(max-width:760px)' in CSS
    assert '@media(prefers-reduced-motion:reduce)' in CSS
    assert '.ibq-backdrop .ibq-folio::-webkit-scrollbar' in CSS
