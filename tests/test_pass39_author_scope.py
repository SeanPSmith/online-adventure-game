from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.authoring.ai_assist import (
    AuthorAssistService,
    BriefDocumentAssistDraft,
    WorldDocumentAssistDraft,
)
from app.authoring.store import AuthoringStore
from app.authoring.service import (
    assess_document_strength,
    compile_source_document,
    default_source_document,
    generation_source_document,
    normalize_source_document,
)
from app.generation.service import _validate_featured_world_references
from app.generation.openai_provider import (
    OpenAIAdventureGenerationProvider,
    _world_reference_constraints,
)


def test_world_and_brief_templates_have_distinct_v3_shapes() -> None:
    world = default_source_document(
        title="Weird Town",
        slug="weird_town",
        document_kind="world",
    )
    brief = default_source_document(
        title="Saturday Night",
        slug="saturday_night",
        document_kind="brief",
    )

    assert world["schema_version"] == 3
    assert brief["schema_version"] == 3

    assert "premise" in world
    assert "world_truths" in world
    assert "world_rules" in world
    assert "moments" not in world
    assert "replayability" not in world
    assert "primary_type" not in world["identity"]
    assert "choice_guidance" not in world["story_guidance"]
    assert "failure_philosophy" not in world["story_guidance"]

    assert "starting_situation" in brief
    assert "core_goal" in brief
    assert "adventure_facts" in brief
    assert "world_references" in brief
    assert "moments" in brief
    assert "replayability" in brief
    assert "premise" not in brief
    assert "world_truths" not in brief
    assert brief["identity"]["primary_type"] == "mystery"


def test_legacy_world_migration_preserves_source_and_quarantines_adventure_fields() -> None:
    legacy = {
        "schema_version": 2,
        "identity": {
            "document_kind": "world",
            "title": "Old World",
            "slug": "old_world",
            "primary_type": "survival",
            "secondary_type": "mystery",
            "length": "long",
            "difficulty": "hard",
            "genre": "rust belt weirdness",
            "tone": "eerie",
            "weirdness": 4,
            "one_sentence_pitch": "A town where the mine never stopped burning.",
            "player_experience": "Grounded dread.",
        },
        "premise": "The town sits above a fire that should have died decades ago.",
        "world_truths": [{"authority": "canon", "text": "The mine still burns."}],
        "locations": [{"name": "Old Mine", "description": "Sealed", "canon": "Hot"}],
        "npcs": [{"name": "Mayor Higgins", "role": "Mayor"}],
        "lore_secrets": [{"title": "The Fire", "text": "It listens."}],
        "moments": [{"authority": "required", "text": "A siren sounds."}],
        "forbidden_rules": [{"authority": "forbidden", "text": "Do not extinguish it."}],
        "story_threads": [{"title": "Mine dispute", "description": "Old families argue."}],
        "story_guidance": {
            "humor": "dry",
            "danger": "slow",
            "violence": "rare",
            "weirdness": "subtle",
            "choice_guidance": "offer practical choices",
            "failure_philosophy": "complications",
        },
        "replayability": {"variable_elements": "weather", "fixed_elements": "mine"},
        "freeform_notes": "Keep the fire uncanny.",
    }

    migrated = normalize_source_document(legacy, document_kind="world")

    assert migrated["schema_version"] == 3
    assert migrated["premise"].startswith("The town")
    assert migrated["world_truths"][0]["text"] == "The mine still burns."
    assert migrated["director_notes"] == "Keep the fire uncanny."
    assert "moments" not in migrated
    assert "replayability" not in migrated
    assert "primary_type" not in migrated["identity"]
    assert migrated["migration"]["legacy_snapshot"] == legacy
    labels = {item["label"] for item in migrated["migration"]["review_queue"]}
    assert "Legacy adventure moments stored on this World" in labels
    assert "Legacy adventure controls stored on this World" in labels


def test_legacy_brief_migration_maps_world_truths_to_local_adventure_facts() -> None:
    legacy = {
        "schema_version": 2,
        "identity": {
            "document_kind": "brief",
            "title": "Storm Night",
            "slug": "storm_night",
            "primary_type": "mystery",
            "secondary_type": "",
            "length": "short",
            "genre": "supernatural",
            "tone": "tense",
            "difficulty": "moderate",
            "weirdness": 3,
            "one_sentence_pitch": "One bad night at the hotel.",
            "player_experience": "Claustrophobic mystery.",
        },
        "premise": "The bridge washes out after the guests arrive.",
        "world_truths": [{"authority": "canon", "text": "The bridge is gone tonight."}],
        "locations": [{"name": "Service Hall"}],
        "npcs": [{"name": "Night Clerk"}],
        "lore_secrets": [],
        "moments": [{"authority": "preferred", "text": "The lights fail."}],
        "forbidden_rules": [],
        "story_threads": [],
        "story_guidance": {},
        "replayability": {},
        "freeform_notes": "Rain against every window.",
    }

    migrated = normalize_source_document(legacy, document_kind="brief")
    assert migrated["starting_situation"].startswith("The bridge")
    assert migrated["adventure_facts"][0]["text"] == "The bridge is gone tonight."
    assert migrated["locations"][0]["name"] == "Service Hall"
    assert migrated["director_notes"] == "Rain against every window."
    assert migrated["world_references"] == {"locations": [], "npcs": [], "lore_secrets": []}
    assert migrated["migration"]["legacy_snapshot"] == legacy


