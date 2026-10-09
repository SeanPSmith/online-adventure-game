from __future__ import annotations

import unittest

from app.adventures.models import (
    AdventureDefinition,
    ChoiceDefinition,
    SceneDefinition,
)

from app.adventures.registry import (
    adventure_registry,
)

from app.game.session import (
    GameSessionManager,
)


class DirectorRuntimeSessionTests(
    unittest.TestCase
):

    def setUp(
        self,
    ) -> None:

        self.adventure_id = (
            "test_ai_director_runtime"
        )


        if not adventure_registry.exists(
            self.adventure_id
        ):

            adventure_registry.register(
                AdventureDefinition(

                    id=
                        self.adventure_id,

                    title=
                        "TEST DIRECTOR",

                    description=
                        "test",

                    starting_scene_id=
                        "opening",

                    scenes={
                        "opening":
                            SceneDefinition(

                                id=
                                    "opening",

                                title=
                                    "OPENING",

                                body=
                                    "The story begins.",

                                ascii_art=
                                    "",

                                choices=(
                                    ChoiceDefinition(
                                        id=
                                            "a",

                                        label=
                                            "A",
                                    ),
                                    ChoiceDefinition(
                                        id=
                                            "b",

                                        label=
                                            "B",
                                    ),
                                    ChoiceDefinition(
                                        id=
                                            "c",

                                        label=
                                            "C",
                                    ),
                                ),

                                default_next_scene_id=
                                    None,
                            ),
                    },

                    metadata={
                        "runtime_mode":
                            "ai_director",

                        "director_max_turns":
                            10,
                    },
                )
            )


        self.manager = (
            GameSessionManager()
        )


        self.session = (
            self.manager.create(
                "ABC123",
                self.adventure_id,
            )
        )


    def test_director_session_detected(
        self,
    ) -> None:

        self.assertTrue(
            self.session.is_ai_directed
        )

        self.assertEqual(
            self.session.director_max_turns,
            10,
        )


    def test_restore_prefers_persisted_dynamic_scene(
        self,
    ) -> None:

        restored = (
            self.manager.restore_session(

                room_code=
                    "REST01",

                data={
                    "adventure_id":
                        self.adventure_id,

                    # This is the exact old-bug shape:
                    # static opening id survived while the real current
                    # runtime scene was stored in dynamic_scene.
                    "scene_id":
                        "opening",

                    "turn_number":
                        7,

                    "submissions":
                        {},

                    "dynamic_scene": {
                        "id":
                            "ai_turn_7",

                        "title":
                            "CURRENT TURN",

                        "body":
                            "This is where the players actually left off.",

                        "ascii_art":
                            "",

                        "choices": [
                            {
                                "id":
                                    "next",

                                "label":
                                    "CONTINUE",
                            },
                        ],
                    },

                    "director_history": [
                        {
                            "turn_number":
                                6,

                            "resolution":
                                "Previous result.",
                        },
                    ],
                },
            )
        )


        self.assertEqual(
            restored.scene_id,
            "ai_turn_7",
        )


        self.assertEqual(
            restored.scene.public_data()[
                "title"
            ],
            "CURRENT TURN",
        )


        self.assertEqual(
            restored.turn_number,
            7,
        )


    def test_restore_preserves_structured_story_state(
        self,
    ) -> None:

        restored = (
            self.manager.restore_session(

                room_code=
                    "STATE1",

                data={
                    "adventure_id":
                        self.adventure_id,

                    "scene_id":
                        "opening",

                    "turn_number":
                        4,

                    "submissions":
                        {},

                    "story_state": {
                        "current_goal":
                            "Find the missing witness.",

                        "story_phase":
                            "escalation",

                        "player_positions":
                            [],

                        "active_npcs":
                            [],

                        "active_threats":
                            [],

                        "known_facts": [
                            "The witness left before dawn.",
                        ],

                        "player_private_knowledge":
                            [],

                        "unresolved_threads": [
                            "Where did the witness go?",
                        ],

                        "resolved_threads":
                            [],

                        "important_items":
                            [],

                        "active_advantages":
                            [],

                        "recent_consequences":
                            [],

                        "closed_opportunities": [
                            "Question the innkeeper again.",
                        ],
                    },
                },
            )
        )


        self.assertEqual(
            restored.story_state[
                "current_goal"
            ],
            "Find the missing witness.",
        )


        self.assertEqual(
            restored.story_state[
                "closed_opportunities"
            ],
            [
                "Question the innkeeper again.",
            ],
        )


    def test_commit_creates_dynamic_scene(
        self,
    ) -> None:

        self.session.submissions = {
            "p1":
                "a",

            "p2":
                "b",
        }


        result = (
            self.manager
            .commit_director_turn(

                "ABC123",

                turn_facts={
                    "previous_scene_id":
                        "opening",

                    "results": [
                        {
                            "player_name":
                                "ONE",

                            "choice_label":
                                "A",

                            "check":
                                None,
                        },
                        {
                            "player_name":
                                "TWO",

                            "choice_label":
                                "B",

                            "check":
                                None,
                        },
                    ],
                },

                director_output={
                    "title":
                        "TURN TWO",

                    "resolution_narration":
                        "Both choices matter and the situation changes.",

                    "scene_body":
                        "A new immediate problem appears.",

                    "choices": [
                        "Investigate",
                        "Negotiate",
                        "Take the risky route",
                    ],

                    "memory_summary":
                        "The pair reached the new problem.",

                    "story_state": {
                        "current_goal":
                            "Understand the new problem.",

                        "story_phase":
                            "setup",

                        "player_positions": [
                            {
                                "player_name":
                                    "ONE",

                                "location":
                                    "The new location",

                                "status":
                                    "Present",
                            },
                            {
                                "player_name":
                                    "TWO",

                                "location":
                                    "The new location",

                                "status":
                                    "Present",
                            },
                        ],

                        "active_npcs":
                            [],

                        "active_threats":
                            [],

                        "known_facts": [
                            "Both players reached the new problem.",
                        ],

                        "player_private_knowledge":
                            [],

                        "unresolved_threads": [
                            "What caused the new problem?",
                        ],

                        "resolved_threads":
                            [],

                        "important_items":
                            [],

                        "active_advantages": [
                            "Both players arrived together.",
                        ],

                        "recent_consequences":
                            [],

                        "closed_opportunities":
                            [],
                    },

                    "completed":
                        False,

                    "director_meta":
                        {
                            "model":
                                "test",
                        },
                },
            )
        )


        self.assertEqual(
            self.session.turn_number,
            2,
        )

        self.assertEqual(
            self.session.scene.title,
            "TURN TWO",
        )

        self.assertEqual(
            len(
                self.session.scene.choices
            ),
            3,
        )

        self.assertFalse(
            self.session.submissions
        )

        self.assertEqual(
            self.session.story_state[
                "current_goal"
            ],
            "Understand the new problem.",
        )

        self.assertEqual(
            self.session.story_state[
                "unresolved_threads"
            ],
            [
                "What caused the new problem?",
            ],
        )

        self.assertFalse(
            result[
                "completed"
            ]
        )


    def test_final_commit_has_no_choices(
        self,
    ) -> None:

        self.session.turn_number = 10


        result = (
            self.manager
            .commit_director_turn(

                "ABC123",

                turn_facts={
                    "previous_scene_id":
                        "opening",

                    "results":
                        [],
                },

                director_output={
                    "title":
                        "EPILOGUE",

                    "resolution_narration":
                        "The final choices resolve the adventure.",

                    "scene_body":
                        "The consequences settle into a final image.",

                    "choices":
                        [],

                    "memory_summary":
                        "The adventure is complete.",

                    "completed":
                        True,

                    "director_meta":
                        {},
                },
            )
        )


        self.assertTrue(
            self.session.completed
        )

        self.assertEqual(
            self.session.turn_number,
            10,
        )

        self.assertEqual(
            len(
                self.session.scene.choices
            ),
            0,
        )

        self.assertTrue(
            result[
                "completed"
            ]
        )


