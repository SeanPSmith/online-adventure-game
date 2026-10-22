"""The real invite funnel must stay ink-styled without losing co-op entry logic."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = (ROOT / 'frontend/src/pages/public/JoinInvitePage.tsx').read_text(encoding='utf-8')
CSS = (ROOT / 'frontend/src/styles/quillairoInvitePass6613.css').read_text(encoding='utf-8')
MAIN = (ROOT / 'frontend/src/main.tsx').read_text(encoding='utf-8')


def test_public_invitation_uses_real_room_and_login_return_path():
    assert 'joinRoom(selectedHeroId, roomCode)' in PAGE
    assert 'listCharacters()' in PAGE
    assert 'heroes.filter((hero) => hero.is_alive && hero.hero_status === "active"' in PAGE
    assert '!occupiedHeroIds.has(hero.character_id)' in PAGE
    assert 'state={{ returnTo }}' in PAGE
    assert '/game/heroes/new?returnTo=${encodeURIComponent(returnTo)}' in PAGE
    assert 'lastRoomEntry' in PAGE and 'clearRoomEntry()' in PAGE
    assert '/game/adventure/${encodeURIComponent(code)}?hero=${encodeURIComponent(characterId)}' in PAGE
    assert 'disabled={!connected || !selectedHeroId || joining}' in PAGE


def test_invite_uses_a_custom_accessible_radio_picker_with_loading_and_error_states():
    assert 'type="radio"' in PAGE and 'checked={selectedHeroId === hero.character_id}' in PAGE
    assert '<fieldset' in PAGE and '<legend>' in PAGE
    assert 'heroesLoading' in PAGE and 'role="status"' in PAGE
    assert 'role="alert"' in PAGE and 'onClick={clearError}' in PAGE
    assert 'setJoining(false)' in PAGE
    assert '<TerminalSelect' not in PAGE and '<select' not in PAGE


def test_invite_uses_separate_art_and_six_theme_real_css():
    assert '/art/quillairo-public/auth-journey.png' in PAGE
    assert 'quillairoInvitePass6613.css' in MAIN
    assert 'qpub-invite-art' in CSS and 'qpub-invite-hero' in CSS
    assert 'data-ink-paper="navy"' in CSS
    assert 'data-ink-paper="midnight"' in CSS
    assert 'data-ink-paper="phosphor"' in CSS
    assert '@media(max-width:760px)' in CSS
    assert 'prefers-reduced-motion:reduce' in CSS
    assert CSS.count('{') == CSS.count('}')
    # Theme colors are inherited from the single public shell token source.
    palette = (ROOT / 'frontend/src/styles/quillairoPublicPass6612.css').read_text(encoding='utf-8')
    for theme in ('cream', 'parchment', 'navy', 'phosphor', 'midnight'):
        assert f'data-ink-paper="{theme}"' in palette
