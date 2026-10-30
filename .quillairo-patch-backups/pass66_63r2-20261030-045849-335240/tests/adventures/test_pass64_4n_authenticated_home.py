"""Pass 64.4N: real authenticated home moved to an opt-in Living Book scene.

The test intentionally protects existing handlers rather than asserting incidental
CSS coordinates or demanding that the production homepage be redesigned too.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
HOME = (SRC / "pages/game/GameHomePage.tsx").read_text(encoding="utf-8")
LEAF = (SRC / "pages/game/InkspaceAuthenticatedHome.tsx").read_text(encoding="utf-8")
CSS = (SRC / "pages/game/inkspaceAuthenticatedHome.css").read_text(encoding="utf-8")
ROUTER = (SRC / "router.tsx").read_text(encoding="utf-8")
LAYOUT = (SRC / "layouts/GameLayout.tsx").read_text(encoding="utf-8")


def test_new_home_is_protected_but_original_home_is_still_available():
    assert 'path: "home-lab"' in ROUTER
    assert '.LivingBookHomeLabPage' in ROUTER
    assert 'element: <RequireAuth />' in ROUTER
    assert 'index: true' in ROUTER and '.GameHomePage' in ROUTER
    assert 'location.pathname === "/game/home-lab"' in LAYOUT
    assert 'return <GameHomePage homeLab />' in HOME
    assert 'className="p64-desk"' in HOME
    assert 'data-home-lab={homeLab ? "true" : undefined}' in HOME


def test_real_home_data_flows_from_existing_server_and_hero_service():
    assert 'useGameSocket()' in HOME and 'listCharacters()' in HOME
    for key in ('playableHeroes={playableHeroes}', 'adventures={adventures}',
                'catalog={visibleCatalog}', 'occupiedHeroIds={occupiedHeroIds}',
                'selectedHeroId={selectedHeroId}', 'connected={connected}',
                'onChooseHero={setSelectedHeroId}', 'onNavigate={openBookSpread}',
                'onInspectAdventure={inspectAdventure}'):
        assert key in HOME
    assert 'setPendingAdventure(adventure)' in HOME
    assert 'createRoom(selectedHeroId, adventureId, pendingPlayMode)' in HOME
    assert 'joinRoom(selectedHeroId, roomCode)' in HOME
    assert 'abandonAdventure(adventure.room_code)' in HOME
    assert 'RoomInviteButton' in HOME
    assert 'HIDDEN_INTERNAL_ADVENTURES' in HOME
    assert 'hero.is_alive && hero.hero_status === "active"' in HOME


def test_manuscript_actions_are_real_navigation_and_no_fake_player_records():
    for key in ('adventure.room_code', 'adventure.character_id', 'resume.room_code',
                'resume.character_id', 'hero.character_id', 'onChooseHero(hero.character_id)',
                'onNavigate("discover")', 'onNavigate("journeys")', 'onNavigate("heroes")',
                'onInspectAdventure(discovery)', '/game/heroes/new', '/game/heroes/'):
        assert key in (LEAF + HOME), key
    assert 'const ROOT = "/art/pass64/"' in LEAF
    assert '<img' in LEAF and 'alt=' in LEAF
    assert 'dangerouslySetInnerHTML' not in LEAF
    assert '<select' not in LEAF
    assert 'SeanSteezy' not in LEAF and 'Kael' not in LEAF
    assert 'localStorage' not in LEAF
    # The auth username, never invented profile details, is used by the lab.
    assert 'username={user?.username ?? "Adventurer"}' in HOME


def test_photo_plate_and_ink_are_separate_with_accessible_mobile_and_reduced_motion():
    assert "pass64-4d-tabletop-book.webp" in CSS
    assert 'width:max(100vw,177.6833vh)' in CSS
    assert 'height:max(100vh,56.2799vw)' in CSS
    assert 'grid-template-columns:1fr 1fr' in CSS
    assert 'overflow-x:auto' in CSS
    assert '@media(max-width:800px)' in CSS
    assert '@media(prefers-reduced-motion:reduce)' in CSS
    assert "data-home-lab" in CSS
    assert (ROOT / 'frontend/public/art/pass64/pass64-4d-tabletop-book.webp').is_file()
    assert (ROOT / 'frontend/public/art/pass64/inkspace/harbor-traveler-cutout.png').is_file()
    assert (ROOT / 'frontend/public/art/pass64/inkspace/forgotten-crossroads-cutout.png').is_file()
