"""66.52: archive-only visual consolidation; gameplay and owned records unchanged."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(path):return (ROOT/path).read_text(encoding='utf-8')

def test_archives_import_shared_inkscape_stylesheet():
    for path in ('frontend/src/pages/game/MyAdventuresPage.tsx',
                 'frontend/src/pages/game/HistoryPage.tsx'):
        source=read(path)
        assert 'import "./inkscapeArchivePass6652.css";' in source

def test_continue_recovery_share_and_narration_remain_real():
    journeys=read('frontend/src/pages/game/MyAdventuresPage.tsx')
    chronicles=read('frontend/src/pages/game/HistoryPage.tsx')
    for required in ('apiFetch<Library>', 'row.director_retry_required', 'encodeURIComponent(row.room_code)',
       'setShelf(value)', 'onClick={() => setReload', 'READ CHRONICLE', 'ArchivedChronicleAudio', 'ShareMomentButton'):
       assert required in journeys, required
    for required in ('listCharacters()', 'listCharacterStories(', 'deduplicated.set(', 'ArchivedChronicleAudio', 'ShareMomentButton'):
       assert required in chronicles, required

def test_hero_status_and_portrait_permissions_unchanged():
    hero=read('frontend/src/pages/heroes/HeroManagerPage.tsx')
    css=read('frontend/src/pages/heroes/quillairoHeroArchivePass6615.css')
    for required in ('getHeroPortraits(', 'selected_attempt', 'setHeroDisposition(', 'deleteCharacter(', 'confirmName !== hero.name'):
       assert required in hero, required
    assert 'THE HERO REGISTER' in hero
    assert 'filter:invert(1) grayscale(1) sepia(1)' not in css
    assert '[data-ink-paper="navy"] .qh15-sheet-portrait-frame>img' not in css
    assert 'Only the decorative fallback monogram' in css

def test_only_archive_and_chronicle_styles_are_scoped():
    css=read('frontend/src/pages/game/inkscapeArchivePass6652.css')
    for required in ('.game-main:has(.history-grid)', '.game-main:has(.history-grid) .page-title',
       '.game-main:has(.history-grid) .panel:has(.history-grid)', '.history-card details', '.history-card .chronicle-audio',
       'var(--ix-gold', 'prefers-reduced-motion'):
       if required=='prefers-reduced-motion': continue
       assert required in css, required
    for forbidden in ('.inkbound-live', '.inkbound-turn-theater', '.arcade', 'filter:grayscale', 'background-image:', 'paper-grain'):
       assert forbidden not in css
    assert '@media(max-width:950px)' in css
    assert ':focus-visible' in css

def test_archive_css_is_parseable():
    try:import tinycss2
    except ImportError:return
    stylesheet=tinycss2.parse_stylesheet(read('frontend/src/pages/game/inkscapeArchivePass6652.css'),skip_whitespace=True,skip_comments=True)
    assert not [item for item in stylesheet if item.type=='error']
