"""66.53: Inkscape Hero Hall/character surfaces, presentation-only contract."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding='utf-8')

HALL = 'frontend/src/pages/heroes/HeroManagerPage.tsx'
SHEET = 'frontend/src/pages/heroes/HeroSheetPage.tsx'
CREATE = 'frontend/src/pages/heroes/HeroCreatePage.tsx'
STYLE = 'frontend/src/pages/heroes/inkscapeHeroPass6653.css'


def test_three_hero_surfaces_share_scoped_inkscape_layer():
    for page in (HALL, SHEET, CREATE):
        assert 'import "./inkscapeHeroPass6653.css";' in read(page)
    css = read(STYLE)
    for hook in ('.qh15-archive', '.qh15-sheet-frontispiece', '.quill-hero-creator',
                 '@media(max-width:760px)', 'prefers-reduced-motion', ':focus-visible'):
        assert hook in css, hook
    for forbidden in ('filter:grayscale', 'filter:sepia', 'background-image:',
                      'text-shadow:', 'box-shadow:0 0 ', 'url(', '.inkbound-live',
                      'TurnResolutionTheater', 'Director'):
        assert forbidden not in css, forbidden


def test_hall_keeps_real_search_and_server_owned_portraits_and_status():
    page = read(HALL)
    for contract in ('listCharacters()', 'getHeroPortraits(', 'selectedHeroPortraits',
                     'heroBelongsToView(hero, view)', 'setHeroDisposition(',
                     'deleteCharacter(', 'confirmName !== hero.name',
                     'to={`/game/heroes/${hero.character_id}`}',
                     'aria-pressed={view === tab}',
                     'role="status">Showing {visibleHeroes.length} of {characters.length}'):
        assert contract in page, contract
    assert 'title="Hero Hall"' in page


def test_sheet_uses_real_hero_identity_fate_and_progression():
    page = read(SHEET)
    for contract in ('hero?.name ?? "Character sheet"', 'hero.hero_status === "retired"',
                     '!hero.is_alive', 'hero.xp_progress_percent',
                     'advanceCharacter(heroId', 'updateCharacterProfile(heroId',
                     'chooseHeroPortrait(hero.character_id', 'generateHeroPortrait(hero.character_id)',
                     'activeHeroEffects(hero.effects)', 'COMMIT ADVANCEMENT'):
        assert contract in page, contract
    assert 'Every road changes the traveler' not in page


def test_creator_still_reuses_rules_and_server_portrait_limits():
    page = read(CREATE)
    for contract in ('PERSONALITY_QUESTIONS', 'APPEARANCE_CHAPTERS',
                     'getCreationRules()', 'validPoints', 'proposeHeroBiography(',
                     'createCharacter(', 'generateHeroPortrait(', 'chooseHeroPortrait(',
                     'portraits?.attempts_used ?? 0'):
        assert contract in page, contract


def test_regression_r4_is_present_before_next_staging_release():
    page = read('frontend/src/pages/game/MyAdventuresPage.tsx')
    assert '<summary>READ CHRONICLE</summary>' in page
    assert '<summary>Read chronicle</summary>' not in page


def test_inkscape_hero_stylesheet_parseable():
    try:
        import tinycss2
    except ImportError:
        return
    sheet = tinycss2.parse_stylesheet(read(STYLE), skip_whitespace=True, skip_comments=True)
    assert not [node for node in sheet if node.type == 'error']
