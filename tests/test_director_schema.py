from __future__ import annotations

import unittest

from pydantic import (
    ValidationError,
)

from app.generation.director_schema import (
    DirectorTurnDraft,
)


class DirectorSchemaTests(
    unittest.TestCase
):

    def active_payload(
        self,
    ) -> dict:

        return {
            "title":
                "THE ROAD BENDS",

            "resolution_narration":
                "Both travelers commit to different approaches, and the situation answers them in different ways.",

            "scene_body":
                "The path ahead opens into a quiet orchard. The voices remain distant, giving the pair room to regroup before deciding what matters next.",

            "choices": [
                {
                    "label":
                        "CALL OUT TO THEM",

                    "description":
                        "Step into view and demand to know who is speaking beyond the trees.",

                    "archetype": "bold",
                    "tone": "assertive",
                    "risk_level": "moderate",
                    "reward_level": "moderate",
                    "impact_level": "meaningful",
                    "possible_gains": ["Immediate answers"],
                    "possible_costs": ["Reveal your position"],

                    "check": {
                        "difficulty":
                            5,

                        "skill":
                            None,

                        "stat":
                            "presence",
                    },
                },
                {
                    "label":
                        "TAKE THE LONG WAY",

                    "description":
                        "Circle through the orchard and try to identify the speakers without being seen.",

                    "archetype": "stealth",
                    "tone": "cautious",
                    "risk_level": "low",
                    "reward_level": "moderate",
                    "impact_level": "local",
                    "possible_gains": ["Learn who is ahead"],
                    "possible_costs": ["Lose time"],

                    "check": {
                        "difficulty":
                            9,

                        "skill":
                            "awareness",

                        "stat":
                            None,
                    },
                },
                {
                    "label":
                        "SET THE ORCHARD ABLAZE",

                    "description":
                        "Create a shocking diversion by firing the dry brush and force whoever is ahead to react.",

                    "archetype": "reckless",
                    "tone": "aggressive",
                    "risk_level": "high",
                    "reward_level": "high",
                    "impact_level": "scene_shifting",
                    "possible_gains": ["Force the hidden group into the open"],
                    "possible_costs": ["Spread fire through the orchard"],

                    "check":
                        None,
                },
            ],

            "memory_summary":
                (
                    "CURRENT GOAL: Reach the settlement.\n"
                    "PRESSURE: Release after escaping the roadblock.\n"
                    "PLAYER LOCATIONS: Together in the orchard.\n"
                    "NPCS PRESENT: None.\n"
                    "NPCS ELSEWHERE: Unknown voices beyond the trees.\n"
                    "KNOWN FACTS: The road is narrowing.\n"
                    "UNRESOLVED THREADS: Who is ahead?\n"
                    "RECENT CONSEQUENCES: The pair earned a moment to regroup."
                ),

            "story_state": {
                "current_goal":
                    "Reach the settlement and identify the voices.",

                "story_phase":
                    "setup",

                "player_positions": [
                    {
                        "player_name":
                            "ONE",

                        "location":
                            "The orchard path",

                        "status":
                            "Together with TWO",
                    },
                    {
                        "player_name":
                            "TWO",

                        "location":
                            "The orchard path",

                        "status":
                            "Together with ONE",
                    },
                ],

                "active_npcs":
                    [],

                "active_threats": [
                    {
                        "name":
                            "Unknown voices beyond the trees",

                        "status":
                            "Unidentified and distant",

                        "urgency":
                            "low",
                    },
                ],

                "known_facts": [
                    "The road behind them was blocked.",
                ],

                "player_private_knowledge":
                    [],

                "unresolved_threads": [
                    "Who is speaking beyond the trees?",
                ],

                "resolved_threads": [
                    "The roadblock was escaped.",
                ],

                "important_items":
                    [],

                "active_advantages": [
                    "The pair have a quiet moment to compare notes.",
                ],

                "recent_consequences": [
                    {
                        "description":
                            "Escaping the roadblock bought breathing room.",

                        "effect_name":
                            "BREATHING ROOM",

                        "health_delta":
                            0,

                        "affected":
                            "Both players",

                        "permanence":
                            "temporary",

                        "modifier_stat": None,
                        "modifier_skill": None,
                        "modifier_value": 0,
                    },
                ],

                "closed_opportunities":
                    [],
            },

            "pressure_level":
                "release",

            "scene_function":
                "breather",

            "completed":
                False,

            "ending_label":
                "",
        }


    def test_active_turn_accepts_two_checked_choices(
        self,
    ) -> None:

        DirectorTurnDraft.model_validate(
            self.active_payload()
        )


    def test_turn_requires_structured_story_state(
        self,
    ) -> None:

        payload = self.active_payload()

        payload.pop(
            "story_state"
        )


        with self.assertRaises(
            ValidationError
        ):

            DirectorTurnDraft.model_validate(
                payload
            )


    def test_active_turn_accepts_easy_check(
        self,
    ) -> None:

        payload = self.active_payload()

        payload["choices"][0]["check"]["difficulty"] = 3

        DirectorTurnDraft.model_validate(
            payload
        )


    def test_active_turn_rejects_one_checked_choice(
        self,
    ) -> None:

        payload = self.active_payload()

        payload["choices"][0]["check"] = None

        with self.assertRaises(
            ValidationError
        ):

            DirectorTurnDraft.model_validate(
                payload
            )


    def test_active_turn_rejects_zero_checked_choices(
        self,
    ) -> None:

        payload = self.active_payload()

        for choice in payload["choices"]:
            choice["check"] = None

        with self.assertRaises(
            ValidationError
        ):

            DirectorTurnDraft.model_validate(
                payload
            )


    def test_active_turn_allows_six_choices(
        self,
    ) -> None:

        payload = self.active_payload()

        payload["choices"].extend([
            {
                "label":
                    "BAIT THEM OUT",

                "description": "Make a deliberate noise, then vanish into cover and wait for someone to investigate.",
                "archetype": "clever",
                "tone": "deceptive",
                "risk_level": "moderate",
                "reward_level": "high",
                "impact_level": "meaningful",
                "possible_gains": ["Isolate one speaker"],
                "possible_costs": ["Alert the whole group"],

                "check": {
                    "difficulty":
                        6,

                    "skill":
                        "stealth",

                    "stat":
                        None,
                },
            },
            {
                "label":
                    "TAKE THE HIGH BRANCHES",

                "description": "Climb above the orchard for a commanding look at the road and anyone waiting beyond it.",
                "archetype": "investigative",
                "tone": "curious",
                "risk_level": "high",
                "reward_level": "high",
                "impact_level": "meaningful",
                "possible_gains": ["See the entire approach"],
                "possible_costs": ["Fall or be silhouetted"],

                "check": {
                    "difficulty":
                        12,

                    "skill":
                        "athletics",

                    "stat":
                        None,
                },
            },
            {
                "label":
                    "ANSWER IN BIRDSONG",

                "description": "Reply to the distant voices with an absurd imitation of the orchard birds and see who answers.",
                "archetype": "weird",
                "tone": "whimsical",
                "risk_level": "moderate",
                "reward_level": "moderate",
                "impact_level": "local",
                "possible_gains": ["Provoke an unguarded reaction"],
                "possible_costs": ["Look ridiculous or reveal your presence"],

                "check":
                    None,
            },
        ])

        DirectorTurnDraft.model_validate(
            payload
        )


    def test_completed_turn_requires_no_choices(
        self,
    ) -> None:

        payload = self.active_payload()

        payload[
            "completed"
        ] = True

        payload[
            "choices"
        ] = []

        payload[
            "pressure_level"
        ] = "release"

        payload[
            "scene_function"
        ] = "climax"

        DirectorTurnDraft.model_validate(
            payload
        )


if __name__ == "__main__":
    unittest.main()
