from __future__ import annotations

import asyncio
import tempfile
import unittest

from pathlib import Path
from types import SimpleNamespace

from app.persistence.store import SQLiteStateStore


class AdventureHistoryTests(unittest.TestCase):

    def run_async(self, coroutine):
        return asyncio.run(coroutine)


    def build_room_and_session(self):

        room = SimpleNamespace(
            code="ABC123",
            players={
                "p1": SimpleNamespace(
                    user_id="user-1",
                    character_id="hero-1",
                    name="GROGNAK",
                    is_host=True,
                ),
                "p2": SimpleNamespace(
                    user_id="user-2",
                    character_id="hero-2",
                    name="FREYJA",
                    is_host=False,
                ),
            },
        )

        session = SimpleNamespace(
            completed=True,
            adventure_id="generated_story",
            adventure=SimpleNamespace(
                title="MIDNIGHT MARAUDERS",
            ),
            ending_label="THE VERDICT BREAKS ITS TEETH",
            turn_number=15,
            scene=SimpleNamespace(
                title="EPILOGUE",
            ),
            last_resolution=(
                "The crowd breaks the verdict and the survivors escape."
            ),
            director_memory=(
                "The pair survived the verdict and escaped together."
            ),
            story_state={
                "resolved_threads": [
                    "The verdict was broken.",
                ],
                "closed_opportunities": [
                    "Return to the gallery before dawn.",
                ],
            },
            director_history=[
                {
                    "turn_number": 15,
                    "completed": True,
                },
            ],
            director_usage={
                "requests": 14,
                "total_tokens": 37000,
            },
        )

        return room, session


    def test_completed_story_is_queryable_by_character(self):

        with tempfile.TemporaryDirectory() as temp:

            store = SQLiteStateStore(
                Path(temp) / "state.sqlite3"
            )

            self.run_async(store.initialize())

            room, session = self.build_room_and_session()

            self.run_async(
                store.record_completed_adventure(
                    room,
                    session,
                )
            )

            stories = self.run_async(
                store.list_completed_adventures(
                    user_id="user-1",
                    character_id="hero-1",
                )
            )

            self.assertEqual(len(stories), 1)
            self.assertEqual(
                stories[0]["adventure_title"],
                "MIDNIGHT MARAUDERS",
            )
            self.assertEqual(
                stories[0]["ending_label"],
                "THE VERDICT BREAKS ITS TEETH",
            )
            self.assertEqual(
                stories[0]["turn_count"],
                15,
            )


    def test_history_is_scoped_to_owner_and_character(self):

        with tempfile.TemporaryDirectory() as temp:

            store = SQLiteStateStore(
                Path(temp) / "state.sqlite3"
            )

            self.run_async(store.initialize())

            room, session = self.build_room_and_session()

            self.run_async(
                store.record_completed_adventure(
                    room,
                    session,
                )
            )

            stories = self.run_async(
                store.list_completed_adventures(
                    user_id="user-1",
                    character_id="hero-2",
                )
            )

            self.assertEqual(stories, [])


    def test_lifetime_stats_use_authoritative_adventure_totals(self):

        with tempfile.TemporaryDirectory() as temp:

            store = SQLiteStateStore(
                Path(temp) / "state.sqlite3"
            )

            self.run_async(store.initialize())

            room, session = self.build_room_and_session()

            session.character_adventure_stats = {
                "hero-1": {
                    "checks_total": 12,
                    "checks_succeeded": 8,
                    "critical_successes": 2,
                    "critical_failures": 1,
                },
                "hero-2": {
                    "checks_total": 7,
                    "checks_succeeded": 4,
                    "critical_successes": 0,
                    "critical_failures": 1,
                },
            }

            session.intermission_wins = {
                "p1": 3,
                "p2": 1,
            }

            self.run_async(
                store.record_completed_adventure(
                    room,
                    session,
                )
            )

            stats = self.run_async(
                store.get_character_lifetime_stats(
                    user_id="user-1",
                    character_id="hero-1",
                )
            )

            self.assertEqual(
                stats["adventures_completed"],
                1,
            )
            self.assertEqual(
                stats["checks_total"],
                12,
            )
            self.assertEqual(
                stats["checks_succeeded"],
                8,
            )
            self.assertEqual(
                stats["critical_successes"],
                2,
            )
            self.assertEqual(
                stats["critical_failures"],
                1,
            )
            self.assertEqual(
                stats["intermission_wins"],
                3,
            )
            self.assertTrue(
                next(
                    achievement
                    for achievement
                    in stats["achievements"]
                    if achievement["id"]
                    == "lucky_bastard"
                )["unlocked"]
            )


    def test_record_is_idempotent_per_room(self):

        with tempfile.TemporaryDirectory() as temp:

            store = SQLiteStateStore(
                Path(temp) / "state.sqlite3"
            )

            self.run_async(store.initialize())

            room, session = self.build_room_and_session()

            self.run_async(
                store.record_completed_adventure(
                    room,
                    session,
                )
            )

            self.run_async(
                store.record_completed_adventure(
                    room,
                    session,
                )
            )

            stories = self.run_async(
                store.list_completed_adventures(
                    user_id="user-1",
                    character_id="hero-1",
                )
            )

            self.assertEqual(len(stories), 1)


if __name__ == "__main__":
    unittest.main()
