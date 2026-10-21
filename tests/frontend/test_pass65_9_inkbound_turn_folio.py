"""Pass 65.9: the real turn receipt has a complete, accessible, themed presentation.

Dependency-free source contracts for the release pipeline. The server is still
fully authoritative; this pass only changes the visual renderer.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
TURN = ROOT / 'frontend/src/features/adventure/TurnTheater.tsx'
RECEIPT = ROOT / 'frontend/src/features/adventure/TurnResolutionTheater.tsx'
PAGE = ROOT / 'frontend/src/pages/game/AdventurePage.tsx'
CSS = ROOT / 'frontend/src/pages/game/inkboundTurnPass659.css'


def test_manifest_and_stylesheet_import_are_present():
    page = PAGE.read_text()
    assert 'import "./inkboundTurnPass659.css";' in page
    assert CSS.is_file()
    # Catch a repeat of Pass 65.8.2's missing-stylesheet build failure.
    for raw in re.findall(r'import\s+["\'](\./[^"\']+\.css)["\']', page):
        assert (PAGE.parent / raw).is_file(), raw


def test_genuine_svg_dice_uses_committed_visual_number_and_classic_remains():
    result = RECEIPT.read_text()
    theater = TURN.read_text()
    assert '<InkboundDiceFace number={displayRoll} rolling={rolling} />' in result
    assert '<svg className={`inkbound-dice-illustration' in result
    assert 'role="img"' in result
    assert 'aria-label={rolling ? "Dice rolling" : `D20 rolled ${number}`}' in result
    assert 'fill="none"' in result
    assert 'buildAsciiD20(displayRoll)' in result
    assert 'const check = result.check;' in result
    assert 'setDisplayRoll(check.roll)' in result
    assert 'setDisplayRoll(cosmeticD20Face())' in result
    assert 'Math.random()' not in result
    assert 'inkbound={Boolean(inkPaper)}' in theater
    assert 'onContinue={theater.acknowledgeResolution}' in theater


def test_full_authoritative_receipt_is_still_visible():
    source = RECEIPT.read_text()
    for text in ('XP EARNED', 'health_events', 'died_this_turn',
                 'THE HERO HAS FALLEN', 'effect_details', 'talent_details',
                 'check.total', 'check.difficulty', 'receipt.resolution',
                 'theater-continue', 'receipt.completed'):
        assert text in source, text
    # Keep the old receipt reconciliation and story sequence untouched.
    turn = TURN.read_text()
    assert 'finishIntermissionStoryReady' in turn
    assert 'onSubmitScore={onSubmitIntermissionScore}' in turn
    assert 'onClick={onSync}' in turn
    assert 'onClick={onRetry}' in turn


def test_all_six_palettes_and_motion_settings_are_inherited():
    css = CSS.read_text()
    inherited = (ROOT / 'frontend/src/pages/game/inkboundAdventurePass657.css').read_text()
    for paper in ('parchment', 'ivory', 'cream', 'navy', 'phosphor', 'midnight'):
        assert f'.inkbound-turn-theater[data-ink-paper="{paper}"]' in inherited
    for important in ('.inkbound-dice-illustration', '.theater-breakdown',
                      '.theater-outcome', '.theater-progression-card',
                      '.intermission-runtime', '.intermission-skip',
                      '@media (max-width: 680px)', 'prefers-reduced-motion: reduce'):
        assert important in css, important
    assert 'mask-image' not in css
    assert 'radial-gradient(' not in css
    assert 'background-image: url(' not in css
    assert 'var(--ia-text)' in css and 'var(--ia-paper)' in css
