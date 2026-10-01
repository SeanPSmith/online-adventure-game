from app.game.rooms import rooms
from app.game.session import game_sessions
from app.networking.chat import chat
from app.persistence.store import store


async def restore_runtime_state() -> int:
    """
    Rebuild the in-memory runtime caches from persisted
    SQLite snapshots.

    Returns the number of restored rooms.
    """

    rooms.clear()
    game_sessions.clear()
    chat.clear()

    snapshots = (
        await store.load_room_snapshots()
    )

    restored_count = 0

    for snapshot in snapshots:

        room_data = snapshot.get(
            "room",
            {},
        )

        game_data = snapshot.get(
            "game",
            {},
        )

        room_code = str(
            room_data.get(
                "code",
                "",
            )
        ).strip().upper()

        if not room_code:
            continue

        rooms.restore_room(
            code=room_code,

            player_data=room_data.get(
                "players",
                [],
            ),

            play_mode=room_data.get(
                "play_mode",
                "coop",
            ),
        )

        game_sessions.restore_session(
            room_code=room_code,
            data=game_data,
        )

        chat_messages = (
            await store.load_chat_history(
                room_code
            )
        )

        chat.restore_room(
            room_code,
            chat_messages,
        )

        restored_count += 1

    return restored_count