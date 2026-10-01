from __future__ import annotations

import unittest

import pytest

from app.authoring.ai_assist import (
    AuthorAssistService,
)
from app.authoring.service import (
    default_source_document,
)
from app.generation.openai_provider import (
    OpenAIAdventureGenerationProvider,
)
from app.generation.seed_schema import (
    AdventureSeedDraft,
)


class AuthorAssistMergeTests(unittest.TestCase):

    def test_document_assist_fills_gaps_without_replacing_authored_text(self) -> None:
        source = default_source_document(
            title="Saturday Shift",
            slug="saturday_shift",
            document_kind="brief",
        )
        source["identity"]["one_sentence_pitch"] = (
            "Two clerks work a Saturday shift when the store gets strange."
        )
        source["identity"]["tone"] = "Deadpan small-town dread."

        proposal = {
            "identity": {
                "title": "AI SHOULD NOT RENAME THIS",
                "primary_type": "social_intrigue",
                "secondary_type": "mystery",
                "length": "medium",
                "genre": "1980s supernatural mystery",
                "tone": "AI tone should not replace authored tone.",
                "difficulty": "moderate",
                "weirdness": 3,
                "one_sentence_pitch": "AI pitch should not replace authored pitch.",
                "player_experience": "Ordinary workday tension turning uncanny.",
            },
            "premise": "A normal grocery shift develops impossible inconsistencies.",
            "world_truths": [
                {"authority": "canon", "text": "It is September 22, 1984."},
            ],
            "locations": [],
            "npcs": [],
            "lore_secrets": [],
            "moments": [],
            "forbidden_rules": [],
            "story_threads": [],
            "story_guidance": {
                "humor": "Dry workplace humor.",
                "danger": "Escalate gradually.",
                "violence": "Rare and consequential.",
                "weirdness": "Begin mundane, then impossible.",
                "choice_guidance": "Offer social, risky, practical, and weird approaches.",
                "failure_philosophy": "Failure creates complications.",
            },
            "replayability": {
                "variable_elements": "Which customer notices first.",
                "fixed_elements": "The date and store remain fixed.",
                "notes": "Keep the opening grounded.",
            },
            "freeform_notes": "Use fluorescent-light atmosphere.",
        }

        merged, changed = AuthorAssistService._merge_document_proposal(
            source,
            proposal,
        )

        self.assertEqual(merged["identity"]["title"], "Saturday Shift")
        self.assertEqual(
            merged["identity"]["one_sentence_pitch"],
            source["identity"]["one_sentence_pitch"],
        )
        self.assertEqual(merged["identity"]["tone"], "Deadpan small-town dread.")
        self.assertEqual(merged["identity"]["primary_type"], "social_intrigue")
        self.assertEqual(merged["identity"]["length"], "medium")
        self.assertIn("identity.primary_type", changed)
        self.assertIn("premise", changed)
        self.assertEqual(merged["world_truths"][0]["text"], "It is September 22, 1984.")
        self.assertTrue(merged["world_truths"][0]["id"])

    def test_npc_assist_preserves_explicit_unnamed_constraint(self) -> None:
        source = default_source_document(
            title="Field",
            slug="field",
        )
        source["npcs"] = [
            {
                "id": "npc-1",
                "name": "",
                "role": "Unnamed evil entity; mysterious and speaks in riddles.",
                "availability": "flexible",
                "introduction_timing": "late",
                "occupation": "",
                "appearance": "",
                "personality": "",
                "wants": "",
                "knows": "",
                "secret": "",
                "relationship": "",
                "canonical_facts": "It must never be given a proper name.",
                "introduction_conditions": "",
                "location_constraints": "",
                "forbidden_uses": "",
                "ai_freedom": "high",
                "importance": "supporting",
                "recurring": False,
            }
        ]

        proposal = {
            "name": "The Harrower",
            "role": "Ancient manipulator",
            "availability": "reserved",
            "introduction_timing": "late",
            "occupation": "",
            "appearance": "Seen only in incomplete silhouettes.",
            "personality": "Patient, cruel, indirect.",
            "wants": "To lure people into bargains.",
            "knows": "More than it admits.",
            "secret": "Its riddles are warnings as often as threats.",
            "relationship": "Unknown to the players at first.",
            "canonical_facts": "AI should not replace this.",
            "introduction_conditions": "Only after earlier signs establish it.",
            "location_constraints": "Avoid appearing in bright public places.",
            "forbidden_uses": "Never explain its full nature.",
            "ai_freedom": "low",
            "importance": "major",
            "recurring": True,
        }

        merged, changed = AuthorAssistService._merge_item_proposal(
            source,
            section="npcs",
            item_index=0,
            proposal=proposal,
        )

        npc = merged["npcs"][0]
        self.assertEqual(npc["id"], "npc-1")
        self.assertEqual(npc["name"], "")
        self.assertEqual(
            npc["role"],
            "Unnamed evil entity; mysterious and speaks in riddles.",
        )
        self.assertEqual(
            npc["canonical_facts"],
            "It must never be given a proper name.",
        )
        self.assertEqual(npc["introduction_timing"], "late")
        self.assertEqual(npc["appearance"], "Seen only in incomplete silhouettes.")
        self.assertIn("npcs[0].appearance", changed)


    def test_npc_assist_honors_unnamed_instruction_even_when_item_is_blank(self) -> None:
        source = default_source_document(
            title="Field",
            slug="field",
        )
        source["npcs"] = [
            {
                "id": "npc-2",
                "name": "",
                "role": "",
                "availability": "flexible",
                "introduction_timing": "anytime",
                "occupation": "",
                "appearance": "",
                "personality": "",
                "wants": "",
                "knows": "",
                "secret": "",
                "relationship": "",
                "canonical_facts": "",
                "introduction_conditions": "",
                "location_constraints": "",
                "forbidden_uses": "",
                "ai_freedom": "high",
                "importance": "supporting",
                "recurring": False,
            }
        ]

        proposal = {
            "name": "The Harrower",
            "role": "An unnamed evil entity that speaks in riddles.",
            "availability": "reserved",
            "introduction_timing": "late",
            "occupation": "",
            "appearance": "A shape that never resolves clearly.",
            "personality": "Cruel and indirect.",
            "wants": "Unknown.",
            "knows": "Too much.",
            "secret": "",
            "relationship": "Unknown to the players.",
            "canonical_facts": "It remains unnamed.",
            "introduction_conditions": "Foreshadow before appearance.",
            "location_constraints": "",
            "forbidden_uses": "Never give it a proper name.",
            "ai_freedom": "low",
            "importance": "major",
            "recurring": True,
        }

        merged, _ = AuthorAssistService._merge_item_proposal(
            source,
            section="npcs",
            item_index=0,
            proposal=proposal,
            instruction="some evil entity that has no name, mysterious, evil, speaks in riddles",
        )

        self.assertEqual(merged["npcs"][0]["name"], "")



