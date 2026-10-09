import unittest

from app.game.rooms import (
    RoomManager,
)


class RoomManagerTests(
    unittest.TestCase,
):

    def setUp(
        self,
    ) -> None:

        self.rooms = (
            RoomManager()
        )


    def test_same_account_can_own_multiple_adventures(
        self,
    ) -> None:

        room_a, player_a = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        room_b, player_b = (
            self.rooms.create_room(

                sid=
                    "socket-b",

                user_id=
                    "user-1",

                character_id=
                    "character-b",

                player_name=
                    "Wizard",
            )
        )


        adventures = (
            self.rooms.adventures_for_user(
                "user-1"
            )
        )


        self.assertEqual(
            len(
                adventures
            ),
            2,
        )


        self.assertNotEqual(
            room_a.code,
            room_b.code,
        )


        self.assertNotEqual(
            player_a.character_id,
            player_b.character_id,
        )


    def test_character_cannot_join_two_adventures(
        self,
    ) -> None:

        self.rooms.create_room(

            sid=
                "socket-a",

            user_id=
                "user-1",

            character_id=
                "character-a",

            player_name=
                "Grognak",
        )


        with self.assertRaises(
            ValueError
        ):

            self.rooms.create_room(

                sid=
                    "socket-b",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )


    def test_same_account_cannot_control_two_characters_in_same_room(
        self,
    ) -> None:

        room, host = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        with self.assertRaises(
            ValueError
        ):

            self.rooms.join_room(

                sid=
                    "socket-b",

                user_id=
                    "user-1",

                character_id=
                    "character-b",

                player_name=
                    "Wizard",

                code=
                    room.code,
            )


    def test_different_account_can_join_room(
        self,
    ) -> None:

        room, host = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        room_again, guest = (
            self.rooms.join_room(

                sid=
                    "socket-b",

                user_id=
                    "user-2",

                character_id=
                    "character-b",

                player_name=
                    "Athena",

                code=
                    room.code,
            )
        )


        self.assertIs(
            room,
            room_again,
        )


        self.assertEqual(
            room.player_count,
            2,
        )


        self.assertTrue(
            host.is_host
        )


        self.assertFalse(
            guest.is_host
        )


    def test_detach_socket_preserves_membership(
        self,
    ) -> None:

        room, player = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        detached_room, detached_player = (
            self.rooms.detach_socket(
                "socket-a"
            )
        )


        self.assertIs(
            detached_room,
            room,
        )


        self.assertIs(
            detached_player,
            player,
        )


        self.assertFalse(
            player.is_online
        )


        self.assertIsNone(
            player.sid
        )


        self.assertIs(
            self.rooms.player_for_character(
                "character-a"
            ),
            player,
        )


        adventures = (
            self.rooms.adventures_for_user(
                "user-1"
            )
        )


        self.assertEqual(
            len(
                adventures
            ),
            1,
        )


    def test_detached_character_can_resume(
        self,
    ) -> None:

        room, original_player = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        self.rooms.detach_socket(
            "socket-a"
        )


        resumed_room, resumed_player = (
            self.rooms.resume_adventure(

                sid=
                    "socket-b",

                user_id=
                    "user-1",

                room_code=
                    room.code,

                character_id=
                    "character-a",
            )
        )


        self.assertIs(
            resumed_room,
            room,
        )


        self.assertIs(
            resumed_player,
            original_player,
        )


        self.assertTrue(
            resumed_player.is_online
        )


        self.assertEqual(
            resumed_player.sid,
            "socket-b",
        )


    def test_resume_rejects_wrong_account(
        self,
    ) -> None:

        room, player = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        self.rooms.detach_socket(
            "socket-a"
        )


        with self.assertRaises(
            ValueError
        ):

            self.rooms.resume_adventure(

                sid=
                    "socket-b",

                user_id=
                    "evil-user",

                room_code=
                    room.code,

                character_id=
                    "character-a",
            )


    def test_host_transfers_when_host_leaves(
        self,
    ) -> None:

        room, host = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        room, guest = (
            self.rooms.join_room(

                sid=
                    "socket-b",

                user_id=
                    "user-2",

                character_id=
                    "character-b",

                player_name=
                    "Athena",

                code=
                    room.code,
            )
        )


        room_after, removed, empty = (
            self.rooms.remove_character_from_room(

                room_code=
                    room.code,

                user_id=
                    "user-1",

                character_id=
                    "character-a",
            )
        )


        self.assertFalse(
            empty
        )


        self.assertEqual(
            removed.character_id,
            "character-a",
        )


        self.assertTrue(
            guest.is_host
        )


        self.assertEqual(
            room_after.player_count,
            1,
        )


    def test_last_player_leaving_removes_room(
        self,
    ) -> None:

        room, player = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        room_code = (
            room.code
        )


        room_after, removed, empty = (
            self.rooms.remove_character_from_room(

                room_code=
                    room_code,

                user_id=
                    "user-1",

                character_id=
                    "character-a",
            )
        )


        self.assertTrue(
            empty
        )


        self.assertIsNone(
            self.rooms.room_by_code(
                room_code
            )
        )


        self.assertIsNone(
            self.rooms.player_for_character(
                "character-a"
            )
        )


        self.assertEqual(
            self.rooms.adventures_for_user(
                "user-1"
            ),
            [],
        )


    def test_remove_room_clears_all_indexes(
        self,
    ) -> None:

        room, host = (
            self.rooms.create_room(

                sid=
                    "socket-a",

                user_id=
                    "user-1",

                character_id=
                    "character-a",

                player_name=
                    "Grognak",
            )
        )


        room, guest = (
            self.rooms.join_room(

                sid=
                    "socket-b",

                user_id=
                    "user-2",

                character_id=
                    "character-b",

                player_name=
                    "Athena",

                code=
                    room.code,
            )
        )


        self.rooms.remove_room(
            room.code
        )


        self.assertIsNone(
            self.rooms.player_for_socket(
                "socket-a"
            )
        )


        self.assertIsNone(
            self.rooms.player_for_socket(
                "socket-b"
            )
        )


        self.assertIsNone(
            self.rooms.player_for_character(
                "character-a"
            )
        )


        self.assertIsNone(
            self.rooms.player_for_character(
                "character-b"
            )
        )


        self.assertEqual(
            self.rooms.adventures_for_user(
                "user-1"
            ),
            [],
        )


        self.assertEqual(
            self.rooms.adventures_for_user(
                "user-2"
            ),
            [],
        )


if __name__ == "__main__":

    unittest.main()

class SoloRoomModeTests(
    unittest.TestCase,
):

    def test_start_solo_locks_room_to_one_hero(
        self,
    ) -> None:

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

        self.assertTrue(room.is_solo)
        self.assertEqual(room.play_mode, "solo")
        self.assertEqual(room.max_players, 1)
        self.assertEqual(room.required_players, 1)
        self.assertTrue(room.is_full)
        self.assertEqual(
            room.public_data()["play_mode"],
            "solo",
        )

        with self.assertRaises(ValueError):
            manager.join_room(
                sid="socket-guest",
                user_id="user-guest",
                character_id="hero-guest",
                player_name="Guest Hero",
                code=room.code,
            )

    def test_restore_preserves_solo_mode(
        self,
    ) -> None:

        manager = RoomManager()

        room = manager.restore_room(
            code="SOLO01",
            play_mode="solo",
            player_data=[
                {
                    "player_id": "player-1",
                    "user_id": "user-1",
                    "character_id": "hero-1",
                    "name": "Hero",
                    "is_host": True,
                }
            ],
        )

        self.assertTrue(room.is_solo)
        self.assertEqual(room.max_players, 1)