if __name__ == "__main__":
    unittest.main()


class SoloReadinessTests(
    unittest.TestCase,
):

    def test_one_player_can_resolve_when_solo_is_required(
        self,
    ) -> None:

        manager = GameSessionManager()

        session = manager.create(
            "SOLO02",
            "old_chapel",
        )

        player_id = "player-solo"

        first_choice = session.scene.choices[0]

        manager.submit_choice(
            room_code="SOLO02",
            player_id=player_id,
            choice_id=first_choice.id,
        )

        self.assertTrue(
            manager.all_players_ready(
                "SOLO02",
                [player_id],
                required_players=1,
            )
        )

        self.assertFalse(
            manager.all_players_ready(
                "SOLO02",
                [player_id],
                required_players=2,
            )
        )


def test_wrap_up_state_restores_from_snapshot():
    manager = GameSessionManager()
    adventure_id = "test_ai_director_runtime"
    if not adventure_registry.exists(adventure_id):
        adventure_registry.register(
            AdventureDefinition(
                id=adventure_id,
                title="TEST DIRECTOR",
                description="test",
                starting_scene_id="opening",
                scenes={
                    "opening": SceneDefinition(
                        id="opening",
                        title="OPENING",
                        body="The story begins.",
                        ascii_art="",
                        choices=(
                            ChoiceDefinition(id="a", label="A"),
                            ChoiceDefinition(id="b", label="B"),
                            ChoiceDefinition(id="c", label="C"),
                        ),
                        default_next_scene_id=None,
                    )
                },
                metadata={"runtime_mode": "ai_director", "director_max_turns": 10},
            )
        )

    session = manager.restore_session(
        "WRAP01",
        {
            "adventure_id": adventure_id,
            "scene_id": "opening",
            "turn_number": 6,
            "wrap_up_votes": ["p1", "p2"],
            "wrap_up_active": True,
            "wrap_up_turns_remaining": 2,
        },
    )

    assert session.wrap_up_votes == ["p1", "p2"]
    assert session.wrap_up_active is True
    assert session.wrap_up_turns_remaining == 2


def test_wrap_up_countdown_decrements_after_nonfinal_commit():
    manager = GameSessionManager()
    adventure_id = "test_ai_director_runtime"
    session = manager.create("WRAP02", adventure_id)
    session.turn_number = 6
    session.wrap_up_active = True
    session.wrap_up_turns_remaining = 3

    manager.commit_director_turn(
        "WRAP02",
        turn_facts={"previous_scene_id": "opening", "results": []},
        director_output={
            "title": "THE ROAD NARROWS",
            "resolution_narration": "Old threads begin to converge.",
            "scene_body": "The Heroes see the ending drawing nearer.",
            "choices": ["Press onward", "Call an ally", "Risk the shortcut"],
            "memory_summary": "The final chapter has begun.",
            "story_state": {},
            "completed": False,
            "director_meta": {},
        },
    )

    assert session.wrap_up_active is True
    assert session.wrap_up_turns_remaining == 2
