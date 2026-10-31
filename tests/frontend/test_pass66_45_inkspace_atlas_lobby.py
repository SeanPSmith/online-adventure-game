"""Pass 66.45: protect the real, server-connected Atlas → Hero → Lobby route."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PAGE=(ROOT/'frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx').read_text()
LOBBY=(ROOT/'frontend/src/pages/game/InkboundLobby.tsx').read_text()
ATLAS=(ROOT/'frontend/src/pages/game/quillairoAtlasPass6645.css').read_text()
LOBBY_CSS=(ROOT/'frontend/src/pages/game/quillairoLobbyPass6645.css').read_text()

def test_real_catalog_and_selected_hero_still_own_experience():
    assert 'visibleCatalog.filter(' in PAGE
    assert 'onChange={onSelectHero}' in PAGE
    assert 'onCreate(selectedStory,mode)' in PAGE
    assert 'onJoin(roomCode.trim().toUpperCase())' in PAGE
    assert 'const selectedHero = freeHeroes.find(' in PAGE
    assert 'function TravelHeroFolio({ hero }: { hero: Character | undefined })' in PAGE
    assert 'Health {hero.health}/{hero.max_health}' in PAGE
    assert 'hero.character_id' in PAGE
    assert PAGE.count('<TravelHeroFolio hero={selectedHero} />')==2
    assert 'onError={event => nextCoverSource(' in PAGE
    assert 'onClick={() => inspect(item)}' in PAGE

def test_lobby_retains_authoritative_party_and_start_actions():
    for value in ('props.players.map(', 'props.readiness.find(', 'readiness?.ready',
                  'props.onBeginAdventure', 'props.canBeginAdventure',
                  'props.chapterPreparing', 'props.onToggleNarrator',
                  'props.onStartSolo', '<RoomInviteButton'):
        assert value in LOBBY, value
    assert 'data-can-begin={props.canBeginAdventure && props.connected ? "yes" : "no"}' in LOBBY

def test_inkspace_styles_are_scoped_responsive_and_theme_aware():
    assert 'import "./quillairoAtlasPass6645.css";' in PAGE
    assert 'import "./quillairoLobbyPass6645.css";' in LOBBY
    assert '.inkbound-home .i656-world' in ATLAS
    assert '.inkbound-home .i656-travel-folio' in ATLAS
    assert '.inkbound-lobby .ibl-lobby-main' in LOBBY_CSS
    for theme in ('midnight','navy','phosphor'):
        assert theme in ATLAS and theme in LOBBY_CSS
    for css in (ATLAS,LOBBY_CSS):
        assert '@media(max-width:' in css
        assert 'prefers-reduced-motion' in css
        assert '@import' not in css
        assert 'url(http' not in css

def test_new_stylesheets_are_valid_css_if_css_parser_available():
    try:
        import tinycss2
    except ImportError:
        # Never make this an undeclared runtime/test dependency.
        for css in (ATLAS,LOBBY_CSS):
            assert css.count('{')==css.count('}') and '/*' in css
        return
    for css in (ATLAS,LOBBY_CSS):
        errors=[t for t in tinycss2.parse_stylesheet(css,skip_whitespace=True,skip_comments=True) if t.type=='error']
        assert not errors, errors
