import unittest

from types import SimpleNamespace

from app.adventures.content import (
    OLD_CHAPEL,
    WINDROAD_LANTERN,
)

from app.adventures.models import (
    AdventureDefinition,
    ChoiceDefinition,
    FlagCondition,
    FlagEffect,
    SceneDefinition,
)

from app.adventures.registry import (
    AdventureRegistry,
)

from app.characters.models import (
    Skill,
    Stat,
)


from app.game.session import (
    DEFAULT_ADVENTURE_ID,
    GameSessionManager,
)

# =========================================================
# ADVENTURE MODEL TESTS
# =========================================================

class AdventureModelTests(
    unittest.TestCase,
):

    def test_old_chapel_validates(
        self,
    ) -> None:

        OLD_CHAPEL.validate()


    def test_starting_scene_exists(
        self,
    ) -> None:

        scene = (
            OLD_CHAPEL.scene(
                OLD_CHAPEL.starting_scene_id
            )
        )


        self.assertEqual(
            scene.id,
            "chapel_road",
        )


    def test_old_chapel_preserves_live_checks(
        self,
    ) -> None:

        road = (
            OLD_CHAPEL.scene(
                "chapel_road"
            )
        )


        graveyard = next(
            choice
            for choice
            in road.choices
            if choice.id
            == "search_graveyard"
        )


        listen = next(
            choice
            for choice
            in road.choices
            if choice.id
            == "watch_and_listen"
        )


        bell = (
            OLD_CHAPEL.scene(
                "chapel_bell"
            )
        )


        call_out = next(
            choice
            for choice
            in bell.choices
            if choice.id
            == "call_out"
        )


        self.assertEqual(
            graveyard.check.difficulty,
            12,
        )

        self.assertEqual(
            graveyard.check.skill,
            Skill.INVESTIGATION,
        )

        self.assertEqual(
            listen.check.skill,
            Skill.AWARENESS,
        )

        self.assertEqual(
            call_out.check.stat,
            Stat.PRESENCE,
        )


    def test_old_chapel_preserves_scene_loop(
        self,
    ) -> None:

        self.assertEqual(
            OLD_CHAPEL
            .scene(
                "chapel_road"
            )
            .default_next_scene_id,
            "chapel_bell",
        )


        self.assertEqual(
            OLD_CHAPEL
            .scene(
                "chapel_bell"
            )
            .default_next_scene_id,
            "chapel_road",
        )


    def test_invalid_scene_lookup_rejected(
        self,
    ) -> None:

        with self.assertRaises(
            ValueError
        ):

            OLD_CHAPEL.scene(
                "does_not_exist"
            )


    def test_invalid_transition_rejected(
        self,
    ) -> None:

        adventure = AdventureDefinition(

            id=
                "bad_adventure",

            title=
                "BAD",

            description=
                "Broken test content.",

            starting_scene_id=
                "start",

            scenes={
                "start":
                    SceneDefinition(

                        id=
                            "start",

                        title=
                            "START",

                        body=
                            "Test.",

                        ascii_art=
                            "",

                        choices=(),

                        default_next_scene_id=
                            "missing_scene",
                    ),
            },
        )


        with self.assertRaises(
            ValueError
        ):

            adventure.validate()


    def test_flag_condition_controls_visibility(
        self,
    ) -> None:

        choice = ChoiceDefinition(

            id=
                "secret",

            label=
                "OPEN SECRET DOOR",

            visible_if=(
                FlagCondition(

                    key=
                        "door_found",

                    equals=
                        True,
                ),
            ),
        )


        self.assertFalse(
            choice.is_visible(
                {}
            )
        )


        self.assertTrue(
            choice.is_visible(
                {
                    "door_found":
                        True,
                }
            )
        )


    def test_scene_public_data_hides_locked_choice(
        self,
    ) -> None:

        scene = SceneDefinition(

            id=
                "test",

            title=
                "TEST",

            body=
                "Test scene.",

            ascii_art=
                "",

            choices=(

                ChoiceDefinition(

                    id=
                        "normal",

                    label=
                        "NORMAL",
                ),

                ChoiceDefinition(

                    id=
                        "secret",

                    label=
                        "SECRET",

                    visible_if=(
                        FlagCondition(

                            key=
                                "secret_found",

                            equals=
                                True,
                        ),
                    ),
                ),
            ),
        )


        locked = (
            scene.public_data(
                {}
            )
        )


        unlocked = (
            scene.public_data(
                {
                    "secret_found":
                        True,
                }
            )
        )


        self.assertEqual(
            len(
                locked[
                    "choices"
                ]
            ),
            1,
        )


        self.assertEqual(
            len(
                unlocked[
                    "choices"
                ]
            ),
            2,
        )


    def test_flag_effect_is_content_data(
        self,
    ) -> None:

        effect = FlagEffect(

            key=
                "crypt_open",

            value=
                True,
        )


        self.assertEqual(
            effect.key,
            "crypt_open",
        )


        self.assertTrue(
            effect.value
        )


# =========================================================
# REGISTRY TESTS
# =========================================================

class AdventureRegistryTests(
    unittest.TestCase,
):

    def setUp(
        self,
    ) -> None:

        self.registry = (
            AdventureRegistry()
        )


    def test_register_and_get(
        self,
    ) -> None:

        self.registry.register(
            OLD_CHAPEL
        )


        loaded = (
            self.registry.get(
                "old_chapel"
            )
        )


        self.assertIs(
            loaded,
            OLD_CHAPEL,
        )


    def test_duplicate_registration_rejected(
        self,
    ) -> None:

        self.registry.register(
            OLD_CHAPEL
        )


        with self.assertRaises(
            ValueError
        ):

            self.registry.register(
                OLD_CHAPEL
            )