class StorefrontSynopsisTests(unittest.TestCase):

    @staticmethod
    def seed(synopsis: str) -> AdventureSeedDraft:
        return AdventureSeedDraft(
            schema_version=1,
            title="Saturday, September 22, 1984",
            subtitle="Closing shift",
            primary_type="social_intrigue",
            secondary_type="mystery",
            target_length="short",
            tone="Small-town uncanny",
            difficulty="moderate",
            weirdness=3,
            premise=(
                "Two clerks are working a Saturday shift at the Elk City Superette "
                "when ordinary customers and inventory begin behaving impossibly."
            ),
            player_synopsis=synopsis,
            core_goal="Figure out what is wrong with the store and survive the shift.",
            major_locations=["Elk City Superette"],
            major_npcs=[],
            canon_constraints=[],
            required_elements=[],
            forbidden_elements=[],
            open_threads=[],
            hidden_truths=[],
            potential_finale="The players confront the source of the impossible events after closing.",
            director_guidance=["Keep the opening mundane before escalating."],
        )

    def test_raw_pitch_copy_is_flagged_for_polish(self) -> None:
        pitch = (
            "our heros working a shift at the Elk City Superette when things get weird "
            "and they have to figure out how to solve it."
        )
        brief = {
            "source": {
                "identity": {
                    "one_sentence_pitch": pitch,
                }
            }
        }

        self.assertTrue(
            OpenAIAdventureGenerationProvider._synopsis_needs_polish(
                self.seed(pitch),
                brief,
            )
        )

    def test_distinct_multisentence_teaser_is_kept(self) -> None:
        pitch = (
            "our heros working a shift at the Elk City Superette when things get weird "
            "and they have to figure out how to solve it."
        )
        synopsis = (
            "Saturday night at the Elk City Superette should be fluorescent lights, "
            "bad coffee, and counting the minutes to closing. Then the aisles stop agreeing "
            "about what they contain, familiar customers remember conversations that never "
            "happened, and the back room begins sounding much larger than the building. "
            "The shift is still theirs to finish, assuming they can decide what is actually real."
        )
        brief = {
            "source": {
                "identity": {
                    "one_sentence_pitch": pitch,
                }
            }
        }

        self.assertFalse(
            OpenAIAdventureGenerationProvider._synopsis_needs_polish(
                self.seed(synopsis),
                brief,
            )
        )


if __name__ == "__main__":
    unittest.main()


def test_field_assist_changes_only_requested_text_field() -> None:
    source = default_source_document(
        title="Saturday Shift",
        slug="saturday_shift",
        document_kind="brief",
    )
    source["identity"]["tone"] = "Dry and eerie."
    source["premise"] = "Two clerks are stuck working late."

    merged, changed = AuthorAssistService._apply_text_field(
        source,
        "premise",
        "Two clerks work a dead Saturday shift while impossible details slowly invade the store.",
    )

    assert changed == ["premise"]
    assert merged["identity"]["tone"] == "Dry and eerie."
    assert merged["identity"]["title"] == "Saturday Shift"
    assert merged["premise"].startswith("Two clerks work")


def test_field_assist_supports_repeat_item_text_and_rejects_slug() -> None:
    source = default_source_document(
        title="Field",
        slug="field",
    )
    source["locations"] = [
        {
            "id": "loc-1",
            "name": "Back Field",
            "role": "",
            "description": "",
            "canon": "",
            "ai_freedom": "medium",
            "importance": "supporting",
        }
    ]

    merged, changed = AuthorAssistService._apply_text_field(
        source,
        "locations[0].description",
        "An ordinary field behind a working farm that becomes important only after dark.",
    )

    assert changed == ["locations[0].description"]
    assert merged["locations"][0]["name"] == "Back Field"
    assert "after dark" in merged["locations"][0]["description"]

    with pytest.raises(ValueError):
        AuthorAssistService._resolve_text_field(source, "identity.slug")
