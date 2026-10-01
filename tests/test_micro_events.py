from __future__ import annotations

import unittest

from app.adventures.models import AdventureDefinition, ChoiceDefinition, SceneDefinition
from app.adventures.registry import adventure_registry
from app.game.micro_events import should_schedule_micro_event
from app.game.session import GameSessionManager


class MicroEventTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls) -> None:
        cls.adventure_id = "test_micro_event_adventure"
        if not adventure_registry.exists(cls.adventure_id):
            adventure_registry.register(
                AdventureDefinition(
                    id=cls.adventure_id,
                    title="MICRO TEST",
                    description="test",
                    starting_scene_id="opening",
                    scenes={
                        "opening": SceneDefinition(
                            id="opening",
                            title="OPENING",
                            body="A strange signal flickers across the room.",
                            ascii_art="",
                            choices=(
                                ChoiceDefinition(id="a", label="A"),
                                ChoiceDefinition(id="b", label="B"),
                                ChoiceDefinition(id="c", label="C"),
                            ),
                            default_next_scene_id=None,
                        ),
                    },
                    metadata={"runtime_mode": "ai_director", "director_max_turns": 10},
                )
            )

    def setUp(self) -> None:
        self.manager = GameSessionManager()
        self.session = self.manager.create("MIC123", self.adventure_id)
        self.session.story_state = {"current_goal": "Trace the impossible signal."}

    def test_sparse_cadence(self) -> None:
        self.assertFalse(should_schedule_micro_event(resolved_turn_number=1, completed=False, wrap_up_active=False))
        self.assertFalse(should_schedule_micro_event(resolved_turn_number=2, completed=False, wrap_up_active=False))
        self.assertTrue(should_schedule_micro_event(resolved_turn_number=3, completed=False, wrap_up_active=False))
        self.assertTrue(should_schedule_micro_event(resolved_turn_number=6, completed=False, wrap_up_active=False))
        self.assertFalse(should_schedule_micro_event(resolved_turn_number=3, completed=True, wrap_up_active=False))
        self.assertFalse(should_schedule_micro_event(resolved_turn_number=3, completed=False, wrap_up_active=True))

    def test_scheduled_event_blocks_normal_choices(self) -> None:
        event = self.manager.maybe_schedule_micro_event("MIC123", resolved_turn_number=3)
        self.assertIsNotNone(event)
        self.assertEqual(event["created_from_turn"], 3)
        self.assertEqual(len(event["options"]), 2)

        with self.assertRaisesRegex(ValueError, "quick event"):
            self.manager.submit_choice("MIC123", "p1", "a")

    def test_party_responses_become_durable_story_fact(self) -> None:
        event = self.manager.maybe_schedule_micro_event("MIC123", resolved_turn_number=3)
        first_option = event["options"][0]["id"]
        second_option = event["options"][1]["id"]

        pending, completed = self.manager.submit_micro_event_choice(
            "MIC123",
            player_id="p1",
            option_id=first_option,
            required_player_ids=["p1", "p2"],
            response_names={"p1": "Athena", "p2": "Chordy"},
        )
        self.assertFalse(completed)
        self.assertEqual(pending["responses"]["p1"], first_option)
        self.assertIsNotNone(self.session.pending_micro_event)

        resolved, completed = self.manager.submit_micro_event_choice(
            "MIC123",
            player_id="p2",
            option_id=second_option,
            required_player_ids=["p1", "p2"],
            response_names={"p1": "Athena", "p2": "Chordy"},
        )
        self.assertTrue(completed)
        self.assertTrue(resolved["resolved"])
        self.assertIsNone(self.session.pending_micro_event)
        self.assertEqual(len(self.session.micro_event_history), 1)
        self.assertIn("Athena", self.session.micro_event_history[0]["resolution"])
        self.assertEqual(
            self.session.world_flags[f"micro_event:{event['id']}:p1"],
            first_option,
        )

    def test_restore_preserves_pending_event_and_history(self) -> None:
        event = self.manager.maybe_schedule_micro_event("MIC123", resolved_turn_number=3)
        restored = self.manager.restore_session(
            "RST123",
            {
                "adventure_id": self.adventure_id,
                "scene_id": "opening",
                "turn_number": 4,
                "pending_micro_event": event,
                "micro_event_history": [
                    {
                        "id": "micro_old",
                        "created_from_turn": 1,
                        "resolution": "Athena: HOLD GROUND",
                        "outcomes": [],
                    }
                ],
            },
        )
        self.assertEqual(restored.pending_micro_event["id"], event["id"])
        self.assertEqual(restored.micro_event_history[0]["id"], "micro_old")


if __name__ == "__main__":
    unittest.main()
