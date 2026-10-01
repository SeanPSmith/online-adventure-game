from pathlib import Path


FRONTEND = Path("frontend/src")


def read(relative: str) -> str:
    return (FRONTEND / relative).read_text()


def test_adventure_synopsis_uses_generated_player_synopsis() -> None:
    source = read("pages/game/GameHomePage.tsx")

    assert "metadata?.player_synopsis" in source
    assert "generatedSynopsis(pendingAdventure)" in source
    assert "AI-GENERATED PLAYER SYNOPSIS" in source


def test_adventure_page_exposes_retry_without_reroll_ui() -> None:
    page = read("pages/game/AdventurePage.tsx")
    live = read("state/useLiveAdventure.ts")

    assert "director_retry_required" in page
    assert "live.retryPendingTurn()" in page
    assert 'emit("retry_pending_turn"' in live


def test_return_to_game_uses_last_game_route_memory() -> None:
    adventure = read("pages/game/AdventurePage.tsx")
    account = read("layouts/AccountLayout.tsx")
    memory = read("services/gameRouteMemory.ts")

    assert "rememberGameRoute(`${location.pathname}${location.search}`)" in adventure
    assert "readLastGameRoute()" in account
    assert "tot:last-game-route" in memory
    assert 'clean.startsWith("/game")' in memory


def test_ascii_picker_is_interactive_and_inserts_chat_text() -> None:
    page = read("pages/game/AdventurePage.tsx")

    assert "setAsciiPickerOpen((current) => !current)" in page
    assert "function insertAsciiFace(face: string)" in page
    assert "onClick={() => insertAsciiFace(face)}" in page


def test_director_retry_failure_stays_in_turn_theater_modal() -> None:
    page = read("pages/game/AdventurePage.tsx")
    theater = read("features/adventure/useTurnTheater.ts")

    assert "error: live.error" in page
    assert "!live.game?.director_retry_required" in page
    assert "director-retry-panel" not in page
    assert "game?.director_retry_required ? error" in theater


def test_retry_pending_turn_reuses_frozen_snapshot_without_readiness_recheck() -> None:
    backend = Path("app/main.py").read_text()
    start = backend.index("async def retry_pending_turn")
    end = backend.index("# =========================================================\n# INTERMISSION SCORE", start)
    retry_handler = backend[start:end]

    assert "session.pending_turn_facts" in retry_handler
    assert "resolve_turn(" in retry_handler
    assert "all_players_ready(" not in retry_handler
    assert "The locked turn is incomplete and cannot be retried yet." not in retry_handler


def test_legacy_underfilled_started_room_recovery_is_wired_into_resume_and_choice_flow() -> None:
    backend = Path("app/main.py").read_text()

    resume_start = backend.index("async def resume_adventure")
    resume_end = backend.index("# =========================================================\n# LEAVE ADVENTURE", resume_start)
    resume_handler = backend[resume_start:resume_end]

    choice_start = backend.index("async def submit_choice")
    choice_end = backend.index("# =========================================================\n# QUICK MICRO-EVENT RESPONSE", choice_start)
    choice_handler = backend[choice_start:choice_end]

    assert "recover_legacy_single_player_session(" in resume_handler
    assert "recover_legacy_single_player_session(" in choice_handler
    assert "if not room.has_required_party:" in choice_handler
    assert choice_handler.index("recover_legacy_single_player_session(") < choice_handler.index("if not room.has_required_party:")