def test_private_notes_never_compile_or_enter_generation_source() -> None:
    brief = default_source_document(
        title="Private",
        slug="private",
        document_kind="brief",
    )
    brief["starting_situation"] = "A storm closes the road."
    brief["director_notes"] = "Use the bell as recurring imagery."
    brief["private_notes"] = "TODO: ask Athena if she likes this ending."

    compiled = compile_source_document(brief)
    visible = generation_source_document(brief)

    assert compiled["director_notes"] == "Use the bell as recurring imagery."
    assert "private_notes" not in compiled
    assert "private_notes" not in visible
    assert "migration" not in visible
    assert "Athena" not in json.dumps(compiled)


def test_world_and_brief_strength_use_different_rubrics() -> None:
    world = default_source_document(title="World", slug="world", document_kind="world")
    brief = default_source_document(title="Brief", slug="brief", document_kind="brief")

    world_sections = assess_document_strength(world)["sections"]
    brief_sections = assess_document_strength(brief)["sections"]

    assert "canon" in world_sections
    assert "rules" in world_sections
    assert "moments" not in world_sections
    assert "world_references" not in world_sections

    assert "starting_situation" in brief_sections
    assert "core_goal" in brief_sections
    assert "moments" in brief_sections
    assert "world_references" in brief_sections
    assert "canon" not in brief_sections


def test_featured_world_references_create_runtime_constraints_without_copying_canon() -> None:
    brief = default_source_document(title="Brief", slug="brief", document_kind="brief")
    brief["world_references"]["locations"] = [{
        "id": "ref-1",
        "source_id": "loc-1",
        "name": "Blackwater Hotel",
        "use": "Primary investigation site",
        "timing": "early",
        "importance": "major",
    }]
    brief["world_references"]["lore_secrets"] = [{
        "id": "ref-2",
        "source_id": "secret-1",
        "title": "The mine fire listens",
        "treatment": "do_not_reveal",
        "timing": "anytime",
        "importance": "critical",
    }]

    required = _world_reference_constraints(brief, "required")
    forbidden = _world_reference_constraints(brief, "forbidden")

    assert any("Blackwater Hotel" in line and "EARLY" in line for line in required)
    assert forbidden == ["Do not reveal featured World secret: The mine fire listens."]
    assert brief["locations"] == []
    assert brief["lore_secrets"] == []


def test_ai_document_schema_changes_with_document_kind_and_context_hides_private_notes() -> None:
    world_name, world_model = AuthorAssistService._schema_for("document", "world")
    brief_name, brief_model = AuthorAssistService._schema_for("document", "brief")

    assert world_name != brief_name
    assert world_model is WorldDocumentAssistDraft
    assert brief_model is BriefDocumentAssistDraft

    brief = default_source_document(title="Brief", slug="brief", document_kind="brief")
    brief["private_notes"] = "NEVER SEND THIS"
    world = default_source_document(title="World", slug="world", document_kind="world")
    world["private_notes"] = "WORLD PRIVATE"

    context = AuthorAssistService._compact_context(
        brief,
        "document",
        linked_world_source=world,
    )
    payload = json.dumps(context)
    assert "NEVER SEND THIS" not in payload
    assert "WORLD PRIVATE" not in payload
    assert "linked_world_read_only" in context


def test_author_ui_exposes_scoped_forms_references_and_private_notes() -> None:
    html = Path("app/web/author/index.html").read_text()
    js = Path("app/web/author/author.js").read_text()

    assert 'data-doc-kind="world"' in html
    assert 'data-doc-kind="brief"' in html
    assert 'data-path="starting_situation"' in html
    assert 'data-path="core_goal"' in html
    assert 'id="world-reference-picker"' in html
    assert 'data-path="director_notes"' in html
    assert 'data-path="private_notes"' in html
    assert "toggleWorldReference" in js
    assert 'control.dataset.path === "private_notes"' in js
    assert "document_id: activeVersion?.document_id" in js


