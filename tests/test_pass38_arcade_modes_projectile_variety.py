from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_every_arcade_cabinet_declares_solo_two_player_and_multiplayer_style() -> None:
    registry = read("frontend/src/features/arcade/ArcadeGameRegistry.tsx")
    types = read("frontend/src/features/arcade/arcadeTypes.ts")

    assert 'export type ArcadeMultiplayerStyle' in types
    assert '"simultaneous"' in types
    assert '"alternating"' in types
    assert '"score_duel"' in types

    game_blocks = re.findall(r'\{\n\s+id: "[^"]+",.*?\n\s+\},', registry, re.S)
    assert len(game_blocks) == 20
    assert all("supportsSolo: true" in block for block in game_blocks)
    assert all("supportsCoop: true" in block for block in game_blocks)
    assert all("multiplayerStyle:" in block for block in game_blocks)


def test_standalone_arcade_has_solo_and_two_player_hotseat_match_flow() -> None:
    page = read("frontend/src/pages/game/ArcadeLabPage.tsx")
    styles = read("frontend/src/styles/components.css")

    assert '>SOLO</button>' in page
    assert '>2 PLAYER</button>' in page
    assert 'function bankHotseatTurn()' in page
    assert 'BANK P1 SCORE // PLAYER 2' in page
    assert 'FINISH MATCH' in page
    assert 'MATCH COMPLETE' in page
    assert 'REMATCH' in page
    assert 'arcade-hotseat-strip' in page
    assert 'matchSeed' in page
    assert 'turnNumber={arcadeMode === "coop" ? matchSeed : runId}' in page
    assert '.arcade-hotseat-strip' in styles
    assert '.arcade-hotseat-result' in styles


def test_online_intermission_surfaces_two_player_mode_and_shared_score_duel() -> None:
    runtime = read("frontend/src/features/adventure/IntermissionRuntime.tsx")

    assert 'multiplayerModeLabel' in runtime
    assert 'DIRECTOR WORKING // 2 PLAYER' in runtime
    assert '2 PLAYER // BOTH RUNS ARE LIVE // HIGHEST SCORE TAKES THE INTERMISSION_' in runtime


def test_gorilla_artillery_has_seeded_terrain_collision_and_target_relocation() -> None:
    game = read("frontend/src/features/adventure/ProjectileDuelGame.tsx")

    assert 'function generateTerrain' in game
    assert 'function createBattlefield' in game
    assert 'function relocateTarget' in game
    assert 'const surfaceY = terrain[' in game
    assert 'point.y >= surfaceY' in game
    assert 'const startY = terrain[playerX] - 2' in game
    assert 'TARGET RELOCATES EVERY VOLLEY' in game
    assert 'loadBattlefield(fieldIndex + 1)' in game
    assert 'createBattlefield(turnNumber, 0)' in game
    assert 'playMode === "coop" ? "2 PLAYER // BALLISTIC MATCH"' in game
