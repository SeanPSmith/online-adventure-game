from __future__ import annotations

import unittest
from unittest.mock import patch

from app.adventures.models import AdventureDefinition, ChoiceDefinition, SceneDefinition
from app.adventures.registry import adventure_registry
from app.game.session import GameSessionManager
from app.generation.mock_provider import MockAdventureGenerationProvider
from app.generation.runtime_adapter import runtime_adventure_id
from app.generation.service import AdventureGenerationService


class _GeneratedStoreStub:
    def __init__(self, generated: dict) -> None:
        self.generated = dict(generated)

    async def get(self, generated_adventure_id: str):
        if generated_adventure_id != self.generated["generated_adventure_id"]:
            return None
        return dict(self.generated)

    async def set_status(self, *, generated_adventure_id: str, status: str):
        if generated_adventure_id != self.generated["generated_adventure_id"]:
            raise LookupError("Generated adventure not found.")
        self.generated["status"] = status
        return dict(self.generated)


class RuntimeRecoveryPass20Tests(unittest.IsolatedAsyncioTestCase):

    async def test_retiring_generated_adventure_hides_runtime_catalog_entry(self) -> None:
        generated_id = "pass20-retire"
        runtime_id = runtime_adventure_id(generated_id)

        if adventure_registry.exists(runtime_id):
            adventure_registry.unregister(runtime_id)

        adventure_registry.register(
            AdventureDefinition(
                id=runtime_id,
                title="PASS 20 RETIRE",
                description="Visible before retirement.",
                starting_scene_id="opening",
                scenes={
                    "opening": SceneDefinition(
                        id="opening",
                        title="OPENING",
                        body="test",
                        ascii_art="",
                        choices=(ChoiceDefinition(id="a", label="A"),),
                    ),
                },
                metadata={
                    "generated": True,
                    "generated_adventure_id": generated_id,
                    "catalog_visible": True,
                },
            )
        )

        stub = _GeneratedStoreStub({
            "generated_adventure_id": generated_id,
            "status": "approved",
        })
        service = AdventureGenerationService(MockAdventureGenerationProvider())

        try:
            with patch("app.generation.service.generated_adventure_store", stub):
                retired = await service.retire(generated_id)

            self.assertEqual(retired["status"], "retired")
            self.assertFalse(
                adventure_registry.get(runtime_id).metadata["catalog_visible"]
            )
        finally:
            adventure_registry.unregister(runtime_id)


class QuickEventRecoveryPass20Tests(unittest.TestCase):

    @classmethod
    def setUpClass(cls) -> None:
        cls.adventure_id = "pass20_qte_adventure"
        if not adventure_registry.exists(cls.adventure_id):
            adventure_registry.register(
                AdventureDefinition(
                    id=cls.adventure_id,
                    title="QTE PASS 20",
                    description="test",
                    starting_scene_id="opening",
                    scenes={
                        "opening": SceneDefinition(
                            id="opening",
                            title="THE SIGNAL ROOM",
                            body="The red transmitter starts shrieking behind the locked glass.",
                            ascii_art="",
                            choices=(
                                ChoiceDefinition(id="a", label="A"),
                                ChoiceDefinition(id="b", label="B"),
                            ),
                        ),
                    },
                    metadata={"runtime_mode": "ai_director", "director_max_turns": 10},
                )
            )

    def setUp(self) -> None:
        self.manager = GameSessionManager()
        self.session = self.manager.create("QTE020", self.adventure_id)
        self.session.story_state = {
            "current_goal": "Stop the red transmitter before it wakes something outside."
        }
        self.session.last_resolution = "The glass cabinet cracks from the inside."

    def test_qte_has_visible_duration_and_story_context(self) -> None:
        event = self.manager.maybe_schedule_micro_event(
            "QTE020",
            resolved_turn_number=3,
        )
        self.assertIsNotNone(event)
        assert event is not None
        self.assertGreaterEqual(event["timeout_seconds"], 8)
        self.assertGreater(event["expires_at_ms"], event["created_at_ms"])
        self.assertIn("transmitter", event["story_context"].lower())
        combined = " ".join(
            [event["prompt"]]
            + [option["description"] for option in event["options"]]
        ).lower()
        self.assertIn("transmitter", combined)

    def test_timeout_is_a_real_response_and_clears_solo_event(self) -> None:
        self.manager.maybe_schedule_micro_event(
            "QTE020",
            resolved_turn_number=3,
        )
        resolved, completed = self.manager.submit_micro_event_choice(
            "QTE020",
            player_id="p1",
            option_id="__timeout__",
            required_player_ids=["p1"],
            response_names={"p1": "Athena"},
        )
        self.assertTrue(completed)
        self.assertTrue(resolved["resolved"])
        self.assertIsNone(self.session.pending_micro_event)
        self.assertEqual(
            self.session.micro_event_history[-1]["outcomes"][0]["tag"],
            "hesitated",
        )


if __name__ == "__main__":
    unittest.main()
