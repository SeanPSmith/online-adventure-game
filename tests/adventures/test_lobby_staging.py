"""Public-beta acceptance contracts for the initial adventure lobby."""

import pytest

from app.adventures.bootstrap import register_builtin_adventures
from app.adventures.content.first_light import FIRST_LIGHT
from app.game.session import GameSessionManager
from tests.support import PROJECT_ROOT


def test_approved_opening_is_prepared_before_first_choice() -> None:
    """The initial chapter is supplied by the authored seed; no Director call."""
    register_builtin_adventures()
    session = GameSessionManager().create("STAGING1", adventure_id=FIRST_LIGHT.id)

    assert not session.started
    assert session.scene.body.strip()
    assert len(session.scene.choices) >= 2
    assert session.director_usage["requests"] == 0
    assert session.pending_turn_facts is None


def test_server_enforces_opening_scene_readiness(monkeypatch) -> None:
    pytest.importorskip("socketio", reason="Live socket server dependencies are needed for the start-gate integration check")
    from app import main
    from app.game.rooms import RoomManager

    register_builtin_adventures()
    rooms = RoomManager()
    room, host = rooms.create_room(
        sid="lobby-socket", user_id="lobby-user", character_id="lobby-hero", player_name="Hero",
    )
    rooms.start_solo(room_code=room.code, user_id=host.user_id)
    session = GameSessionManager().create(room.code, adventure_id=FIRST_LIGHT.id)

    assert main.opening_scene_ready(session)
    assert main.room_can_begin_adventure(room, session)

    # An incomplete opening must not enable Get Started or allow start_adventure.
    monkeypatch.setattr(main, "opening_scene_ready", lambda _session: False)
    assert not main.room_can_begin_adventure(room, session)

    session.started = True
    assert not main.room_can_begin_adventure(room, session)


def test_turn_theater_never_treats_lobby_presence_as_locked_choices() -> None:
    source = (PROJECT_ROOT / "frontend/src/features/adventure/useTurnTheater.ts").read_text()
    assert "if (!game?.started || !lockCountdown) return;" in source
    assert "if (!game?.started || !storyAdvancing" in source
    assert "if (!game?.started) return;" in source
    assert "if (!game?.started || !turnReceipt" in source


def test_lobby_displays_synopsis_and_only_enables_playable_openings() -> None:
    page = (PROJECT_ROOT / "frontend/src/pages/game/AdventurePage.tsx").read_text()
    server = (PROJECT_ROOT / "app/main.py").read_text()
    assert '"adventure_synopsis":' in server
    assert '"opening_ready":' in server
    assert "live.game?.adventure_synopsis" in page
    assert "!canBeginAdventure" in page
    assert "live.startAdventure" in page


def test_player_error_copy_keeps_recovery_actionable_without_exposing_details() -> None:
    route = (PROJECT_ROOT / "frontend/src/pages/RouteErrorPage.tsx").read_text()
    missing = (PROJECT_ROOT / "frontend/src/pages/NotFoundPage.tsx").read_text()
    assert "THE INK HAS GONE ASTRAY" in route
    assert "TRY THIS PAGE AGAIN" in route
    assert "RETURN TO ADVENTURE HALL" in route
    assert "THE MAP" in missing
    assert "error.message}" not in route
