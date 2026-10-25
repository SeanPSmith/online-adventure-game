"""Guard the saved-receipt -> visible dice handoff and actionable diagnostics.

These are offline source contracts; the executable socket/clock behavior is
covered in scripts/tests/turn-flow.cjs and socket-rejoin.cjs.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def test_committed_snapshot_replays_after_rejoin_in_existing_theater():
    hook = source("frontend/src/features/adventure/useTurnTheater.ts")
    assert "game.last_turn_result" in hook
    assert "resumeEpoch, phase, countdownValue" in hook
    assert 'transition("resolution")' in hook
    assert "readAcknowledgedReceipt(roomCode, characterId)" in hook
    assert "game.turn_pending" in hook
    assert "preliminary" in hook


def test_arcade_exposes_saved_chapter_status_and_recovery_without_scrolling():
    component = source("frontend/src/features/adventure/TurnTheater.tsx")
    style = source("frontend/src/styles/quillairoTurnRecovery6636.css")
    assert 'className={`q38-turn-connection-state' in component
    assert "theater.serverProgress" in component
    assert "Check saved chapter" in component
    assert "Rejoin story" in component
    assert "The story has returned. The server's D20 results are now on screen." in component
    assert ".q38-turn-connection-state" in style
    assert "position: fixed" in style


def test_production_logs_server_commit_and_dice_visibility():
    live = source("frontend/src/state/useLiveAdventure.ts")
    hook = source("frontend/src/features/adventure/useTurnTheater.ts")
    for marker in (
        "[Quillairo Turn] game_state",
        "[Quillairo Turn] COMMITTED turn_resolved",
        "[Quillairo Turn] preliminary receipt",
        "[Quillairo Turn] no snapshot reply; rejoining room",
    ):
        assert marker in live
    assert "[Quillairo Turn] theater" in hook
    assert 'diceVisible: phase === "resolution"' in hook
