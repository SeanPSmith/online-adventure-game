from __future__ import annotations

import tempfile
import unittest

from pathlib import Path

from app.generation.mock_provider import (
    MockAdventureGenerationProvider,
)

from app.generation.openai_provider import (
    OpenAIAdventureGenerationProvider,
    _npc_canon_constraints,
)

from app.generation.seed_schema import (
    AdventureSeedDraft,
)

from app.generation.store import (
    GeneratedAdventureStore,
)


class MockGenerationProviderTests(
    unittest.IsolatedAsyncioTestCase
):

    async def test_mock_seed_uses_world_and_brief(
        self,
    ) -> None:

        provider = (
            MockAdventureGenerationProvider()
        )


        world_version = {
            "document_id":
                "world-1",

            "version_number":
                3,

            "source": {
                "identity": {
                    "title":
                        "The Hollow Kingdom",

                    "tone":
                        "eerie whimsy",
                },

                "locations": [
                    {
                        "name":
                            "Lantern Market",
                    },
                ],

                "npcs": [
                    {
                        "name":
                            "Mudd",
                    },
                ],

                "story_threads": [],
                "lore_secrets": [],
            },
        }


        brief_version = {
            "document_id":
                "brief-1",

            "version_number":
                2,

            "source": {
                "identity": {
                    "title":
                        "The Midnight Train",

                    "one_sentence_pitch":
                        (
                            "Reach the observatory "
                            "before sunrise."
                        ),

                    "primary_type":
                        "journey",

                    "secondary_type":
                        "mystery",

                    "length":
                        "medium",

                    "tone":
                        "strange and warm",

                    "difficulty":
                        "moderate",

                    "weirdness":
                        3,
                },

                "premise":
                    (
                        "The players board an "
                        "overnight train."
                    ),

                "locations":
                    [],

                "npcs":
                    [],

                "moments": [
                    {
                        "authority":
                            "required",

                        "text":
                            "The train stops where no station exists.",
                    },
                ],

                "world_truths": [],
                "story_threads": [],
                "lore_secrets": [],

                "story_guidance": {
                    "choice_guidance":
                        "Offer varied choices.",

                    "failure_philosophy":
                        "Failure creates complications.",
                },
            },
        }


        seed = (
            await provider
            .generate_seed(

                world_version=
                    world_version,

                brief_version=
                    brief_version,

                special_request=
                    "Use Mudd early.",
            )
        )


        self.assertEqual(
            seed[
                "title"
            ],
            "The Midnight Train",
        )


        self.assertIn(
            "Lantern Market",
            seed[
                "major_locations"
            ],
        )


        self.assertIn(
            "Mudd",
            seed[
                "major_npcs"
            ],
        )


        self.assertIn(
            "Use Mudd early.",
            seed[
                "director_guidance"
            ],
        )


        self.assertTrue(
            seed[
                "player_synopsis"
            ]
        )


        self.assertEqual(
            seed[
                "source"
            ][
                "world"
            ][
                "version_number"
            ],
            3,
        )


class NpcCanonConstraintTests(
    unittest.TestCase
):

    def test_structured_npc_constraints_become_hard_canon_lines(
        self,
    ) -> None:

        source = {
            "identity": {"document_kind": "brief"},
            "npcs": [
                {
                    "name": "Bob",
                    "role": "Missing owner",
                    "relationship": "Unknown to the players",
                    "canonical_facts": "Bob does not work at the store.",
                    "availability": "reserved",
                    "introduction_timing": "late",
                    "occupation": "Retired surveyor",
                    "introduction_conditions": "Only after the basement ledger is found.",
                    "location_constraints": "Never appears behind the store counter.",
                    "forbidden_uses": "Do not cast Bob as staff, cashier, or coworker.",
                },
            ],
        }

        constraints = _npc_canon_constraints(source)
        joined = "\n".join(constraints)

        self.assertIn("NPC Bob — canonical occupation/affiliation: Retired surveyor", joined)
        self.assertIn("NPC Bob — availability: RESERVED", joined)
        self.assertIn("NPC Bob — introduction timing: LATE", joined)
        self.assertIn("Only after the basement ledger is found.", joined)
        self.assertIn("Never appears behind the store counter.", joined)
        self.assertIn("Do not cast Bob as staff, cashier, or coworker.", joined)

    def test_default_npc_flexibility_does_not_add_fake_constraints(
        self,
    ) -> None:

        constraints = _npc_canon_constraints({
            "npcs": [
                {
                    "name": "Gary",
                    "availability": "flexible",
                    "introduction_timing": "anytime",
                },
            ],
        })

        self.assertFalse(any("availability" in value for value in constraints))
        self.assertFalse(any("introduction timing" in value for value in constraints))


