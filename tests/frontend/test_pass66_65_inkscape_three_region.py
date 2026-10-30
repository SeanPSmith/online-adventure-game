"""Pass 66.65: live Inkscape reader presentation, never game rules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROOM = (ROOT / 'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()
ADVENTURE = (ROOT / 'frontend/src/pages/game/AdventurePage.tsx').read_text()
STYLE = (ROOT / 'frontend/src/pages/game/inkscapeGameplayPass6665.css').read_text()
PAPER = (ROOT / 'frontend/src/features/appearance/inkboundPaper.ts').read_text()


def test_active_reader_wires_new_presentation_stylesheet():
    assert 'import "./inkscapeGameplayPass6665.css"' in ROOM
    assert 'InkboundLiveRoom' in ADVENTURE


def test_right_rail_is_real_semantic_sibling_of_manuscript_and_folio():
    assert '<main id="ibl-chapter"' in ROOM
    assert '<details className="ibl-instruments-disclosure" open>' in ROOM
    assert '<aside className="ibl-turn-rail" aria-label="Turn record and chapter continuity">' in ROOM
    assert ROOM.index('<main id="ibl-chapter"') < ROOM.index('<details className="ibl-instruments-disclosure"') < ROOM.index('<aside className="ibl-turn-rail"')


def test_previous_die_is_a_committed_server_record_not_new_random_roll():
    assert 'props.lastResult.check.roll' in ROOM
    assert 'props.lastResult.check.total' in ROOM
    assert 'props.lastResult.check.difficulty' in ROOM
    assert 'props.lastResult.check.outcome.replaceAll' in ROOM
    assert 'props.lastProgression?.xp_gained' in ROOM
    assert 'props.lastProgression.health_change' in ROOM
    for forbidden in ('Math.random', 'crypto.getRandomValues', 'rollDice(', 'submitChoice(', 'createTurn('):
        assert forbidden not in ROOM


def test_turn_status_is_read_only_and_uses_existing_theater_phase():
    assert 'turnPhase={theater.phase}' in ADVENTURE
    assert 'props.turnPhase === "intermission"' in ROOM
    assert 'props.turnPhase === "resolution"' in ROOM
    assert 'props.turnPhase === "retry"' in ROOM
    assert 'role="status" aria-live="polite"' in ROOM


def test_private_hero_portrait_is_read_only_and_optional():
    assert 'getHeroPortraits(heroId)' in ROOM
    assert 'book.candidates.find((candidate) => candidate.attempt === book.selected_attempt)' in ROOM
    assert 'if (active) setSelectedPortraitUrl' in ROOM
    assert 'selectedPortraitUrl ? <div className="ibl-hero-portrait"' in ROOM
    assert 'generateHeroPortrait(' not in ROOM
    assert 'chooseHeroPortrait(' not in ROOM


def test_three_columns_keep_main_and_folio_independent_scrolls():
    assert 'min-width:1240px' in STYLE
    assert 'grid-template-columns:clamp(215px,17.5vw,272px) minmax(0,1fr) clamp(222px,18.5vw,290px)' in STYLE
    assert 'grid-column:1!important' in STYLE
    assert 'grid-column:2!important' in STYLE
    assert 'grid-column:3' in STYLE
    assert STYLE.count('overflow-y:auto') >= 3
    assert 'overscroll-behavior-y:contain' in STYLE


def test_narrow_screens_keep_current_existing_reader_not_overflowing_rail():
    assert 'max-width:1239px' in STYLE
    assert '.ibl-turn-rail {display:none!important' in STYLE
    assert 'ibl-turn-feedback' in ROOM  # original accessible compact receipt retained
    assert 'ibl-choices {grid-template-columns:repeat(2,minmax(0,1fr))' in STYLE


def test_all_six_inkscape_themes_retained():
    for theme in ('parchment', 'ivory', 'cream', 'navy', 'phosphor', 'midnight'):
        assert f'id: "{theme}"' in PAPER
    assert 'var(--ia-paper)' in STYLE or 'var(--ia-wash)' in STYLE
    assert 'paper-grain' not in STYLE
    assert 'mask-image' not in STYLE


def test_source_does_not_replace_turn_theater_or_engine():
    assert '<TurnTheater' in ADVENTURE
    assert 'useTurnTheater({' in ADVENTURE
    assert '<QuickEventModal' in ADVENTURE
    assert 'onLockChoice={lockChoice}' in ADVENTURE


def test_chronicle_button_uses_existing_history_drawer():
    assert 'onClick={() => toggle("history")}' in ROOM
    assert '<section className="ibl-rail-section ibl-rail-archive">' in ROOM
