from __future__ import annotations

import copy
import json
import os
import re

from difflib import SequenceMatcher
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.authoring.service import (
    default_source_document,
    generation_source_document,
    normalize_source_document,
)
from app.generation.provider import (
    AdventureGenerationConfigurationError,
    AdventureGenerationResponseError,
)


ASSISTABLE_SECTIONS = (
    "world_truths",
    "world_rules",
    "adventure_facts",
    "locations",
    "npcs",
    "lore_secrets",
    "moments",
    "forbidden_rules",
    "story_threads",
)


AUTHOR_ASSIST_SYSTEM_INSTRUCTIONS = """
You are the private authoring copilot for TALES OF TWO.

You are NOT the runtime story Director. Turn a creator's rough, casual note
into useful structured source material that a later Director can use.

SCOPE RULES
- WORLD documents define durable nouns and laws: setting facts, places, recurring
  people/factions, lore, world rules, ongoing tensions, and canon boundaries.
- ADVENTURE BRIEFS define one run: starting situation, core goal/pressure, local
  facts, featured world material, adventure-only cast/locations/secrets, moments,
  restrictions, choice guidance, and replayability.
- If linked World context is supplied for a Brief, treat it as read-only canon.
  Prefer selecting relevant items into world_references by the exact supplied source_id
  instead of restating or rewriting their biographies/lore in adventure-local fields.
- Never invent a world_references source_id. The server validates every proposed reference
  against the linked World and discards unknown IDs.
- Never turn a World NPC into an adventure beat by inventing introduction timing.
- Never promote an Adventure-local fact into permanent World canon.
- PRIVATE AUTHOR NOTES are never provided to you and must never be inferred.

AUTHORING PRINCIPLES
- Preserve the author's names, dates, relationships, constraints, mysteries, tone,
  and deliberately vague ideas.
- Do not solve mysteries the author intentionally left unresolved.
- If an NPC must remain unnamed, leave the name empty.
- Prefer concrete sensory/behavioral detail over generic genre filler.
- Do not overbuild. A lightweight brief should remain lightweight.
- Do not invent mechanical outcomes, dice results, player actions, or completed scenes.
- Canon and forbidden rules in supplied source outrank the rough note.
- Existing authored fields are context; the server decides what generated values
  may actually replace.
- Empty strings/lists are acceptable when the note does not justify filling them.

Return only the structured object requested by the response schema.
""".strip()


Authority = Literal[
    "canon",
    "required",
    "preferred",
    "inspiration",
    "forbidden",
]

Importance = Literal[
    "minor",
    "supporting",
    "major",
    "critical",
]


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AuthorFieldAssistDraft(_StrictModel):
    value: str = Field(max_length=2400)


class WorldIdentityAssistDraft(_StrictModel):
    title: str = Field(max_length=160)
    genre: str = Field(max_length=160)
    tone: str = Field(max_length=240)
    weirdness: int = Field(ge=0, le=5)
    one_sentence_pitch: str = Field(max_length=500)
    player_experience: str = Field(max_length=900)


class BriefIdentityAssistDraft(WorldIdentityAssistDraft):
    primary_type: Literal[
        "journey",
        "mystery",
        "expedition",
        "quest",
        "survival",
        "escape_heist",
        "social_intrigue",
    ]
    secondary_type: str = Field(max_length=80)
    length: Literal["short", "medium", "long"]
    difficulty: Literal[
        "introductory",
        "easy",
        "moderate",
        "hard",
        "brutal",
    ]


# Compatibility name used by a few tests/extensions that treated the old shared
# identity model as the adventure identity model.
IdentityAssistDraft = BriefIdentityAssistDraft


class WorldTruthAssistDraft(_StrictModel):
    authority: Authority
    text: str = Field(max_length=900)


class LocationAssistDraft(_StrictModel):
    name: str = Field(max_length=160)
    role: str = Field(max_length=180)
    description: str = Field(max_length=1200)
    canon: str = Field(max_length=1200)
    ai_freedom: Literal["low", "medium", "high"]
    importance: Importance


