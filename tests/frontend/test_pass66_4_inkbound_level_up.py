"""Pass 66.4: live Level Up folio and six-theme contract.

Only the backend progression receipt may supply earned stats and effects.
No extra Python or image-processing dependencies.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'frontend/src/features/adventure/LevelUpModal.tsx'
PAGE = ROOT / 'frontend/src/pages/game/AdventurePage.tsx'
CSS = ROOT / 'frontend/src/features/adventure/inkboundLevelUpPass664.css'
ART = ROOT / 'frontend/public/art/inkbound/north-road-editorial.png'


def test_live_progression_receipt_enters_actual_inkbound_folio():
    source, page = SRC.read_text(), PAGE.read_text()
    assert 'inkPaper?: InkPaper' in source
    assert 'inkPaper={inkboundReady ? inkPaper : undefined}' in page
    assert 'update.level_before' in source and 'update.level_after' in source
    assert 'update.xp_gained' in source and 'update.max_health' in source
    assert 'update.new_effects' in source
    assert 'update.xp_progress_percent' in source
    assert 'update.xp_needed_for_next_level' in source
    assert 'newEffects.map(' in source
    assert 'Stat Increased' not in source
    assert 'New Perk Unlocked' not in source
    assert 'Quiet Flame' not in source
    assert 'Math.random' not in source


def test_classic_path_accessibility_and_no_native_browser_dialogs():
    source = SRC.read_text()
    assert 'if (!inkPaper)' in source
    assert 'className="level-up-backdrop"' in source
    assert 'role="dialog" aria-modal="true"' in source
    assert 'aria-labelledby="ilu-title"' in source
    assert 'aria-valuenow={progress}' in source
    assert 'ref={continueRef}' in source
    assert 'event.key === "Escape"' in source
    assert 'event.key === "Tab"' in source
    assert 'window.confirm' not in source
    assert '<select' not in source


def test_all_six_palettes_and_real_transparent_art():
    source, css = SRC.read_text(), CSS.read_text()
    assert 'import "./inkboundLevelUpPass664.css"' in source
    assert 'data-ink-paper={inkPaper}' in source
    for theme in ('ivory', 'cream', 'parchment', 'navy', 'phosphor', 'midnight'):
        if theme != 'ivory':
            assert f'data-ink-paper="{theme}"' in css
    assert 'max-height:calc(100dvh' in css
    assert 'overflow-y:auto' in css
    assert '.ilu-action:is(:hover,:focus-visible)' in css
    assert 'prefers-reduced-motion:reduce' in css
    assert ART.exists()
    png = ART.read_bytes()
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    assert png[25] in (4,6), 'Production artwork must include alpha, no baked background.'
    assert not re.search(r'background-image\s*:', css)
