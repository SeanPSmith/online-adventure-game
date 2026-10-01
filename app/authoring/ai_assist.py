from __future__ import annotations

import copy
import json
import os

from difflib import SequenceMatcher
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.authoring.service import (
    default_source_document,
    normalize_source_document,
)
from app.generation.provider import (
    AdventureGenerationConfigurationError,
    AdventureGenerationResponseError,
)


ASSISTABLE_SECTIONS = (
    "world_truths",
    "locations",
    "npcs",
    "lore_secrets",
    "moments",
    "forbidden_rules",
    "story_threads",
)


AUTHOR_ASSIST_SYSTEM_INSTRUCTIONS = """
You are the private authoring copilot for TALES OF TWO.

You are NOT the runtime story Director. Your job is to turn a creator's rough,
casual note into useful structured source material that a later Director can use.

AUTHORING PRINCIPLES
- Preserve the author's concrete intent, names, dates, relationships, constraints,
  mysteries, tone, and deliberately vague ideas.
- Do not "solve" mysteries the author intentionally left unresolved.
- If the author says an NPC has no name or must remain unnamed, leave the name empty.
- If the author says something should matter later, preserve delayed introduction timing.
- Prefer specific sensory or behavioral detail over generic fantasy filler.
- Do not overbuild. A lightweight brief should remain lightweight.
- Do not invent mechanical outcomes, dice results, player actions, or completed scenes.
- Canon and forbidden rules in the supplied source outrank the rough note.
- Existing authored fields are context. The server decides what generated values are
  actually allowed to replace.
- Empty strings and empty lists are acceptable when the rough note does not justify
  filling a field. Do not manufacture filler just to make every field non-empty.

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


class IdentityAssistDraft(_StrictModel):
    title: str = Field(max_length=160)
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
    genre: str = Field(max_length=160)
    tone: str = Field(max_length=240)
    difficulty: Literal[
        "introductory",
        "easy",
        "moderate",
        "hard",
        "brutal",
    ]
    weirdness: int = Field(ge=0, le=5)
    one_sentence_pitch: str = Field(max_length=500)
    player_experience: str = Field(max_length=900)


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


class NpcAssistDraft(_StrictModel):
    name: str = Field(max_length=160)
    role: str = Field(max_length=240)
    availability: Literal["flexible", "reserved", "unavailable"]
    introduction_timing: Literal["anytime", "early", "mid", "late", "finale"]
    occupation: str = Field(max_length=240)
    appearance: str = Field(max_length=900)
    personality: str = Field(max_length=900)
    wants: str = Field(max_length=900)
    knows: str = Field(max_length=1200)
    secret: str = Field(max_length=1200)
    relationship: str = Field(max_length=900)
    canonical_facts: str = Field(max_length=1400)
    introduction_conditions: str = Field(max_length=900)
    location_constraints: str = Field(max_length=900)
    forbidden_uses: str = Field(max_length=900)
    ai_freedom: Literal["low", "medium", "high"]
    importance: Importance
    recurring: bool


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


class ReplayabilityAssistDraft(_StrictModel):
    variable_elements: str = Field(max_length=900)
    fixed_elements: str = Field(max_length=900)
    notes: str = Field(max_length=900)


class AuthorDocumentAssistDraft(_StrictModel):
    identity: IdentityAssistDraft
    premise: str = Field(max_length=1800)
    world_truths: list[WorldTruthAssistDraft] = Field(max_length=6)
    locations: list[LocationAssistDraft] = Field(max_length=5)
    npcs: list[NpcAssistDraft] = Field(max_length=5)
    lore_secrets: list[LoreSecretAssistDraft] = Field(max_length=5)
    moments: list[MomentAssistDraft] = Field(max_length=5)
    forbidden_rules: list[ForbiddenRuleAssistDraft] = Field(max_length=5)
    story_threads: list[StoryThreadAssistDraft] = Field(max_length=5)
    story_guidance: StoryGuidanceAssistDraft
    replayability: ReplayabilityAssistDraft
    freeform_notes: str = Field(max_length=1400)


SECTION_MODELS: dict[str, type[_StrictModel]] = {
    "world_truths": WorldTruthAssistDraft,
    "locations": LocationAssistDraft,
    "npcs": NpcAssistDraft,
    "lore_secrets": LoreSecretAssistDraft,
    "moments": MomentAssistDraft,
    "forbidden_rules": ForbiddenRuleAssistDraft,
    "story_threads": StoryThreadAssistDraft,
}


SECTION_DEFAULTS: dict[str, dict[str, Any]] = {
    "world_truths": {
        "authority": "canon",
        "text": "",
    },
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
    "moments": {
        "authority": "preferred",
        "text": "",
    },
    "forbidden_rules": {
        "authority": "forbidden",
        "text": "",
    },
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
    def _schema_for(section: str) -> tuple[str, type[_StrictModel]]:
        if section == "document":
            return "author_document_assist", AuthorDocumentAssistDraft

        model = SECTION_MODELS.get(section)
        if model is None:
            raise ValueError("Unknown AI authoring section.")

        return f"author_{section}_assist", model

    @staticmethod
    def _compact_context(source: dict[str, Any], section: str) -> dict[str, Any]:
        if section == "document":
            return source

        def compact_items(name: str, keys: tuple[str, ...]) -> list[dict[str, Any]]:
            items = source.get(name, [])
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

        return {
            "identity": source.get("identity", {}),
            "premise": source.get("premise", ""),
            "world_truths": compact_items(
                "world_truths",
                ("authority", "text"),
            ),
            "locations": compact_items(
                "locations",
                ("name", "role", "canon", "importance"),
            ),
            "npcs": compact_items(
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
                "lore_secrets",
                ("title", "text", "authority", "importance"),
            ),
            "forbidden_rules": compact_items(
                "forbidden_rules",
                ("text",),
            ),
        }

    async def _request(
        self,
        *,
        section: str,
        instruction: str,
        source: dict[str, Any],
        current_item: dict[str, Any] | None,
    ) -> dict[str, Any]:
        schema_name, model_type = self._schema_for(section)
        client = self._client_instance()

        payload = {
            "task": "expand_author_note",
            "scope": section,
            "author_note": instruction.strip(),
            "current_item": current_item,
            "source_context": self._compact_context(source, section),
        }

        try:
            response = await client.responses.create(
                model=self.model,
                instructions=AUTHOR_ASSIST_SYSTEM_INSTRUCTIONS,
                input=(
                    "Expand this author note into the requested structured authoring data.\n\n"
                    + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                ),
                reasoning={"effort": self.reasoning},
                max_output_tokens=self.max_output_tokens,
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

    async def assist(
        self,
        *,
        source: dict[str, Any],
        instruction: str,
        section: str = "document",
        item_index: int | None = None,
    ) -> dict[str, Any]:
        normalized = normalize_source_document(source)
        instruction = str(instruction or "").strip()

        if not instruction:
            raise ValueError("Give the AI helper a rough note first.")

        if section == "document":
            proposal = await self._request(
                section=section,
                instruction=instruction,
                source=normalized,
                current_item=None,
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