class WorldNpcAssistDraft(_StrictModel):
    name: str = Field(max_length=160)
    role: str = Field(max_length=240)
    occupation: str = Field(max_length=240)
    appearance: str = Field(max_length=900)
    personality: str = Field(max_length=900)
    wants: str = Field(max_length=900)
    knows: str = Field(max_length=1200)
    secret: str = Field(max_length=1200)
    relationship: str = Field(max_length=900)
    canonical_facts: str = Field(max_length=1400)
    location_constraints: str = Field(max_length=900)
    forbidden_uses: str = Field(max_length=900)
    ai_freedom: Literal["low", "medium", "high"]
    importance: Importance
    recurring: bool


class NpcAssistDraft(WorldNpcAssistDraft):
    availability: Literal["flexible", "reserved", "unavailable"]
    introduction_timing: Literal["anytime", "early", "mid", "late", "finale"]
    introduction_conditions: str = Field(max_length=900)


class LoreSecretAssistDraft(_StrictModel):
    title: str = Field(max_length=180)
    text: str = Field(max_length=1400)
    authority: Authority
    who_knows: str = Field(max_length=500)
    importance: Importance
    reveal_guidance: str = Field(max_length=900)
    ai_can_alter: bool


class MomentAssistDraft(_StrictModel):
    authority: Authority
    text: str = Field(max_length=900)


class ForbiddenRuleAssistDraft(_StrictModel):
    authority: Literal["forbidden"]
    text: str = Field(max_length=900)


class StoryThreadAssistDraft(_StrictModel):
    title: str = Field(max_length=180)
    description: str = Field(max_length=1200)
    importance: Importance
    recurrence: Literal["optional", "recurring", "must_resolve"]


class StoryGuidanceAssistDraft(_StrictModel):
    humor: str = Field(max_length=700)
    danger: str = Field(max_length=700)
    violence: str = Field(max_length=700)
    weirdness: str = Field(max_length=700)
    choice_guidance: str = Field(max_length=1100)
    failure_philosophy: str = Field(max_length=900)


class WorldStoryGuidanceAssistDraft(_StrictModel):
    humor: str = Field(max_length=700)
    danger: str = Field(max_length=700)
    violence: str = Field(max_length=700)
    weirdness: str = Field(max_length=700)


class ReplayabilityAssistDraft(_StrictModel):
    variable_elements: str = Field(max_length=900)
    fixed_elements: str = Field(max_length=900)
    notes: str = Field(max_length=900)


class FeaturedWorldLocationAssistDraft(_StrictModel):
    source_id: str = Field(max_length=120)
    name: str = Field(max_length=160)
    use: str = Field(max_length=900)
    importance: Importance
    timing: Literal["anytime", "early", "mid", "late", "finale"]


class FeaturedWorldNpcAssistDraft(_StrictModel):
    source_id: str = Field(max_length=120)
    name: str = Field(max_length=160)
    use: str = Field(max_length=900)
    importance: Importance
    timing: Literal["anytime", "early", "mid", "late", "finale"]


class FeaturedWorldSecretAssistDraft(_StrictModel):
    source_id: str = Field(max_length=120)
    title: str = Field(max_length=180)
    use: str = Field(max_length=900)
    importance: Importance
    timing: Literal["anytime", "early", "mid", "late", "finale"]
    treatment: Literal["do_not_reveal", "foreshadow", "may_reveal", "must_reveal"]


class FeaturedWorldContentAssistDraft(_StrictModel):
    locations: list[FeaturedWorldLocationAssistDraft] = Field(max_length=5)
    npcs: list[FeaturedWorldNpcAssistDraft] = Field(max_length=5)
    lore_secrets: list[FeaturedWorldSecretAssistDraft] = Field(max_length=5)


