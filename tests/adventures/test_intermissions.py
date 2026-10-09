from tests.support import PROJECT_ROOT
import unittest
from pathlib import Path

from app.game.session import GameSessionManager


class IntermissionVarietyTests(unittest.TestCase):
    def test_six_game_rotation_is_deterministic_and_wraps(self) -> None:
        sessions = GameSessionManager()
        expected = [
            "rune_catch",
            "lantern_keep",
            "relic_scramble",
            "sigil_memory",
            "ward_breaker",
            "shadow_step",
        ]

        actual = [
            sessions.intermission_game_id(turn)
            for turn in range(1, 13)
        ]

        self.assertEqual(actual[:6], expected)
        self.assertEqual(actual[6:], expected)

    def test_client_recognizes_all_server_game_ids(self) -> None:
        root = PROJECT_ROOT
        games_js = (root / "app/web/intermission_games.js").read_text()
        adventure_js = (root / "app/web/adventure_ui.js").read_text()

        for game_id in (
            "rune_catch",
            "lantern_keep",
            "relic_scramble",
            "sigil_memory",
            "ward_breaker",
            "shadow_step",
        ):
            self.assertIn(game_id, games_js)
            self.assertIn(game_id, adventure_js)


if __name__ == "__main__":
    unittest.main()