class GenerationSchemaTests(
    unittest.TestCase
):

    def test_seed_schema_rejects_extra_fields(
        self,
    ) -> None:

        valid = {
            "schema_version":
                1,

            "title":
                "Test Adventure",

            "subtitle":
                "A short test",

            "primary_type":
                "journey",

            "secondary_type":
                "mystery",

            "target_length":
                "short",

            "tone":
                "warm and strange",

            "difficulty":
                "moderate",

            "weirdness":
                2,

            "premise":
                "Two travelers discover that the road home has changed around them.",

            "player_synopsis":
                "The road home has shifted overnight, and every mile points somewhere stranger. Reach the old observatory before sunrise and find out what changed.",

            "core_goal":
                "Reach the old observatory before sunrise.",

            "major_locations":
                [
                    "Lantern Road",
                ],

            "major_npcs":
                [],

            "canon_constraints":
                [],

            "required_elements":
                [],

            "forbidden_elements":
                [],

            "open_threads":
                [],

            "hidden_truths":
                [],

            "potential_finale":
                "The travelers confront the source of the altered road and choose what the route becomes.",

            "director_guidance":
                [
                    "Keep choices consequential.",
                ],
        }

        AdventureSeedDraft.model_validate(
            valid
        )

        invalid = dict(
            valid
        )

        invalid[
            "not_allowed"
        ] = True

        with self.assertRaises(
            Exception
        ):
            AdventureSeedDraft.model_validate(
                invalid
            )


    def test_openai_profiles_map_story_and_economy(
        self,
    ) -> None:

        provider = (
            OpenAIAdventureGenerationProvider()
        )

        story = provider._profile(
            "story"
        )

        economy = provider._profile(
            "economy"
        )

        self.assertEqual(
            story[
                0
            ],
            "story",
        )

        self.assertEqual(
            economy[
                0
            ],
            "economy",
        )

        self.assertIn(
            "sol",
            story[
                1
            ],
        )

        self.assertIn(
            "luna",
            economy[
                1
            ],
        )


class GeneratedAdventureStoreTests(
    unittest.IsolatedAsyncioTestCase
):

    async def asyncSetUp(
        self,
    ) -> None:

        self.temp_dir = (
            tempfile.TemporaryDirectory()
        )


        self.store = (
            GeneratedAdventureStore(

                Path(
                    self.temp_dir.name
                )
                / "generated.sqlite3"
            )
        )


        await self.store.initialize()


    async def asyncTearDown(
        self,
    ) -> None:

        self.temp_dir.cleanup()


    async def test_create_and_approve_seed(
        self,
    ) -> None:

        created = (
            await self.store.create(

                seed={
                    "title":
                        "Test Seed",
                },

                world_document_id=
                    "world-1",

                world_version_number=
                    1,

                brief_document_id=
                    "brief-1",

                brief_version_number=
                    1,

                created_by_user_id=
                    "user-1",
            )
        )


        self.assertEqual(
            created[
                "status"
            ],
            "generated",
        )


        approved = (
            await self.store.set_status(

                generated_adventure_id=
                    created[
                        "generated_adventure_id"
                    ],

                status=
                    "approved",
            )
        )


        self.assertEqual(
            approved[
                "status"
            ],
            "approved",
        )


        self.assertIsNotNone(
            approved[
                "approved_at"
            ]
        )


        approved_items = (
            await self.store
            .list_approved()
        )


        self.assertEqual(
            len(
                approved_items
            ),
            1,
        )


    async def test_reject_and_retire_seed(
        self,
    ) -> None:

        created = (
            await self.store.create(

                seed={
                    "title":
                        "Test Seed",
                },

                world_document_id=
                    "world-1",

                world_version_number=
                    1,

                brief_document_id=
                    "brief-1",

                brief_version_number=
                    1,

                created_by_user_id=
                    "user-1",
            )
        )


        rejected = (
            await self.store.set_status(

                generated_adventure_id=
                    created[
                        "generated_adventure_id"
                    ],

                status=
                    "rejected",
            )
        )


        self.assertEqual(
            rejected[
                "status"
            ],
            "rejected",
        )


        retired = (
            await self.store.set_status(

                generated_adventure_id=
                    created[
                        "generated_adventure_id"
                    ],

                status=
                    "retired",
            )
        )


        self.assertEqual(
            retired[
                "status"
            ],
            "retired",
        )


if __name__ == "__main__":

    unittest.main()