def test_legacy_entity_ids_are_deterministic_for_immutable_published_sources() -> None:
    legacy = {
        "schema_version": 2,
        "identity": {
            "document_kind": "world",
            "title": "Stable World",
            "slug": "stable_world",
        },
        "locations": [{"name": "Blackwater Hotel", "description": "Old stone hotel"}],
        "npcs": [{"name": "Mayor Higgins", "role": "Mayor"}],
        "lore_secrets": [{"title": "Mine Fire", "text": "It listens."}],
    }

    first = normalize_source_document(legacy, document_kind="world")
    second = normalize_source_document(legacy, document_kind="world")

    assert first["locations"][0]["id"] == second["locations"][0]["id"]
    assert first["npcs"][0]["id"] == second["npcs"][0]["id"]
    assert first["lore_secrets"][0]["id"] == second["lore_secrets"][0]["id"]
    assert first["locations"][0]["id"] != first["npcs"][0]["id"]


def test_brief_ai_can_feature_linked_world_entities_but_unknown_ids_are_rejected() -> None:
    _, brief_model = AuthorAssistService._schema_for("document", "brief")
    schema = brief_model.model_json_schema()
    assert "world_references" in schema["properties"]

    world = default_source_document(title="World", slug="world", document_kind="world")
    world["locations"] = [{
        "id": "loc-hotel",
        "name": "Blackwater Hotel",
        "role": "Landmark",
        "description": "",
        "canon": "Owned by the Higgins family.",
        "ai_freedom": "low",
        "importance": "major",
    }]
    proposal = {
        "world_references": {
            "locations": [
                {
                    "source_id": "loc-hotel",
                    "name": "Wrong AI Name",
                    "use": "Primary investigation site",
                    "importance": "major",
                    "timing": "early",
                },
                {
                    "source_id": "invented-id",
                    "name": "Invented Place",
                    "use": "Should be rejected",
                    "importance": "major",
                    "timing": "early",
                },
            ],
            "npcs": [],
            "lore_secrets": [],
        }
    }

    clean = AuthorAssistService._validated_world_reference_proposal(proposal, world)
    assert len(clean["world_references"]["locations"]) == 1
    assert clean["world_references"]["locations"][0]["source_id"] == "loc-hotel"
    assert clean["world_references"]["locations"][0]["name"] == "Blackwater Hotel"


@pytest.mark.asyncio
async def test_new_draft_from_legacy_published_version_is_persisted_as_v3(tmp_path: Path) -> None:
    store = AuthoringStore(tmp_path / "authoring.sqlite3")
    await store.initialize()
    created = await store.create_document(
        title="Legacy World",
        slug="legacy_world",
        document_kind="world",
        parent_document_id=None,
        user_id="author-1",
    )

    legacy = {
        "schema_version": 2,
        "identity": {
            "document_kind": "world",
            "title": "Legacy World",
            "slug": "legacy_world",
        },
        "premise": "Old persisted premise.",
        "locations": [{"name": "Old Hotel"}],
        "freeform_notes": "Legacy generator note.",
    }
    with store._connection() as connection:
        connection.execute(
            """
            UPDATE author_versions
            SET source_json = ?, compiled_json = '{}', strength_json = '{}',
                status = 'published', published_at = updated_at
            WHERE document_id = ? AND version_number = 1
            """,
            (json.dumps(legacy), created["document_id"]),
        )

    projected = await store.get_version(created["document_id"], 1)
    assert projected is not None
    assert projected["source"]["schema_version"] == 3
    assert projected["source"]["director_notes"] == "Legacy generator note."

    with store._connection() as connection:
        historical = json.loads(connection.execute(
            "SELECT source_json FROM author_versions WHERE document_id = ? AND version_number = 1",
            (created["document_id"],),
        ).fetchone()["source_json"])
    assert historical["schema_version"] == 2

    new_draft = await store.create_new_version(
        document_id=created["document_id"],
        user_id="author-1",
    )
    assert new_draft["source"]["schema_version"] == 3

    with store._connection() as connection:
        persisted = json.loads(connection.execute(
            "SELECT source_json FROM author_versions WHERE document_id = ? AND version_number = 2",
            (created["document_id"],),
        ).fetchone()["source_json"])
    assert persisted["schema_version"] == 3
    assert persisted["migration"]["legacy_snapshot"]["schema_version"] == 2


def test_generation_rejects_featured_world_reference_missing_from_selected_world_version() -> None:
    world = default_source_document(title="World", slug="world", document_kind="world")
    world["locations"] = [{
        "id": "loc-published",
        "name": "Published Hotel",
        "role": "Landmark",
        "description": "",
        "canon": "",
        "ai_freedom": "medium",
        "importance": "major",
    }]
    brief = default_source_document(title="Brief", slug="brief", document_kind="brief")
    brief["world_references"]["locations"] = [{
        "id": "ref-1",
        "source_id": "loc-draft-only",
        "name": "Draft Only Mine",
        "use": "Finale location",
        "importance": "major",
        "timing": "late",
        "treatment": "feature",
    }]

    with pytest.raises(ValueError, match="not present in the selected published World version"):
        _validate_featured_world_references(world, brief)

    brief["world_references"]["locations"][0]["source_id"] = "loc-published"
    _validate_featured_world_references(world, brief)