class WorldDocumentAssistDraft(_StrictModel):
    identity: WorldIdentityAssistDraft
    premise: str = Field(max_length=1800)
    world_truths: list[WorldTruthAssistDraft] = Field(max_length=6)
    world_rules: list[WorldTruthAssistDraft] = Field(max_length=5)
    locations: list[LocationAssistDraft] = Field(max_length=5)
    npcs: list[WorldNpcAssistDraft] = Field(max_length=5)
    lore_secrets: list[LoreSecretAssistDraft] = Field(max_length=5)
    forbidden_rules: list[ForbiddenRuleAssistDraft] = Field(max_length=5)
    story_threads: list[StoryThreadAssistDraft] = Field(max_length=5)
    story_guidance: WorldStoryGuidanceAssistDraft
    director_notes: str = Field(max_length=1400)


class BriefDocumentAssistDraft(_StrictModel):
    identity: BriefIdentityAssistDraft
    starting_situation: str = Field(max_length=1800)
    core_goal: str = Field(max_length=900)
    adventure_facts: list[WorldTruthAssistDraft] = Field(max_length=6)
    world_references: FeaturedWorldContentAssistDraft
    locations: list[LocationAssistDraft] = Field(max_length=5)
    npcs: list[NpcAssistDraft] = Field(max_length=5)
    lore_secrets: list[LoreSecretAssistDraft] = Field(max_length=5)
    moments: list[MomentAssistDraft] = Field(max_length=5)
    forbidden_rules: list[ForbiddenRuleAssistDraft] = Field(max_length=5)
    story_threads: list[StoryThreadAssistDraft] = Field(max_length=5)
    story_guidance: StoryGuidanceAssistDraft
    replayability: ReplayabilityAssistDraft
    director_notes: str = Field(max_length=1400)


# Compatibility alias. Dynamic schema selection below chooses the actual kind.
AuthorDocumentAssistDraft = BriefDocumentAssistDraft


COMMON_SECTION_MODELS: dict[str, type[_StrictModel]] = {
    "world_truths": WorldTruthAssistDraft,
    "world_rules": WorldTruthAssistDraft,
    "adventure_facts": WorldTruthAssistDraft,
    "locations": LocationAssistDraft,
    "lore_secrets": LoreSecretAssistDraft,
    "moments": MomentAssistDraft,
    "forbidden_rules": ForbiddenRuleAssistDraft,
    "story_threads": StoryThreadAssistDraft,
}


SIMPLE_TEXT_FIELD_PATHS = {
    "identity.title",
    "identity.genre",
    "identity.tone",
    "identity.one_sentence_pitch",
    "identity.player_experience",
    "premise",
    "starting_situation",
    "core_goal",
    "story_guidance.humor",
    "story_guidance.danger",
    "story_guidance.violence",
    "story_guidance.weirdness",
    "story_guidance.choice_guidance",
    "replayability.variable_elements",
    "replayability.fixed_elements",
    "replayability.notes",
    "director_notes",
}


REPEAT_TEXT_FIELDS: dict[str, set[str]] = {
    "world_truths": {"text"},
    "world_rules": {"text"},
    "adventure_facts": {"text"},
    "locations": {"name", "role", "description", "canon"},
    "npcs": {
        "name",
        "role",
        "occupation",
        "appearance",
        "personality",
        "wants",
        "knows",
        "secret",
        "relationship",
        "canonical_facts",
        "introduction_conditions",
        "location_constraints",
        "forbidden_uses",
    },
    "lore_secrets": {
        "title",
        "text",
        "who_knows",
        "reveal_guidance",
    },
    "moments": {"text"},
    "forbidden_rules": {"text"},
    "story_threads": {"title", "description"},
}


_REPEAT_FIELD_PATH = re.compile(
    r"^(?P<section>[a-z_]+)\[(?P<index>\d+)\]\.(?P<key>[a-z_]+)$"
)


