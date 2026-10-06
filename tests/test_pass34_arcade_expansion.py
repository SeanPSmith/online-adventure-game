from __future__ import annotations

from pathlib import Path

import pytest

from app.arcade.store import (
    ArcadePublicationStore,
    DEFAULT_ARCADE_PUBLICATION,
)

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_arcade_publication_defaults_and_admin_changes_persist(tmp_path: Path) -> None:
    store = ArcadePublicationStore(tmp_path / "arcade.sqlite3")
    await store.initialize()

    rows = await store.list_publication()
    by_id = {row.game_id: row for row in rows}

    assert set(by_id) == set(DEFAULT_ARCADE_PUBLICATION)
    assert by_id["outlier"].is_live is True
    assert by_id["mahjong_match"].is_live is False
    assert by_id["beer_pong"].is_live is False

    changed = await store.set_live("mahjong_match", True, "admin-user")
    assert changed.is_live is True
    assert changed.updated_by == "admin-user"

    refreshed = {row.game_id: row for row in await store.list_publication()}
    assert refreshed["mahjong_match"].is_live is True

    with pytest.raises(KeyError):
        await store.set_live("not-a-game", True, "admin-user")


def test_pass34_cabinets_are_registered_lab_first() -> None:
    registry = read("frontend/src/features/arcade/ArcadeGameRegistry.tsx")

    for game_id in (
        "beer_pong",
        "basketball",
        "blackjack",
        "war_cards",
        "battleship",
        "mahjong_match",
    ):
        assert f'id: "{game_id}"' in registry

    assert "component: BeerPongGame" in registry
    assert "component: BasketballGame" in registry
    assert "component: BlackjackGame" in registry
    assert "component: WarCardGame" in registry
    assert "component: BattleshipGame" in registry
    assert "component: MahjongMatchGame" in registry


def test_admin_arcade_can_push_and_pull_cabinets() -> None:
    page = read("frontend/src/pages/game/ArcadeLabPage.tsx")
    service = read("frontend/src/services/arcade.ts")
    routes = read("app/arcade/routes.py")

    assert "PUSH TO LIVE ARCADE" in page
    assert "PULL FROM LIVE ARCADE" in page
    assert "setArcadeGameLive" in page
    assert 'user?.permissions.includes("admin")' in page
    assert 'method: "PUT"' in service
    assert '"X-TOT-Admin-Request": "1"' in service
    assert '@router.put("/admin/games/{game_id}")' in routes
    assert "require_admin_write" in routes


def test_non_admin_arcade_filters_to_server_publication_state() -> None:
    page = read("frontend/src/pages/game/ArcadeLabPage.tsx")
    assert "allGames.filter" in page
    assert "publication[game.id]?.is_live === true" in page
    assert "catalogReady && !catalogError" in page
    assert "No cabinets are currently published." in page


def test_mahjong_is_matching_game_not_rules_simulation() -> None:
    game = read("frontend/src/features/arcade/games/MahjongMatchGame.tsx")
    assert "MATCH THE TILES" in game
    assert "matched" in game
    assert "streak" in game.lower()
    assert "▧" in game


def test_battleship_uses_hidden_fleet_grid() -> None:
    game = read("frontend/src/features/arcade/games/BattleshipGame.tsx")
    assert "makeFleet" in game
    assert "RADAR FLEET" in game
    assert 'Shot = "hit" | "miss"' in game
    assert "grid" in game.lower()
