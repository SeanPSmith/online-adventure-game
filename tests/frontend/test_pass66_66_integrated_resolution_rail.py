"""66.66: Active reader receipt is a pure presentation portal, never a second roll."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
ADVENTURE=(ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
READER=(ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()
THEATER=(ROOT/'frontend/src/features/adventure/TurnTheater.tsx').read_text()
STYLES=(ROOT/'frontend/src/pages/game/inkscapeResolutionRailPass6666.css').read_text()
RESOLUTION=(ROOT/'frontend/src/features/adventure/TurnResolutionTheater.tsx').read_text()


def test_single_existing_authoritative_receipt_mounted_in_rail():
    assert 'import { createPortal } from "react-dom"' in THEATER
    assert 'return createPortal(' in THEATER
    assert 'if (inkPaper && resolutionHost && wideRail)' in THEATER
    assert 'receipt={theater.activeReceipt}' in THEATER
    assert THEATER.count('<TurnResolutionTheater') == 2  # desktop and mobile SAME component
    assert THEATER.count('onContinue={theater.acknowledgeResolution}') == 2
    assert 'resolutionHost={inkboundReady ? resolutionHost : null}' in ADVENTURE


def test_rail_host_coexists_with_manuscript_and_hero_folio():
    assert 'onResolutionHost={setResolutionHost}' in ADVENTURE
    assert 'ref={props.onResolutionHost}' in READER
    assert 'className="ibl-resolution-rail-host"' in READER
    assert READER.index('<main id="ibl-chapter"') < READER.index('className="ibl-instruments-disclosure"') < READER.index('className="ibl-turn-rail"')
    assert READER.index('className="ibl-turn-rail"') < READER.index('className="ibl-resolution-rail-host"')


def test_mobile_or_unavailable_host_falls_back_to_existing_dialog():
    assert 'query.addEventListener("change", update)' in THEATER
    assert 'query.removeEventListener("change", update)' in THEATER
    assert 'typeof window.matchMedia === "function"' in THEATER
    assert 'role="dialog" aria-modal="true"' in THEATER
    assert 'role="region" aria-label="Current turn dice and consequences"' in THEATER
    assert 'min-width:1240px' in STYLES


def test_dice_remain_server_authoritative_and_held_for_user_action():
    assert 'cosmeticD20Face' in RESOLUTION  # visual frames ONLY
    assert 'setDisplayRoll(check.roll)' in RESOLUTION  # committed roll on final frame
    assert 'setFolioStage("consequences")' in RESOLUTION
    assert 'View consequences' in RESOLUTION
    assert 'CONTINUE THE CHRONICLE' in RESOLUTION
    assert 'theater.acknowledgeResolution' in THEATER
    for forbidden in ('Math.random(', 'createTurn(', 'rollDice(', 'submitChoice(', 'fetch('):
        assert forbidden not in STYLES + THEATER


def test_rail_removes_previous_turn_ledger_only_when_receipt_present():
    assert ':has(.q6666-resolution-rail) > .ibl-rail-section' in STYLES
    assert '.ibl-turn-rail:has(.q6666-resolution-rail)' in STYLES
    assert 'data-turn-phase={props.turnPhase}' in READER
    assert 'props.lastResult.check.roll' in READER


def test_six_theme_tokens_and_legible_sizing_no_fake_texture():
    for theme in ('cream','parchment','navy','midnight','phosphor'):
        assert f'data-ink-paper="{theme}"' in STYLES
    assert 'var(--ia-paper)' in STYLES or 'var(--ia-copy)' in STYLES
    assert 'min-width:0' in STYLES
    assert 'focus-visible' in STYLES
    assert 'prefers-reduced-motion:reduce' in STYLES
    assert 'grain' not in STYLES.lower()


def test_unchanged_gameplay_sequencing_and_recovery_boundaries():
    assert 'onRecover={live.restore}' in ADVENTURE
    assert 'onSync={live.sync}' in ADVENTURE
    assert '<QuickEventModal' in ADVENTURE
    assert 'useTurnTheater({' in ADVENTURE
    assert 'onLockChoice={lockChoice}' in ADVENTURE
    assert '<TurnTheater' in ADVENTURE


def test_integration_stylesheet_imported_once():
    assert READER.count('import "./inkscapeResolutionRailPass6666.css";') == 1
    assert (ROOT/'frontend/src/pages/game/inkscapeResolutionRailPass6666.css').exists()
