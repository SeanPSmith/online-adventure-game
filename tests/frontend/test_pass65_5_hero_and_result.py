"""Pass 65.5 contracts: production-safe Hero data and illustrated roll preview.

No external image or Python dependencies. The release script runs these checks.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'frontend/src/pages/game'


def test_hero_folio_uses_canonical_read_only_services_and_real_fields():
    code = (BASE / 'InkboundHeroFolio.tsx').read_text()
    for required in ('getCharacter(', 'listCharacters(', 'getCreationRules(', 'hero.stats', 'hero.skills',
                     'hero.talents', 'hero.effects', 'hero.inventory', 'hero.health',
                     'hero.xp_progress_percent', 'hero.unspent_stat_points', 'hero.hero_status'):
        assert required in code, required
    for forbidden in ('advanceCharacter(', 'updateCharacterProfile(', 'setHeroDisposition(',
                      'deleteCharacter(', 'rollDice(', 'submitChoice(', 'socket.emit(', 'fetch('):
        assert forbidden not in code
    assert 'Hero controls' in code


def test_gallery_opens_real_character_sheet_and_preserves_real_hall():
    atlas = (BASE / 'InkboundJourneyGallery.tsx').read_text()
    foundation = (BASE / 'InkboundFoundationPage.tsx').read_text()
    assert 'InkboundHeroFolio' in atlas
    assert 'onSelectHero?.(hero.character_id)' in atlas
    assert 'setFolioHeroId(id)' in foundation
    assert 'changePage("sheet")' in foundation
    assert 'page === "sheet"' in foundation or 'page==="sheet"' in atlas
    assert 'Link to="/game/heroes"' in atlas or 'to="/game/heroes"' in foundation


def test_result_is_accessible_separate_preview_with_no_game_writes():
    code = (BASE / 'InkboundOutcomePreview.tsx').read_text()
    atlas = (BASE / 'InkboundJourneyGallery.tsx').read_text()
    assert '<InkboundOutcomePreview ' in atlas
    for required in ('role="dialog"', 'aria-modal="true"', 'aria-labelledby=',
                     'aria-describedby=', 'event.key === "Escape"', 'event.key !== "Tab"',
                     'document.body.style.overflow', 'aria-expanded={expanded}',
                     'SAMPLE', 'not a real roll'.lower()):
        assert required.lower() in code.lower(), required
    assert '14' in code and '+2 Instinct' in code and '>15<' in code
    assert 'd20 (14) + Instinct (2) = 16 vs. difficulty 15' in code
    for forbidden in ('submitChoice(', 'socket.emit(', 'applyXp(', 'applyOutcome(', 'fetch(', 'Math.random('):
        assert forbidden not in code


def test_scoped_sketchbook_dressing_still_separates_art_and_paper():
    css = (BASE / 'inkboundFolio.css').read_text()
    foundation = (BASE / 'InkboundFoundationPage.tsx').read_text()
    assert 'import "./inkboundFolio.css";' in foundation
    assert 'north-road-editorial.png' in (BASE / 'InkboundHeroFolio.tsx').read_text()
    assert 'background:var(--ink-paper)' in css
    for forbidden in ('mask-image:', 'clip-path:', 'radial-gradient('):
        assert forbidden not in css
    assert '@media(max-width:610px)' in css
    assert 'prefers-reduced-motion:reduce' in css
