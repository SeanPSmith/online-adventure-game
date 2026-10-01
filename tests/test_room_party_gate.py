from app.game.rooms import RoomManager


def test_coop_room_waits_for_required_party():
    manager = RoomManager()

    room, _host = manager.create_room(
        sid="socket-host",
        user_id="user-host",
        character_id="hero-host",
        player_name="Host Hero",
    )

    assert room.play_mode == "coop"
    assert room.required_players == 2
    assert room.player_count == 1
    assert room.has_required_party is False

    manager.join_room(
        sid="socket-guest",
        user_id="user-guest",
        character_id="hero-guest",
        player_name="Guest Hero",
        code=room.code,
    )

    assert room.player_count == 2
    assert room.has_required_party is True


def test_explicit_solo_room_has_required_party_with_host_only():
    manager = RoomManager()

    room, host = manager.create_room(
        sid="socket-host",
        user_id="user-host",
        character_id="hero-host",
        player_name="Solo Hero",
    )

    manager.start_solo(
        room_code=room.code,
        user_id=host.user_id,
    )

    assert room.play_mode == "solo"
    assert room.player_count == 1
    assert room.has_required_party is True
