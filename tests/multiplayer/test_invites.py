from tests.support import PROJECT_ROOT
from pathlib import Path

ROOT = PROJECT_ROOT


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_public_invite_route_exists_and_preserves_login_return_path():
    router = read("frontend/src/router.tsx")
    require_auth = read("frontend/src/components/auth/RequireAuth.tsx")
    login = read("frontend/src/pages/auth/LoginPage.tsx")
    register = read("frontend/src/pages/auth/RegisterPage.tsx")

    assert 'path: "join/:roomCode"' in router
    assert 'state={{ returnTo:' in require_auth
    assert 'state?.returnTo ?? "/game"' in login
    assert 'state: { returnTo: state?.returnTo }' in register


def test_invite_page_joins_room_with_selected_hero():
    page = read("frontend/src/pages/public/JoinInvitePage.tsx")

    assert "joinRoom(selectedHeroId, roomCode)" in page
    assert "JOIN ADVENTURE" in page
    assert "CREATE HERO" in page
    assert "lastRoomEntry" in page
    assert "/game/adventure/" in page


def test_room_invite_supports_native_share_copy_text_and_email():
    component = read("frontend/src/components/game/RoomInviteButton.tsx")

    assert "navigator.share" in component
    assert "navigator.clipboard" in component
    assert "COPY LINK" in component
    assert "sms:?&body=" in component
    assert "mailto:?subject=" in component
    assert "/join/" in component


def test_invite_controls_are_exposed_for_open_coop_rooms():
    home = read("frontend/src/pages/game/GameHomePage.tsx")
    adventure = read("frontend/src/pages/game/AdventurePage.tsx")

    assert "RoomInviteButton" in home
    assert 'adventure.play_mode === "coop"' in home
    assert "RoomInviteButton" in adventure
    assert 'live.room?.play_mode === "coop"' in adventure
    assert "INVITE / SHARE" in adventure


def test_hero_creation_can_return_to_invitation():
    page = read("frontend/src/pages/heroes/HeroCreatePage.tsx")

    assert 'searchParams.get("returnTo")' in page
    assert "navigate(returnTo ||" in page
