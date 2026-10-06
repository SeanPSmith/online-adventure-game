from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app import main
from app.characters.models import Stat


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_party_hero_snapshots_are_room_scoped_and_do_not_expose_owner_data():
    player = SimpleNamespace(
        player_id="player-b",
        character_id="hero-b",
    )
    room = SimpleNamespace(players={"player-b": player})
    character = SimpleNamespace(
        character_id="hero-b",
        owner_user_id="private-user-id",
        name="Partner Hero",
        bio="A readable party-facing bio.",
        level=3,
        experience=440,
        max_health=18,
        health=15,
        is_alive=True,
        stats={Stat.AGILITY: 4},
        effects=[{"name": "Quick Footed", "active": True, "remaining_turns": 1}],
        inventory=["private-ish inventory detail"],
    )

    with patch.object(main.rooms, "room_by_code", return_value=room), patch.object(
        main.character_store,
        "get_by_id",
        new=AsyncMock(return_value=character),
    ):
        snapshots = await main.build_party_hero_summaries("ABCD")

    assert len(snapshots) == 1
    snapshot = snapshots[0]
    assert snapshot["character_id"] == "hero-b"
    assert snapshot["name"] == "Partner Hero"
    assert snapshot["stats"] == {"agility": 4}
    assert snapshot["effects"][0]["name"] == "Quick Footed"
    assert "owner_user_id" not in snapshot
    assert "inventory" not in snapshot


def test_room_game_state_hydrates_party_heroes_without_weakening_character_ownership():
    backend = read("app/main.py")
    character_routes = read("app/characters/routes.py")

    assert 'state["party_heroes"]' in backend
    assert "await build_party_hero_summaries" in backend
    assert "room_for_socket" in backend
    assert "get_owned_character" in character_routes
    assert 'detail=\n                "Character does not exist."' in character_routes


def test_adventure_can_switch_between_room_hero_views():
    page = read("frontend/src/pages/game/AdventurePage.tsx")
    service = read("frontend/src/services/game.ts")

    assert "party-hero-switcher" in page
    assert "setInspectedCharacterId(player.character_id)" in page
    assert "READ-ONLY PARTY VIEW" in page
    assert "party_heroes" in service
    assert "PartyHeroSnapshot" in service


def test_ascii_social_library_is_large_curated_and_used_in_social_ui():
    library = read("frontend/src/features/social/asciiSocial.ts")
    page = read("frontend/src/pages/game/AdventurePage.tsx")
    socket_context = read("frontend/src/state/GameSocketContext.tsx")

    assert library.count("{ value:") >= 45
    assert "ASCII_REACTION_GROUPS" in library
    assert "table flip" in library
    assert "presenceFace" in page
    assert "ASCII_REACTIONS" in page
    assert "notificationFace(notification.kind)" in socket_context


def test_share_controls_are_visible_during_play_and_in_chronicles():
    adventure = read("frontend/src/pages/game/AdventurePage.tsx")
    history = read("frontend/src/pages/game/HistoryPage.tsx")
    share = read("frontend/src/components/game/ShareMomentButton.tsx")
    invite = read("frontend/src/components/game/RoomInviteButton.tsx")

    assert "SHARE MOMENT" in adventure
    assert "SHARE ENDING" in adventure
    assert "SHARE CHRONICLE" in history
    assert "navigator.share" in share
    assert "navigator.clipboard" in share
    assert "INVITE / SHARE" in adventure
    assert "[↗] SHARE..." in invite


def test_outlier_randomizes_board_size_and_symbol_pair_each_round():
    outlier = read("frontend/src/features/adventure/FindOutlierGame.tsx")

    assert "BOARD_SIZES = [5, 6, 7, 8]" in outlier
    assert "SYMBOL_PAIRS" in outlier
    assert "pickDifferentIndex" in outlier
    assert "makeRound(current.id + 1, current)" in outlier
    assert "gridTemplateColumns: `repeat(${round.columns}" in outlier
    assert "NEW SYMBOLS EACH ROUND" in outlier
