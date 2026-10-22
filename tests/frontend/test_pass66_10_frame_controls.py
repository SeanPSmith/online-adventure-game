"""Pass 66.10: custom frame, page-wide controls, theme-safe logo and replay contracts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend" / "src"

def read(path: str) -> str:
    return (FRONT / path).read_text(encoding="utf-8")


def test_last_loaded_style_owns_frame_without_legacy_overrides():
    entry = read("main.tsx")
    assert 'import "./styles/inkboundFramePass6610.css";' in entry
    assert entry.index('inkboundGameplayPass667.css') < entry.index('inkboundFramePass6610.css')
    css = read("styles/inkboundFramePass6610.css")
    assert '.game-site-shell.is-adventure-mode:has(.inkbound-live)' in css
    assert 'grid-template-columns:minmax(0,1fr) minmax(270px,315px)' in css
    assert 'overflow-y:scroll!important' in css
    assert '@media (max-width:900px)' in css
    assert 'height:auto!important' in css


def test_scrollbar_uses_theme_palette_and_real_wide_tracks():
    css = read("styles/inkboundFramePass6610.css")
    assert 'width:17px;height:17px' in css
    assert '::-webkit-scrollbar-thumb' in css
    assert 'scrollbar-width:auto' in css
    assert '--q-scroll-thumb:var(--ia-dim' in css
    assert '--q-scroll-track:var(--ia-wash' in css


def test_logo_is_single_approved_image_and_overlay_only_for_two_palettes():
    lockup = read("components/brand/BrandLockup.tsx")
    css = read("styles/inkboundFramePass6610.css")
    assert lockup.count('className="quillairo-lockup__art"') == 1
    assert 'data-brand-paper={paper}' in lockup
    assert 'paper === "navy" || paper === "phosphor" || paper === "midnight"' in lockup
    for tone in ('parchment', 'phosphor'):
        assert f'[data-brand-paper="{tone}"]::after' in css
    assert '-webkit-mask-image' in css
    assert 'filter: hue-rotate' not in css


def test_shared_controls_and_dialogs_keep_focus_and_selected_theme():
    css = read("styles/inkboundFramePass6610.css")
    modal = read("state/ModalContext.tsx")
    assert 'role="dialog"' in modal and 'data-ink-paper={paper}' in modal
    for token in ('terminal-select-menu','[role="alert"]','::backdrop',':focus-visible'):
        assert token in css


def test_arcade_result_recovery_never_requests_client_roll():
    runtime = read("features/adventure/IntermissionRuntime.tsx")
    theater = read("features/adventure/useTurnTheater.ts")
    assert 'storyReady && storyReadySeconds <= 0' in runtime
    assert 'submitFinalScore(); onStoryReadyComplete();' in runtime
    assert 'OPEN THE COMMITTED DICE RESULT' in runtime
    assert 'if (!final || final.preliminary) return;' in theater
    assert 'const durationMs = 3000' in theater
    assert 'finishIntermissionStoryReady' in theater