# =========================================================
# SESSION INTEGRATION TESTS
# =========================================================

class AdventureSessionIntegrationTests(
    unittest.TestCase,
):

    def setUp(
        self,
    ) -> None:

        self.sessions = (
            GameSessionManager()
        )


    def test_new_session_uses_old_chapel(
        self,
    ) -> None:

        session = (
            self.sessions.create(
                "ABC123"
            )
        )


        self.assertEqual(
            session.adventure_id,
            DEFAULT_ADVENTURE_ID,
        )

        self.assertEqual(
            session.scene_id,
            "chapel_road",
        )


    def test_runtime_scene_public_data_uses_flags(
        self,
    ) -> None:

        session = (
            self.sessions.create(
                "ABC123"
            )
        )


        data = (
            session.scene.public_data()
        )


        self.assertEqual(
            data[
                "id"
            ],
            "chapel_road",
        )

        self.assertEqual(
            len(
                data[
                    "choices"
                ]
            ),
            3,
        )


    def test_legacy_snapshot_restores_without_adventure_id(
        self,
    ) -> None:

        session = (
            self.sessions.restore_session(
                room_code=
                    "ABC123",

                data={
                    "scene_id":
                        "chapel_bell",

                    "turn_number":
                        7,

                    "submissions":
                        {},

                    "last_resolution":
                        "legacy",
                },
            )
        )


        self.assertEqual(
            session.adventure_id,
            DEFAULT_ADVENTURE_ID,
        )

        self.assertEqual(
            session.scene_id,
            "chapel_bell",
        )

        self.assertEqual(
            session.turn_number,
            7,
        )

        self.assertEqual(
            session.world_flags,
            {},
        )


    def test_stale_scene_falls_back_to_adventure_start(
        self,
    ) -> None:

        session = (
            self.sessions.restore_session(
                room_code=
                    "ABC123",

                data={
                    "adventure_id":
                        "old_chapel",

                    "scene_id":
                        "removed_scene",

                    "world_flags":
                        {
                            "example":
                                True,
                        },
                },
            )
        )


        self.assertEqual(
            session.scene_id,
            "chapel_road",
        )

        self.assertTrue(
            session.world_flags[
                "example"
            ]
        )




# =========================================================
# WINDROAD LANTERN TESTS
# =========================================================

class WindroadLanternTests(
    unittest.TestCase,
):

    def test_windroad_validates(
        self,
    ) -> None:

        WINDROAD_LANTERN.validate()


    def test_windroad_has_four_scenes(
        self,
    ) -> None:

        self.assertEqual(
            len(
                WINDROAD_LANTERN.scenes
            ),
            4,
        )


    def test_windroad_starts_on_hill_road(
        self,
    ) -> None:

        self.assertEqual(
            WINDROAD_LANTERN.starting_scene_id,
            "hill_road",
        )


    def test_wind_charm_choice_starts_hidden(
        self,
    ) -> None:

        bridge = (
            WINDROAD_LANTERN.scene(
                "broken_bridge"
            )
        )


        hidden = (
            bridge.public_data(
                {}
            )
        )


        ids = {
            choice[
                "id"
            ]

            for choice
            in hidden[
                "choices"
            ]
        }


        self.assertNotIn(
            "ask_the_wind",
            ids,
        )


    def test_wind_charm_choice_unlocks(
        self,
    ) -> None:

        bridge = (
            WINDROAD_LANTERN.scene(
                "broken_bridge"
            )
        )


        visible = (
            bridge.public_data(
                {
                    "understands_wind_charms":
                        True,
                }
            )
        )


        ids = {
            choice[
                "id"
            ]

            for choice
            in visible[
                "choices"
            ]
        }


        self.assertIn(
            "ask_the_wind",
            ids,
        )


    def test_lantern_trade_starts_hidden(
        self,
    ) -> None:

        market = (
            WINDROAD_LANTERN.scene(
                "lantern_market"
            )
        )


        hidden = (
            market.public_data(
                {}
            )
        )


        ids = {
            choice[
                "id"
            ]

            for choice
            in hidden[
                "choices"
            ]
        }


        self.assertNotIn(
            "trade_lantern",
            ids,
        )


    def test_lantern_trade_unlocks(
        self,
    ) -> None:

        market = (
            WINDROAD_LANTERN.scene(
                "lantern_market"
            )
        )


        visible = (
            market.public_data(
                {
                    "has_windroad_lantern":
                        True,
                }
            )
        )


        ids = {
            choice[
                "id"
            ]

            for choice
            in visible[
                "choices"
            ]
        }


        self.assertIn(
            "trade_lantern",
            ids,
        )


if __name__ == "__main__":

    unittest.main()


class SoloIntermissionTests(unittest.TestCase):

    def test_solo_intermission_is_a_run_not_an_automatic_win(self) -> None:
        sessions = GameSessionManager()
        session = sessions.create("SOLO01")
        players = {
            "player-1": SimpleNamespace(name="Solo Hero"),
        }

        result, created = sessions.submit_intermission_score(
            "SOLO01",
            turn_number=session.turn_number,
            game_id=sessions.intermission_game_id(session.turn_number),
            player_id="player-1",
            score=17,
            players=players,
        )

        self.assertTrue(created)
        self.assertTrue(result["solo"])
        self.assertIsNone(result["winner_player_id"])
        self.assertEqual(result["scores"][0]["score"], 17)
        self.assertEqual(session.intermission_wins.get("player-1", 0), 0)
