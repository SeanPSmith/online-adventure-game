from __future__ import annotations

import unittest

from app.generation.runtime_adapter import (
    build_director_runtime_adventure,
)


class GeneratedAdventureSynopsisTests(unittest.TestCase):

    @staticmethod
    def _generated(seed: dict) -> dict:
        return {
            "generated_adventure_id": "abc-123",
            "world_document_id": "world-1",
            "world_version_number": 1,
            "brief_document_id": "brief-1",
            "brief_version_number": 2,
            "seed": seed,
        }

    @staticmethod
    def _seed(**overrides) -> dict:
        seed = {
            "title": "Night Shift",
            "player_synopsis": (
                "A routine closing shift turns strange when the store phone "
                "starts ringing from a number that does not exist. Keep the "
                "doors locked, keep your nerve, and decide what deserves an answer."
            ),
            "premise": (
                "Internal planning premise containing author-facing setup and "
                "specific structural notes for the Director."
            ),
            "core_goal": "Investigate the disturbances and survive the shift.",
            "major_locations": ["Convenience Store"],
            "open_threads": [],
            "primary_type": "mystery",
            "secondary_type": "horror",
            "target_length": "short",
            "difficulty": "moderate",
            "tone": "creepy comedy",
            "weirdness": 3,
            "source": {
                "world": {"title": "Night County"},
                "brief": {"title": "Internal Night Shift Brief"},
            },
        }
        seed.update(overrides)
        return seed

    def test_runtime_catalog_description_uses_player_synopsis(self) -> None:
        adventure = build_director_runtime_adventure(
            self._generated(self._seed())
        )

        self.assertIn("routine closing shift", adventure.description)
        self.assertNotIn("Internal planning premise", adventure.description)
        self.assertEqual(
            adventure.metadata["player_synopsis"],
            adventure.description,
        )

    def test_legacy_seed_without_player_synopsis_still_loads(self) -> None:
        seed = self._seed()
        seed.pop("player_synopsis")

        adventure = build_director_runtime_adventure(
            self._generated(seed)
        )

        self.assertEqual(
            adventure.description,
            seed["core_goal"],
        )
        self.assertEqual(
            adventure.metadata["player_synopsis"],
            "",
        )


if __name__ == "__main__":
    unittest.main()
