from __future__ import annotations

import secrets

from dataclasses import (
    dataclass,
    field,
)

from uuid import uuid4


ROOM_CODE_LENGTH = 6

ROOM_CODE_ALPHABET = (
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
)

MAX_PLAYERS_PER_ROOM = 2

PLAY_MODE_COOP = "coop"
PLAY_MODE_SOLO = "solo"

VALID_PLAY_MODES = {
    PLAY_MODE_COOP,
    PLAY_MODE_SOLO,
}


# =========================================================
# PLAYER
# =========================================================

@dataclass
class Player:

    player_id: str

    user_id: str

    character_id: str

    name: str

    sid: str | None = None

    is_host: bool = False

    is_online: bool = True


    def public_data(
        self,
    ) -> dict:

        return {
            "player_id":
                self.player_id,

            "user_id":
                self.user_id,

            "character_id":
                self.character_id,

            "name":
                self.name,

            "is_host":
                self.is_host,

            "is_online":
                self.is_online,
        }


# =========================================================
# ROOM
# =========================================================

@dataclass
class GameRoom:

    code: str

    play_mode: str = PLAY_MODE_COOP

    players: dict[
        str,
        Player,
    ] = field(
        default_factory=dict
    )


    @property
    def player_count(
        self,
    ) -> int:

        return len(
            self.players
        )


    @property
    def online_count(
        self,
    ) -> int:

        return sum(
            1

            for player
            in self.players.values()

            if player.is_online
        )


    @property
    def max_players(
        self,
    ) -> int:

        return (
            1
            if self.play_mode == PLAY_MODE_SOLO
            else MAX_PLAYERS_PER_ROOM
        )


    @property
    def required_players(
        self,
    ) -> int:

        return self.max_players


    @property
    def is_solo(
        self,
    ) -> bool:

        return (
            self.play_mode
            == PLAY_MODE_SOLO
        )


    @property
    def is_full(
        self,
    ) -> bool:

        return (
            self.player_count
            >= self.max_players
        )


    @property
    def has_required_party(
        self,
    ) -> bool:

        return (
            self.player_count
            >= self.required_players
        )


    def player_for_user(
        self,
        user_id: str,
    ) -> Player | None:

        for player in (
            self.players.values()
        ):

            if (
                player.user_id
                == user_id
            ):

                return player


        return None


    def player_for_character(
        self,
        character_id: str,
    ) -> Player | None:

        for player in (
            self.players.values()
        ):

            if (
                player.character_id
                == character_id
            ):

                return player


        return None


    def public_data(
        self,
    ) -> dict:

        return {
            "code":
                self.code,

            "player_count":
                self.player_count,

            "online_count":
                self.online_count,

            "max_players":
                self.max_players,

            "required_players":
                self.required_players,

            "play_mode":
                self.play_mode,

            "players": [
                player.public_data()

                for player
                in self.players.values()
            ],
        }


def recover_legacy_single_player_session(
    room: GameRoom,
    session,
) -> bool:

    """
    Repair adventures created before the co-op party gate was enforced.

    Older builds could start a room marked ``coop`` with only the host. Once
    such a room had already resolved (or frozen) a turn, newer party-gate
    logic would correctly refuse to advance the next turn forever because
    the room still advertised that it required two players.

    A one-player co-op room that has *never* advanced is still a normal lobby
    waiting for a guest and must not be converted.  We only migrate a durable
    session that proves gameplay already started under the old behavior.
    """

    if (
        room is None
        or session is None
        or room.play_mode != PLAY_MODE_COOP
        or room.player_count != 1
        or bool(getattr(session, "completed", False))
    ):
        return False

    only_player = next(iter(room.players.values()), None)
    if only_player is None or not only_player.is_host:
        return False

    gameplay_already_started = bool(
        int(getattr(session, "turn_number", 1) or 1) > 1
        or str(getattr(session, "last_resolution", "") or "").strip()
        or getattr(session, "pending_turn_facts", None) is not None
    )

    if not gameplay_already_started:
        return False

    room.play_mode = PLAY_MODE_SOLO
    return True


