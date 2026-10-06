from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_ball_games_use_their_correct_two_control_shot_language() -> None:
    controls = read("frontend/src/features/arcade/engine/AimPowerShotControls.tsx")
    hoops = read("frontend/src/features/arcade/games/BasketballGame.tsx")
    pong = read("frontend/src/features/arcade/games/BeerPongGame.tsx")
    styles = read("frontend/src/styles/components.css")

    assert "aim-power-horizontal-track" in controls
    assert "aim-power-vertical-track" in controls
    assert "AimPowerShotControls" not in hoops
    assert "basketball-angle-track" in hoops
    assert "basketball-power-track" in hoops
    assert "LOCK ANGLE" in hoops
    assert "AimPowerShotControls" in pong
    assert "grid-template-columns: minmax(0, 1fr) 88px" in styles


def test_basketball_uses_simulated_ball_rim_and_backboard_physics() -> None:
    game = read("frontend/src/features/arcade/games/BasketballGame.tsx")

    assert "GRAVITY" in game
    assert "ball.vy += GRAVITY" in game
    assert "side-view collision against the vertical glass plane" in game
    assert "Side-view rim" in game
    assert "Basket capture" in game
    assert "Side-view basketball angle and power physics simulation" in game
    assert 'type ShotPhase = "angle" | "power" | "resolving" | "result"' in game
    assert '"release"' not in game


def test_beer_pong_is_top_down_and_scores_from_physical_cup_collision() -> None:
    game = read("frontend/src/features/arcade/games/BeerPongGame.tsx")

    assert "TOP-DOWN PHYSICS TABLE" in game
    assert "CUP_POSITIONS" in game
    assert "ball.sunkCup" in game
    assert "ball.tableBounces" in game
    assert "ball.rimHits" in game
    assert "Top-down beer pong physics table" in game
    assert "finishRef.current(ball)" in game
    assert "Six-cup rack" in game
    assert "one front cup nearest the player, then rows of two and three behind it" in game
    assert game.count("{ x:", game.index("const CUP_POSITIONS"), game.index("] as const;", game.index("const CUP_POSITIONS"))) == 6


def test_bowling_is_top_down_three_control_and_pin_collision_driven() -> None:
    game = read("frontend/src/features/arcade/games/BowlingGame.tsx")
    meters = read("frontend/src/features/arcade/engine/TimingShotMeters.tsx")

    assert "TOP-DOWN PHYSICS LANES" in game
    assert "resolvePinCollision" in game
    assert "pinsRef.current.filter((pin) => pin.knocked).length" in game
    assert "ball.spin" in game
    assert 'modifierLabel="SPIN"' in game
    assert "timing-shot-vertical-track" in meters
    assert "VERTICAL POWER" in game


def test_battleship_exposes_fleet_composition_lengths_damage_and_sink_state() -> None:
    game = read("frontend/src/features/arcade/games/BattleshipGame.tsx")

    assert "SHIP_SPECS" in game
    assert 'name: "DESTROYER", length: 3' in game
    assert 'name: "PATROL BOAT", length: 2' in game
    assert 'name: "SCOUT", length: 2' in game
    assert "battleship-fleet-manifest" in game
    assert "AFLOAT" in game
    assert "SUNK" in game
    assert "battleship-ship-segments" in game


def test_mahjong_exposes_pair_manifest_moves_accuracy_and_remaining_tiles() -> None:
    game = read("frontend/src/features/arcade/games/MahjongMatchGame.tsx")

    assert "TILE_FAMILIES" in game
    assert "PAIR MANIFEST" in game
    assert "MOVES" in game
    assert "MISSES" in game
    assert "ACCURACY" in game
    assert "TILES LEFT" in game
    assert "One tile held" in game


def test_golf_and_bowling_three_control_meters_render_power_vertically() -> None:
    meters = read("frontend/src/features/arcade/engine/TimingShotMeters.tsx")
    styles = read("frontend/src/styles/components.css")

    assert "timing-shot-vertical-track" in meters
    assert "timing-shot-vertical-target" in meters
    assert 'grid-template-areas:' in styles
    assert '"aim power"' in styles
    assert '"modifier power"' in styles


def test_reconciliation_marker_and_beer_pong_front_rack_orientation() -> None:
    beer = read("frontend/src/features/arcade/games/BeerPongGame.tsx")
    hoops = read("frontend/src/features/arcade/games/BasketballGame.tsx")

    assert "REV 38R" in beer
    assert "REV 38H" in hoops
    # Canvas origin is top-left and the shooter is near y=330, so the head/front
    # cup must have the largest y of the rack rows: 1 nearest, then 2, then 3.
    assert '{ x: 320, y: 124 }' in beer
    assert '{ x: 304, y: 94 }, { x: 336, y: 94 }' in beer
    assert '{ x: 288, y: 64 }, { x: 320, y: 64 }, { x: 352, y: 64 }' in beer
    assert "basketball-game-sideview" in hoops
    assert "ANGLE // POWER // SHOOT" in hoops
    assert "LOCK ANGLE" in hoops
