from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "src"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_continuous_arcade_games_use_compact_feedback() -> None:
    for relative in (
        "features/arcade/games/RoadRacerGame.tsx",
        "features/arcade/games/BrickBreakerGame.tsx",
        "features/arcade/games/SnakeGame.tsx",
        "features/arcade/games/LightCyclesGame.tsx",
    ):
        assert 'mode="compact"' in read(relative)

    assert 'mode="compact"' not in read("features/arcade/games/GolfGame.tsx")
    assert 'mode="compact"' not in read("features/arcade/games/BowlingGame.tsx")

    feedback = read("features/arcade/engine/ArcadeFeedback.tsx")
    styles = read("styles/components.css")
    assert 'ArcadeFeedbackMode = "overlay" | "compact"' in feedback
    assert ".arcade-feedback.is-compact" in styles


def test_highway_84_rewards_risk_and_scales_difficulty() -> None:
    road = read("features/arcade/games/RoadRacerGame.tsx")

    assert "runSeconds" in road
    assert "difficulty = clamp(game.runSeconds / 42" in road
    assert "variant.acceleration" in road
    assert "THREAD THE NEEDLE" in road
    assert "CLOSE CALL" in road
    assert "RISKY PASS" in road
    assert "closestClearance" in road
    assert "HEAT" in road
    assert "NEEDLE +10" in road


def test_round_based_games_leave_room_to_read_results() -> None:
    outlier = read("features/adventure/FindOutlierGame.tsx")
    words = read("features/adventure/WordPuzzleGame.tsx")
    maze = read("features/adventure/MazeGame.tsx")
    golf = read("features/arcade/games/GolfGame.tsx")
    bowling = read("features/arcade/games/BowlingGame.tsx")
    artillery = read("features/adventure/ProjectileDuelGame.tsx")

    assert "1850" in outlier
    assert "2200" in words
    assert "2500" in words
    assert "1900" in maze
    assert "roundComplete" in maze
    assert "2850" in golf
    assert "2950" in bowling
    assert "1750" in artillery
    assert "1800" in artillery