# =========================================================
# ROOM MANAGER
# =========================================================

class RoomManager:

    def __init__(
        self,
    ) -> None:

        self._rooms: dict[
            str,
            GameRoom,
        ] = {}


        # player_id -> room_code

        self._player_rooms: dict[
            str,
            str,
        ] = {}


        # character_id -> player_id
        #
        # A persistent character may belong to only
        # one active adventure at a time.

        self._character_players: dict[
            str,
            str,
        ] = {}


        # user_id -> set[player_id]
        #
        # One account can own many characters and
        # therefore belong to many adventures.

        self._user_players: dict[
            str,
            set[str],
        ] = {}


        # socket_id -> player_id
        #
        # One socket actively views one adventure.

        self._socket_players: dict[
            str,
            str,
        ] = {}


    # =====================================================
    # IDS
    # =====================================================

    @staticmethod
    def create_player_id(
    ) -> str:

        return str(
            uuid4()
        )


    def _generate_room_code(
        self,
    ) -> str:

        while True:

            code = "".join(
                secrets.choice(
                    ROOM_CODE_ALPHABET
                )

                for _
                in range(
                    ROOM_CODE_LENGTH
                )
            )


            if (
                code
                not in self._rooms
            ):

                return code


    # =====================================================
    # INTERNAL INDEXING
    # =====================================================

    def _index_player(
        self,
        room: GameRoom,
        player: Player,
    ) -> None:

        self._player_rooms[
            player.player_id
        ] = room.code


        self._character_players[
            player.character_id
        ] = player.player_id


        self._user_players.setdefault(
            player.user_id,
            set(),
        ).add(
            player.player_id
        )


    def _unindex_player(
        self,
        player: Player,
    ) -> None:

        self._player_rooms.pop(
            player.player_id,
            None,
        )


        self._character_players.pop(
            player.character_id,
            None,
        )


        user_players = (
            self._user_players.get(
                player.user_id
            )
        )


        if (
            user_players is not None
        ):

            user_players.discard(
                player.player_id
            )


            if (
                not user_players
            ):

                self._user_players.pop(
                    player.user_id,
                    None,
                )


    # =====================================================
    # SOCKET BINDING
    # =====================================================

    def _unbind_socket(
        self,
        sid: str,
    ) -> tuple[
        GameRoom | None,
        Player | None,
    ]:

        player_id = (
            self._socket_players.pop(
                sid,
                None,
            )
        )


        if (
            player_id is None
        ):

            return (
                None,
                None,
            )


        room = (
            self.room_for_player_id(
                player_id
            )
        )


        if (
            room is None
        ):

            return (
                None,
                None,
            )


        player = (
            room.players.get(
                player_id
            )
        )


        if (
            player is None
        ):

            return (
                room,
                None,
            )


        # Protect against a stale socket disconnecting
        # after the character has already reconnected
        # from another socket.

        if (
            player.sid
            == sid
        ):

            player.sid = None

            player.is_online = False


        return (
            room,
            player,
        )


    def _bind_socket(
        self,
        sid: str,
        player: Player,
    ) -> None:

        # A browser socket may only actively view
        # one adventure.

        self._unbind_socket(
            sid
        )


        # A character may only have one controlling
        # socket at a time.

        if (
            player.sid
            and player.sid != sid
        ):

            self._socket_players.pop(
                player.sid,
                None,
            )


        player.sid = sid

        player.is_online = True


        self._socket_players[
            sid
        ] = player.player_id


    def detach_socket(
        self,
        sid: str,
    ) -> tuple[
        GameRoom | None,
        Player | None,
    ]:

        """
        Stop actively viewing an adventure without
        removing persistent adventure membership.
        """

        return self._unbind_socket(
            sid
        )


    # =====================================================
    # CREATE ROOM
    # =====================================================

    def create_room(
        self,
        sid: str,
        user_id: str,
        character_id: str,
        player_name: str,
    ) -> tuple[
        GameRoom,
        Player,
    ]:

        existing_player = (
            self.player_for_character(
                character_id
            )
        )


        if (
            existing_player is not None
        ):

            existing_room = (
                self.room_for_player_id(
                    existing_player.player_id
                )
            )


            if (
                existing_room is not None
            ):

                raise ValueError(
                    "That character is already "
                    "in an active adventure."
                )


        room = GameRoom(
            code=
                self._generate_room_code()
        )


        player = Player(

            player_id=
                self.create_player_id(),

            user_id=
                user_id,

            character_id=
                character_id,

            name=
                player_name,

            sid=
                sid,

            is_host=
                True,

            is_online=
                True,
        )


        room.players[
            player.player_id
        ] = player


        self._rooms[
            room.code
        ] = room


        self._index_player(
            room,
            player,
        )


        self._bind_socket(
            sid,
            player,
        )


        return (
            room,
            player,
        )


    # =====================================================
    # JOIN ROOM
    # =====================================================

    def join_room(
        self,
        sid: str,
        user_id: str,
        character_id: str,
        player_name: str,
        code: str,
    ) -> tuple[
        GameRoom,
        Player,
    ]:

        normalized_code = (
            code
            .strip()
            .upper()
        )


        room = (
            self._rooms.get(
                normalized_code
            )
        )


        if (
            room is None
        ):

            raise ValueError(
                "Room does not exist."
            )


        existing_in_room = (
            room.player_for_character(
                character_id
            )
        )


        if (
            existing_in_room is not None
        ):

            if (
                existing_in_room.user_id
                != user_id
            ):

                raise ValueError(
                    "That character does not "
                    "belong to this account."
                )


            self._bind_socket(
                sid,
                existing_in_room,
            )


            return (
                room,
                existing_in_room,
            )


        existing_player = (
            self.player_for_character(
                character_id
            )
        )


        if (
            existing_player is not None
        ):

            existing_room = (
                self.room_for_player_id(
                    existing_player.player_id
                )
            )


            if (
                existing_room is not None
            ):

                raise ValueError(
                    "That character is already "
                    "in another active adventure."
                )


        # One human account controlling multiple
        # characters simultaneously inside the SAME
        # adventure is intentionally disallowed.

        if (
            room.player_for_user(
                user_id
            )
            is not None
        ):

            raise ValueError(
                "This account already has a "
                "character in that adventure."
            )


        if (
            room.is_solo
        ):

            raise ValueError(
                "This adventure has started in solo mode."
            )


        if (
            room.is_full
        ):

            raise ValueError(
                "Room is full."
            )


        player = Player(

            player_id=
                self.create_player_id(),

            user_id=
                user_id,

            character_id=
                character_id,

            name=
                player_name,

            sid=
                sid,

            is_host=
                False,

            is_online=
                True,
        )


        room.players[
            player.player_id
        ] = player


        self._index_player(
            room,
            player,
        )


        self._bind_socket(
            sid,
            player,
        )


        return (
            room,
            player,
        )


    # =====================================================
    # START SOLO
    # =====================================================

    def start_solo(
        self,
        *,
        room_code: str,
        user_id: str,
    ) -> GameRoom:

        room = (
            self.room_by_code(
                room_code
            )
        )


        if room is None:

            raise ValueError(
                "Adventure does not exist."
            )


        host = next(
            (
                player
                for player
                in room.players.values()
                if player.is_host
            ),
            None,
        )


        if (
            host is None
            or host.user_id != user_id
        ):

            raise ValueError(
                "Only the host can start solo mode."
            )


        if room.is_solo:

            return room


        if room.player_count != 1:

            raise ValueError(
                "Solo mode can only start before another Hero joins."
            )


        room.play_mode = (
            PLAY_MODE_SOLO
        )


        return room


    # =====================================================
    # RESUME SPECIFIC ADVENTURE
    # =====================================================

    def resume_adventure(
        self,
        sid: str,
        user_id: str,
        room_code: str,
        character_id: str,
    ) -> tuple[
        GameRoom,
        Player,
    ]:

        room = (
            self.room_by_code(
                room_code
            )
        )


        if (
            room is None
        ):

            raise ValueError(
                "Adventure does not exist."
            )


        player = (
            room.player_for_character(
                character_id
            )
        )


        if (
            player is None
        ):

            raise ValueError(
                "That character is not a member "
                "of this adventure."
            )


        if (
            player.user_id
            != user_id
        ):

            raise ValueError(
                "Adventure membership does not "
                "belong to this account."
            )


        self._bind_socket(
            sid,
            player,
        )


        return (
            room,
            player,
        )


    # =====================================================
    # ADVENTURES FOR ACCOUNT
    # =====================================================

    def adventures_for_user(
        self,
        user_id: str,
    ) -> list[
        tuple[
            GameRoom,
            Player,
        ]
    ]:

        results = []


        for player_id in (
            self._user_players.get(
                user_id,
                set(),
            )
        ):

            room = (
                self.room_for_player_id(
                    player_id
                )
            )


            if (
                room is None
            ):

                continue


            player = (
                room.players.get(
                    player_id
                )
            )


            if (
                player is None
            ):

                continue


            results.append(
                (
                    room,
                    player,
                )
            )


        results.sort(
            key=lambda item:
                item[0].code
        )


        return results


    # =====================================================
    # REMOVE MEMBERSHIP
    # =====================================================

    def remove_character_from_room(
        self,
        *,
        room_code: str,
        user_id: str,
        character_id: str,
    ) -> tuple[
        GameRoom | None,
        Player | None,
        bool,
    ]:

        room = (
            self.room_by_code(
                room_code
            )
        )


        if (
            room is None
        ):

            return (
                None,
                None,
                False,
            )


        player = (
            room.player_for_character(
                character_id
            )
        )


        if (
            player is None
            or player.user_id
            != user_id
        ):

            return (
                room,
                None,
                False,
            )


        was_host = (
            player.is_host
        )


        if (
            player.sid
        ):

            self._socket_players.pop(
                player.sid,
                None,
            )


        self._unindex_player(
            player
        )


        room.players.pop(
            player.player_id,
            None,
        )


        player.sid = None

        player.is_online = False


        room_is_empty = (
            room.player_count
            == 0
        )


        if (
            room_is_empty
        ):

            self._rooms.pop(
                room.code,
                None,
            )


            return (
                room,
                player,
                True,
            )


        if (
            was_host
        ):

            new_host = next(
                iter(
                    room.players.values()
                )
            )


            for remaining_player in (
                room.players.values()
            ):

                remaining_player.is_host = (
                    remaining_player.player_id
                    == new_host.player_id
                )


        return (
            room,
            player,
            False,
        )


    # =====================================================
    # REMOVE ROOM
    # =====================================================

    def remove_room(
        self,
        room_code: str,
    ) -> GameRoom | None:

        normalized_code = (
            room_code
            .strip()
            .upper()
        )


        room = (
            self._rooms.pop(
                normalized_code,
                None,
            )
        )


        if (
            room is None
        ):

            return None


        for player in list(
            room.players.values()
        ):

            if (
                player.sid
            ):

                self._socket_players.pop(
                    player.sid,
                    None,
                )


            self._unindex_player(
                player
            )


            player.sid = None

            player.is_online = False


        return room


    # =====================================================
    # DISCONNECT
    # =====================================================

    def mark_disconnected(
        self,
        sid: str,
    ) -> tuple[
        GameRoom | None,
        Player | None,
    ]:

        return self._unbind_socket(
            sid
        )


    # =====================================================
    # RESTORE
    # =====================================================

    def clear(
        self,
    ) -> None:

        self._rooms.clear()

        self._player_rooms.clear()

        self._character_players.clear()

        self._user_players.clear()

        self._socket_players.clear()


    def restore_room(
        self,
        code: str,
        player_data: list[
            dict
        ],
        play_mode: str = PLAY_MODE_COOP,
    ) -> GameRoom:

        normalized_code = (
            code
            .strip()
            .upper()
        )


        normalized_play_mode = (
            str(
                play_mode
                or PLAY_MODE_COOP
            )
            .strip()
            .lower()
        )


        if (
            normalized_play_mode
            not in VALID_PLAY_MODES
        ):

            normalized_play_mode = (
                PLAY_MODE_COOP
            )


        room = GameRoom(
            code=
                normalized_code,

            play_mode=
                normalized_play_mode,
        )


        for data in (
            player_data
        ):

            player_id = str(
                data.get(
                    "player_id",
                    "",
                )
                or ""
            ).strip()


            user_id = str(
                data.get(
                    "user_id",
                    "",
                )
                or ""
            ).strip()


            character_id = str(
                data.get(
                    "character_id",
                    "",
                )
                or ""
            ).strip()


            if (
                not player_id
                or not user_id
                or not character_id
            ):

                continue


            # Defensive protection against legacy
            # duplicate membership data.

            if (
                character_id
                in self._character_players
            ):

                continue


            player = Player(

                player_id=
                    player_id,

                user_id=
                    user_id,

                character_id=
                    character_id,

                name=
                    str(
                        data.get(
                            "name",
                            "Unknown",
                        )
                    ),

                sid=
                    None,

                is_host=
                    bool(
                        data.get(
                            "is_host",
                            False,
                        )
                    ),

                is_online=
                    False,
            )


            room.players[
                player.player_id
            ] = player


            self._index_player(
                room,
                player,
            )


        self._rooms[
            normalized_code
        ] = room


        return room


    # =====================================================
    # LOOKUPS
    # =====================================================

    def all_rooms(
        self,
    ) -> tuple[GameRoom, ...]:

        return tuple(
            self._rooms.values()
        )


    def room_by_code(
        self,
        code: str,
    ) -> GameRoom | None:

        return self._rooms.get(
            code
            .strip()
            .upper()
        )


    def player_for_character(
        self,
        character_id: str,
    ) -> Player | None:

        player_id = (
            self._character_players.get(
                character_id
            )
        )


        if (
            player_id is None
        ):

            return None


        room = (
            self.room_for_player_id(
                player_id
            )
        )


        if (
            room is None
        ):

            return None


        return (
            room.players.get(
                player_id
            )
        )


    def room_for_character(
        self,
        character_id: str,
    ) -> GameRoom | None:

        player = (
            self.player_for_character(
                character_id
            )
        )


        if (
            player is None
        ):

            return None


        return (
            self.room_for_player_id(
                player.player_id
            )
        )


    def room_for_player_id(
        self,
        player_id: str,
    ) -> GameRoom | None:

        room_code = (
            self._player_rooms.get(
                player_id
            )
        )


        if (
            room_code is None
        ):

            return None


        return (
            self._rooms.get(
                room_code
            )
        )


    def player_for_socket(
        self,
        sid: str,
    ) -> Player | None:

        player_id = (
            self._socket_players.get(
                sid
            )
        )


        if (
            player_id is None
        ):

            return None


        room = (
            self.room_for_player_id(
                player_id
            )
        )


        if (
            room is None
        ):

            return None


        return (
            room.players.get(
                player_id
            )
        )


    def room_for_socket(
        self,
        sid: str,
    ) -> GameRoom | None:

        player = (
            self.player_for_socket(
                sid
            )
        )


        if (
            player is None
        ):

            return None


        return (
            self.room_for_player_id(
                player.player_id
            )
        )


rooms = RoomManager()