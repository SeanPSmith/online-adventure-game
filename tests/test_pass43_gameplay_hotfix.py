from pathlib import Path

from app.generation.director_schema import DirectorRecapDraft, sanitize_recap_text


def read(path: str) -> str:
    return Path(path).read_text()


def test_recap_sanitizer_removes_only_trailing_cjk_model_noise() -> None:
    clean = "Sean gets the hatch shut, but the frame buckles behind him."
    assert sanitize_recap_text(clean + " 随机字符") == clean
    assert sanitize_recap_text(clean + " 漢字。") == clean
    assert sanitize_recap_text("José pivots—Athena holds the line.") == "José pivots—Athena holds the line."

    recap = DirectorRecapDraft(
        resolution_narration=clean + " 锟斤拷",
    )
    assert recap.resolution_narration == clean


def test_pending_intermission_snapshot_restores_submitted_players_after_reload() -> None:
    backend = read("app/main.py")
    theater = read("frontend/src/features/adventure/useTurnTheater.ts")
    runtime = read("frontend/src/features/adventure/IntermissionRuntime.tsx")

    pending_start = backend.index('"pending_intermission":')
    pending_end = backend.index('"pending_micro_event":', pending_start)
    pending_block = backend[pending_start:pending_end]

    assert '"submitted_player_ids":' in pending_block
    assert 'session.intermission_scores.get(' in pending_block
    assert 'str(session.turn_number)' in pending_block
    assert 'submitted_player_ids: game.pending_intermission.submitted_player_ids ?? []' in theater
    assert 'payload.submitted_player_ids?.includes(playerId)' in runtime
    assert 'setMode("waiting")' in runtime


def test_turn_pending_reconstructs_waiting_intermission_without_socket_event() -> None:
    theater = read("frontend/src/features/adventure/useTurnTheater.ts")

    assert "if (game.pending_intermission)" in theater
    assert "if (\n      game.turn_pending" in theater
    assert 'setPhase("intermission")' in theater
