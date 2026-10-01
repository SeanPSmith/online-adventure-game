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
