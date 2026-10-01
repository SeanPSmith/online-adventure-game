from __future__ import annotations

import unittest

from app.generation.pacing import (
    director_turn_window,
)


class DirectorPacingTests(
    unittest.TestCase
):

    def test_short_window(
        self,
    ) -> None:

        self.assertEqual(
            director_turn_window(
                "SHORT"
            ),
            (
                8,
                12,
                16,
            ),
        )


    def test_medium_window(
        self,
    ) -> None:

        self.assertEqual(
            director_turn_window(
                "medium"
            ),
            (
                12,
                18,
                26,
            ),
        )


    def test_long_window(
        self,
    ) -> None:

        self.assertEqual(
            director_turn_window(
                "LONG"
            ),
            (
                18,
                28,
                40,
            ),
        )


    def test_unknown_defaults_medium(
        self,
    ) -> None:

        self.assertEqual(
            director_turn_window(
                "mystery-size"
            ),
            (
                12,
                18,
                26,
            ),
        )


if __name__ == "__main__":

    unittest.main()