SECTION_DEFAULTS: dict[str, dict[str, Any]] = {
    "world_truths": {"authority": "canon", "text": ""},
    "world_rules": {"authority": "canon", "text": ""},
    "adventure_facts": {"authority": "canon", "text": ""},
    "locations": {
        "name": "",
        "role": "",
        "description": "",
        "canon": "",
        "ai_freedom": "medium",
        "importance": "supporting",
    },
    "npcs": {
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
    },
    "lore_secrets": {
        "title": "",
        "text": "",
        "authority": "inspiration",
        "who_knows": "",
        "importance": "supporting",
        "reveal_guidance": "",
        "ai_can_alter": True,
    },
    "moments": {"authority": "preferred", "text": ""},
    "forbidden_rules": {"authority": "forbidden", "text": ""},
    "story_threads": {
        "title": "",
        "description": "",
        "importance": "supporting",
        "recurrence": "optional",
    },
}


class AuthorAssistService:
    def __init__(self) -> None:
        self.model = (
            os.getenv("TOT_OPENAI_ECONOMY_MODEL", "gpt-5.6-luna").strip()
            or "gpt-5.6-luna"
        )
        self.reasoning = (
            os.getenv("TOT_OPENAI_ECONOMY_REASONING", "low").strip()
            or "low"
        )
        self.max_output_tokens = self._bounded_int_env(
            "TOT_OPENAI_AUTHOR_MAX_OUTPUT_TOKENS",
            default=4500,
            minimum=1000,
            maximum=8000,
        )
        self.timeout_seconds = self._bounded_int_env(
            "TOT_OPENAI_AUTHOR_TIMEOUT_SECONDS",
            default=60,
            minimum=15,
            maximum=180,
        )
        self._client = None

    @staticmethod
    def _bounded_int_env(
        name: str,
        *,
        default: int,
        minimum: int,
        maximum: int,
    ) -> int:
        raw = os.getenv(name, "").strip()
        if not raw:
            return default
        try:
            value = int(raw)
        except ValueError:
            return default
        return max(minimum, min(maximum, value))

    def _client_instance(self):
        if self._client is not None:
            return self._client

        if not os.getenv("OPENAI_API_KEY"):
            raise AdventureGenerationConfigurationError(
                "OPENAI_API_KEY is not configured."
            )

        try:
            from openai import AsyncOpenAI
        except ImportError as error:
            raise AdventureGenerationConfigurationError(
                "The OpenAI Python SDK is not installed."
            ) from error

        self._client = AsyncOpenAI(timeout=float(self.timeout_seconds))
        return self._client

    @staticmethod
    def _schema_for(
        section: str,
        document_kind: str,
    ) -> tuple[str, type[_StrictModel]]:
        if section == "document":
            if document_kind == "world":
                return "author_world_document_assist", WorldDocumentAssistDraft
            return "author_brief_document_assist", BriefDocumentAssistDraft

        if section == "field":
            return "author_field_assist", AuthorFieldAssistDraft

        if section == "npcs":
            model: type[_StrictModel] = (
                WorldNpcAssistDraft
                if document_kind == "world"
                else NpcAssistDraft
            )
            return f"author_{document_kind}_npcs_assist", model

        model = COMMON_SECTION_MODELS.get(section)
        if model is None:
            raise ValueError("Unknown AI authoring section.")
        return f"author_{section}_assist", model

    @staticmethod
    def _compact_context(
        source: dict[str, Any],
        section: str,
        *,
        linked_world_source: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        visible_source = generation_source_document(source)

        def compact_items(
            container: dict[str, Any],
            name: str,
            keys: tuple[str, ...],
        ) -> list[dict[str, Any]]:
            items = container.get(name, [])
            if not isinstance(items, list):
                return []
            compacted: list[dict[str, Any]] = []
            for item in items[:12]:
                if not isinstance(item, dict):
                    continue
                compacted.append({
                    key: item.get(key, "")
                    for key in keys
                    if item.get(key) not in (None, "", [])
                })
            return compacted

        context: dict[str, Any]
        if section == "document":
            context = visible_source
        else:
            context = {
                "identity": visible_source.get("identity", {}),
                "premise": visible_source.get("premise", ""),
                "starting_situation": visible_source.get("starting_situation", ""),
                "core_goal": visible_source.get("core_goal", ""),
                "world_truths": compact_items(
                    visible_source, "world_truths", ("authority", "text")
                ),
                "world_rules": compact_items(
                    visible_source, "world_rules", ("authority", "text")
                ),
                "adventure_facts": compact_items(
                    visible_source, "adventure_facts", ("authority", "text")
                ),
                "world_references": visible_source.get("world_references", {}),
                "locations": compact_items(
                    visible_source,
                    "locations",
                    ("name", "role", "canon", "importance"),
                ),
                "npcs": compact_items(
                    visible_source,
                    "npcs",
                    (
                        "name",
                        "role",
                        "occupation",
                        "canonical_facts",
                        "introduction_timing",
                        "importance",
                    ),
                ),
                "lore_secrets": compact_items(
                    visible_source,
                    "lore_secrets",
                    ("title", "text", "authority", "importance"),
                ),
                "forbidden_rules": compact_items(
                    visible_source, "forbidden_rules", ("text",)
                ),
            }

        if linked_world_source is not None:
            world = generation_source_document(linked_world_source)
            context = {
                "current_document": context,
                "linked_world_read_only": {
                    "identity": world.get("identity", {}),
                    "premise": world.get("premise", ""),
                    "world_truths": compact_items(
                        world, "world_truths", ("authority", "text")
                    ),
                    "world_rules": compact_items(
                        world, "world_rules", ("authority", "text")
                    ),
                    "locations": compact_items(
                        world,
                        "locations",
                        ("id", "name", "role", "canon", "importance"),
                    ),
                    "npcs": compact_items(
                        world,
                        "npcs",
                        ("id", "name", "role", "occupation", "canonical_facts"),
                    ),
                    "lore_secrets": compact_items(
                        world,
                        "lore_secrets",
                        ("id", "title", "text", "authority", "importance"),
                    ),
                    "forbidden_rules": compact_items(
                        world, "forbidden_rules", ("text",)
                    ),
                },
            }

        return context

    async def _request(
        self,
        *,
        section: str,
        instruction: str,
        source: dict[str, Any],
        current_item: dict[str, Any] | None,
        field_path: str | None = None,
        linked_world_source: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        document_kind = str(
            source.get("identity", {}).get("document_kind", "world")
        ).strip().lower()
        schema_name, model_type = self._schema_for(section, document_kind)
        client = self._client_instance()

        payload = {
            "task": (
                "expand_single_author_field"
                if section == "field"
                else "expand_author_note"
            ),
            "scope": section,
            "field_path": field_path,
            "author_note": instruction.strip(),
            "current_item": current_item,
            "document_kind": document_kind,
            "source_context": self._compact_context(
                source,
                section,
                linked_world_source=linked_world_source,
            ),
        }

        task_instruction = (
            "Rewrite only the requested author field from the one-sentence note. "
            "Use the current field value and surrounding source as context. Preserve "
            "canon, uncertainty, delayed reveals, and intentionally unnamed elements. "
            "Return useful source prose, not player-facing narration.\n\n"
            if section == "field"
            else (
                "Expand this author note into WORLD source material only. Do not invent "
                "adventure-specific beats, timing, or run controls.\n\n"
                if document_kind == "world"
                else "Expand this author note into this ADVENTURE BRIEF only. Use linked "
                "World material as read-only context instead of duplicating it. When a linked "
                "World item should be featured, select it through world_references using the exact "
                "source_id provided in context; do not recreate that item locally.\n\n"
            )
        )

        try:
            response = await client.responses.create(
                model=self.model,
                instructions=AUTHOR_ASSIST_SYSTEM_INSTRUCTIONS,
                input=(
                    task_instruction
                    + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                ),
                reasoning={"effort": self.reasoning},
                max_output_tokens=(
                    min(self.max_output_tokens, 1400)
                    if section == "field"
                    else self.max_output_tokens
                ),
                text={
                    "format": {
                        "type": "json_schema",
                        "name": schema_name,
                        "description": (
                            "Structured Tales of Two authoring material generated from a rough creator note."
                        ),
                        "strict": True,
                        "schema": model_type.model_json_schema(),
                    },
                },
                store=False,
            )
        except AdventureGenerationConfigurationError:
            raise
        except Exception as error:
            raise AdventureGenerationResponseError(
                f"Author AI assist failed: {type(error).__name__}."
            ) from error

        output_text = (getattr(response, "output_text", "") or "").strip()
        if not output_text:
            raise AdventureGenerationResponseError(
                "Author AI assist returned no structured content."
            )

        try:
            raw = json.loads(output_text)
            proposal = model_type.model_validate(raw)
        except (json.JSONDecodeError, ValidationError) as error:
            raise AdventureGenerationResponseError(
                "Author AI assist returned invalid structured content."
            ) from error

        return proposal.model_dump(mode="json")

    @staticmethod
    def _is_blank(value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, str):
            return not value.strip()
        if isinstance(value, list):
            return len(value) == 0
        return False

    @classmethod
    def _should_replace_scalar(
        cls,
        *,
        current: Any,
        baseline: Any,
        generated: Any,
    ) -> bool:
        if cls._is_blank(generated):
            return False
        if cls._is_blank(current):
            return True
        return current == baseline

    @staticmethod
    def _with_item_id(item: dict[str, Any]) -> dict[str, Any]:
        result = copy.deepcopy(item)
        result.setdefault("id", str(uuid4()))
        return result

    @staticmethod
    def _validated_world_reference_proposal(
        proposal: dict[str, Any],
        linked_world_source: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Allow Brief AI to select World entities, never to invent them.

        The model sees compact linked-World IDs, but the server remains authoritative:
        unknown IDs are discarded and canonical display labels are copied from the
        linked World rather than trusted from model output.
        """
        result = copy.deepcopy(proposal)
        proposed = result.get("world_references")
        if not isinstance(proposed, dict):
            return result

        if linked_world_source is None:
            result["world_references"] = {
                "locations": [],
                "npcs": [],
                "lore_secrets": [],
            }
            return result

        world = generation_source_document(linked_world_source)
        sanitized: dict[str, list[dict[str, Any]]] = {}

        for key in ("locations", "npcs", "lore_secrets"):
            world_items = world.get(key, [])
            valid = {
                str(item.get("id")): item
                for item in world_items
                if isinstance(item, dict) and str(item.get("id", "")).strip()
            }
            clean_items: list[dict[str, Any]] = []
            seen: set[str] = set()
            for item in proposed.get(key, []) if isinstance(proposed.get(key), list) else []:
                if not isinstance(item, dict):
                    continue
                source_id = str(item.get("source_id", "")).strip()
                canonical = valid.get(source_id)
                if canonical is None or source_id in seen:
                    continue
                seen.add(source_id)
                clean = copy.deepcopy(item)
                clean["source_id"] = source_id
                if key == "lore_secrets":
                    clean["title"] = str(
                        canonical.get("title")
                        or canonical.get("text")
                        or "Untitled secret"
                    )
                else:
                    clean["name"] = str(
                        canonical.get("name")
                        or canonical.get("role")
                        or "Unnamed item"
                    )
                clean_items.append(clean)
            sanitized[key] = clean_items

        result["world_references"] = sanitized
        return result


    @classmethod
    def _merge_document_proposal(
        cls,
        source: dict[str, Any],
        proposal: dict[str, Any],
        instruction: str = "",
    ) -> tuple[dict[str, Any], list[str]]:
        current = normalize_source_document(source)
        result = copy.deepcopy(current)
        identity = current.get("identity", {})
        baseline = default_source_document(
            title=str(identity.get("title", "")),
            slug=str(identity.get("slug", "")),
            document_kind=str(identity.get("document_kind", "world")),
        )
        changed: list[str] = []

        def merge_dict(
            target: dict[str, Any],
            original: dict[str, Any],
            defaults: dict[str, Any],
            generated: dict[str, Any],
            prefix: str,
            *,
            protected: set[str] | None = None,
        ) -> None:
            protected = protected or set()
            for key, generated_value in generated.items():
                if key in protected:
                    continue
                path = f"{prefix}.{key}" if prefix else key
                original_value = original.get(key)
                baseline_value = defaults.get(key)

                if (
                    isinstance(generated_value, dict)
                    and isinstance(target.get(key), dict)
                ):
                    merge_dict(
                        target[key],
                        original_value if isinstance(original_value, dict) else {},
                        baseline_value if isinstance(baseline_value, dict) else {},
                        generated_value,
                        path,
                    )
                    continue

                if isinstance(generated_value, list):
                    if (
                        isinstance(original_value, list)
                        and not original_value
                        and generated_value
                    ):
                        target[key] = [
                            cls._with_item_id(item)
                            if isinstance(item, dict)
                            else copy.deepcopy(item)
                            for item in generated_value
                        ]
                        changed.append(path)
                    continue

                if cls._should_replace_scalar(
                    current=original_value,
                    baseline=baseline_value,
                    generated=generated_value,
                ):
                    target[key] = copy.deepcopy(generated_value)
                    changed.append(path)

        merge_dict(
            result,
            current,
            baseline,
            proposal,
            "",
            protected={"schema_version"},
        )

        # Never allow AI assistance to re-identify the persisted source document.
        result["identity"]["title"] = current["identity"].get("title", "")
        result["identity"]["slug"] = current["identity"].get("slug", "")
        result["identity"]["document_kind"] = current["identity"].get(
            "document_kind",
            "world",
        )

        changed = [
            path
            for path in changed
            if path not in {
                "identity.title",
                "identity.slug",
                "identity.document_kind",
            }
        ]

        return normalize_source_document(result), changed

    @staticmethod
    def _npc_requires_no_name(
        item: dict[str, Any],
        instruction: str = "",
    ) -> bool:
        text = (
            str(instruction or "")
            + " "
            + " ".join(
                str(item.get(key, ""))
                for key in (
                "role",
                "canonical_facts",
                "forbidden_uses",
                    "introduction_conditions",
                )
            )
        ).casefold()

        return any(
            phrase in text
            for phrase in (
                "unnamed",
                "no name",
                "without a name",
                "never be given a proper name",
                "must not be named",
                "nameless",
            )
        )


    @classmethod
    def _merge_item_proposal(
        cls,
        source: dict[str, Any],
        *,
        section: str,
        item_index: int,
        proposal: dict[str, Any],
        instruction: str = "",
    ) -> tuple[dict[str, Any], list[str]]:
        result = normalize_source_document(source)
        items = result.get(section)

        if not isinstance(items, list) or item_index < 0 or item_index >= len(items):
            raise ValueError("The requested author item no longer exists.")

        current_item = copy.deepcopy(items[item_index])
        baseline = SECTION_DEFAULTS[section]
        merged = copy.deepcopy(current_item)
        changed: list[str] = []

        for key, generated_value in proposal.items():
            if key == "id":
                continue

            if (
                section == "npcs"
                and key == "name"
                and cls._npc_requires_no_name(
                    current_item,
                    instruction,
                )
            ):
                continue

            current_value = current_item.get(key)
            baseline_value = baseline.get(key)

            if cls._should_replace_scalar(
                current=current_value,
                baseline=baseline_value,
                generated=generated_value,
            ):
                merged[key] = copy.deepcopy(generated_value)
                changed.append(f"{section}[{item_index}].{key}")

        merged["id"] = current_item.get("id") or str(uuid4())
        items[item_index] = merged

        return normalize_source_document(result), changed

    @classmethod
    def _resolve_text_field(
        cls,
        source: dict[str, Any],
        field_path: str,
    ) -> tuple[str, dict[str, Any] | None]:
        path = str(field_path or "").strip()

        if path in SIMPLE_TEXT_FIELD_PATHS:
            current: Any = source
            parts = path.split(".")
            for part in parts:
                if not isinstance(current, dict) or part not in current:
                    raise ValueError("That author field no longer exists.")
                current = current[part]
            return str(current or ""), None

        match = _REPEAT_FIELD_PATH.fullmatch(path)
        if match is None:
            raise ValueError("That field is not available to the AI helper.")

        section = match.group("section")
        index = int(match.group("index"))
        key = match.group("key")

        if key not in REPEAT_TEXT_FIELDS.get(section, set()):
            raise ValueError("That field is not available to the AI helper.")

        items = source.get(section)
        if not isinstance(items, list) or index < 0 or index >= len(items):
            raise ValueError("That author item no longer exists.")

        item = items[index]
        if not isinstance(item, dict) or key not in item:
            raise ValueError("That author field no longer exists.")

        return str(item.get(key, "") or ""), copy.deepcopy(item)

    @classmethod
    def _apply_text_field(
        cls,
        source: dict[str, Any],
        field_path: str,
        value: str,
    ) -> tuple[dict[str, Any], list[str]]:
        normalized = normalize_source_document(source)
        value = str(value or "").strip()
        if not value:
            raise ValueError("AI returned an empty field value.")

        current_value, _ = cls._resolve_text_field(normalized, field_path)
        if current_value.strip() == value:
            return normalized, []

        path = str(field_path or "").strip()
        if path in SIMPLE_TEXT_FIELD_PATHS:
            target: Any = normalized
            parts = path.split(".")
            for part in parts[:-1]:
                target = target[part]
            target[parts[-1]] = value
            return normalize_source_document(normalized), [path]

        match = _REPEAT_FIELD_PATH.fullmatch(path)
        if match is None:
            raise ValueError("That field is not available to the AI helper.")

        section = match.group("section")
        index = int(match.group("index"))
        key = match.group("key")
        normalized[section][index][key] = value
        return normalize_source_document(normalized), [path]

    async def assist(
        self,
        *,
        source: dict[str, Any],
        instruction: str,
        section: str = "document",
        item_index: int | None = None,
        field_path: str | None = None,
        linked_world_source: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized = normalize_source_document(source)
        instruction = str(instruction or "").strip()

        if not instruction:
            raise ValueError("Give the AI helper a rough note first.")

        if section == "field":
            if not field_path:
                raise ValueError("An author field path is required.")

            current_value, current_item = self._resolve_text_field(
                normalized,
                field_path,
            )
            proposal = await self._request(
                section=section,
                instruction=instruction,
                source=normalized,
                current_item={
                    "field_path": field_path,
                    "current_value": current_value,
                    "item": current_item,
                },
                field_path=field_path,
                linked_world_source=linked_world_source,
            )
            merged, changed = self._apply_text_field(
                normalized,
                field_path,
                proposal.get("value", ""),
            )

        elif section == "document":
            proposal = await self._request(
                section=section,
                instruction=instruction,
                source=normalized,
                current_item=None,
                linked_world_source=linked_world_source,
            )
            if normalized.get("identity", {}).get("document_kind") == "brief":
                proposal = self._validated_world_reference_proposal(
                    proposal,
                    linked_world_source,
                )
            merged, changed = self._merge_document_proposal(
                normalized,
                proposal,
            )
        else:
            if section not in ASSISTABLE_SECTIONS:
                raise ValueError("Unknown AI authoring section.")
            if item_index is None:
                raise ValueError("An author item index is required.")

            items = normalized.get(section)
            if (
                not isinstance(items, list)
                or item_index < 0
                or item_index >= len(items)
            ):
                raise ValueError("The requested author item no longer exists.")

            current_item = copy.deepcopy(items[item_index])
            proposal = await self._request(
                section=section,
                instruction=instruction,
                source=normalized,
                current_item=current_item,
                linked_world_source=linked_world_source,
            )
            merged, changed = self._merge_item_proposal(
                normalized,
                section=section,
                item_index=item_index,
                proposal=proposal,
                instruction=instruction,
            )

        return {
            "source": merged,
            "changed_paths": changed,
            "model": self.model,
            "reasoning": self.reasoning,
        }


author_assist_service = AuthorAssistService()
