from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_pixel_hoops_varies_player_and_hoop_geometry_per_shot() -> None:
    game = read("frontend/src/features/arcade/games/BasketballGame.tsx")

    assert "courtGeometryForShot" in game
    assert "turnNumber" in game
    assert "shotNumber" in game
    assert "shooterX" in game
    assert "frontRimX" in game
    assert "rimY" in game
    assert "DEEP TWO" in game
    assert "MIDRANGE" in game
    assert "SHORT TWO" in game
    assert "NEW PLAYER + HOOP POSITION EACH SHOT" in game
    assert "REV 38I" in game


def test_beer_pong_projects_world_physics_into_isometric_depth_view() -> None:
    game = read("frontend/src/features/arcade/games/BeerPongGame.tsx")

    assert "ISOMETRIC PHYSICS TABLE" in game
    assert "projectTablePoint" in game
    assert "predictedTrajectory" in game
    assert "Perspective guide lines" in game
    assert "Shadow stays on the table" in game
    assert "ARC + SHADOW SHOW DEPTH" in game
    assert "REV 38I" in game


def test_beer_pong_keeps_one_two_three_rack_world_orientation() -> None:
    game = read("frontend/src/features/arcade/games/BeerPongGame.tsx")

    # World y grows toward the shooter (launch y=330), so the head cup at y=124
    # is nearest, the two-cup row at y=94 is behind it, and y=64 is deepest.
    assert '{ x: 320, y: 124 }' in game
    assert '{ x: 304, y: 94 }, { x: 336, y: 94 }' in game
    assert '{ x: 288, y: 64 }, { x: 320, y: 64 }, { x: 352, y: 64 }' in game
    assert "Cups draw far-to-near" in game
