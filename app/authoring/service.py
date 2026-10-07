from __future__ import annotations

import copy
import hmac
import json
import os
import re

from typing import Any
from uuid import NAMESPACE_URL, uuid5


DOCUMENT_KINDS = (
    "world",
    "brief",
)


def _env_csv(
    name: str,
) -> tuple[str, ...]:

    raw = os.getenv(
        name,
        "",
    )

    return tuple(
        value.strip()
        for value
        in raw.split(",")
        if value.strip()
    )


class AuthorAccessPolicy:

    def configured(
        self,
    ) -> bool:

        return bool(
            _env_csv(
                "TOT_AUTHOR_USER_IDS"
            )
            or _env_csv(
                "TOT_AUTHOR_USERNAMES"
            )
        )


    def allows(
        self,
        user,
    ) -> bool:

        if user is None:

            return False


        if (
            hasattr(
                user,
                "has_permission",
            )
            and user.has_permission(
                "author"
            )
        ):

            return True


        for allowed_user_id in (
            _env_csv(
                "TOT_AUTHOR_USER_IDS"
            )
        ):

            if hmac.compare_digest(
                str(
                    user.user_id
                ),
                allowed_user_id,
            ):

                return True


        candidate_username = (
            str(
                user.username
            )
            .casefold()
        )


        for allowed_username in (
            _env_csv(
                "TOT_AUTHOR_USERNAMES"
            )
        ):

            if hmac.compare_digest(
                candidate_username,
                allowed_username.casefold(),
            ):

                return True


        return False


author_access_policy = (
    AuthorAccessPolicy()
)


def normalize_document_kind(
    value: str | None,
) -> str:

    kind = (
        str(
            value
            or "world"
        )
        .strip()
        .lower()
    )


    if kind not in DOCUMENT_KINDS:

        raise ValueError(
            "Unknown author document type."
        )


    return kind


def _base_world_story_guidance() -> dict[str, str]:
    return {
        "humor": "",
        "danger": "",
        "violence": "",
        "weirdness": "",
    }


def _base_adventure_story_guidance() -> dict[str, str]:
    return {
        **_base_world_story_guidance(),
        "choice_guidance": "",
        # This is a Tales of Two gameplay default, not World canon. Authors can
        # override it only from an Adventure Brief / advanced source.
        "failure_philosophy": (
            "Failure should usually create complications rather than stop progress."
        ),
    }


def _base_replayability() -> dict[str, str]:
    return {
        "variable_elements": "",
        "fixed_elements": "",
        "notes": "",
    }


def _base_migration() -> dict[str, Any]:
    return {
        "from_schema_version": None,
        "legacy_snapshot": None,
        "review_queue": [],
    }


def default_source_document(
    *,
    title: str = "",
    slug: str = "",
    document_kind: str = "world",
) -> dict[str, Any]:
    """Return a sparse schema-v3 source tailored to the document kind.

    Worlds define durable nouns/laws. Briefs define the circumstances and controls
    for one adventure. Shared entity arrays (locations/NPCs/secrets) deliberately
    remain structurally compatible so old authored content can migrate without loss.
    """
    document_kind = normalize_document_kind(document_kind)

    common_identity: dict[str, Any] = {
        "document_kind": document_kind,
        "title": title,
        "slug": slug,
        "genre": "",
        "tone": "",
        "weirdness": 2,
        "one_sentence_pitch": "",
        "player_experience": "",
    }

    common: dict[str, Any] = {
        "schema_version": 3,
        "identity": common_identity,
        "locations": [],
        "npcs": [],
        "lore_secrets": [],
        "forbidden_rules": [],
        "story_threads": [],
        "story_guidance": _base_adventure_story_guidance(),
        "director_notes": "",
        "private_notes": "",
        "migration": _base_migration(),
    }

    if document_kind == "world":
        common.update({
            "premise": "",
            "world_truths": [],
            "world_rules": [],
            "story_guidance": _base_world_story_guidance(),
        })
        return common

    common_identity.update({
        "primary_type": "mystery",
        "secondary_type": "",
        "length": "short",
        "difficulty": "introductory",
    })
    common.update({
        "starting_situation": "",
        "core_goal": "",
        "adventure_facts": [],
        "world_references": {
            "locations": [],
            "npcs": [],
            "lore_secrets": [],
        },
        "moments": [],
        "replayability": _base_replayability(),
    })
    return common


def _deep_merge(base: dict, overlay: dict) -> dict:
    result = copy.deepcopy(base)
    for key, value in overlay.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def _ensure_item_ids(
    items: Any,
    *,
    namespace: str = "item",
) -> list[dict[str, Any]]:
    """Normalize repeatable authored items and give legacy rows stable IDs.

    Schema-v2 documents were allowed to omit IDs. Published historical rows are
    immutable, so generating a random UUID while reading them would make Brief
    references drift from request to request. A UUID5 derived from the item
    payload + section + position gives those legacy objects a stable identity
    until the author saves a native v3 draft.
    """
    if not isinstance(items, list):
        return []
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        if isinstance(item, str):
            item = {"text": item}
        if not isinstance(item, dict):
            continue
        entry = copy.deepcopy(item)
        if not str(entry.get("id", "")).strip():
            stable_payload = copy.deepcopy(entry)
            stable_payload.pop("id", None)
            fingerprint = json.dumps(
                stable_payload,
                sort_keys=True,
                separators=(",", ":"),
                default=str,
            )
            entry["id"] = str(
                uuid5(
                    NAMESPACE_URL,
                    f"tales-of-two:author:{namespace}:{index}:{fingerprint}",
                )
            )
        normalized.append(entry)
    return normalized


def _legacy_review_item(label: str, value: Any) -> dict[str, Any] | None:
    if value in (None, "", [], {}):
        return None
    return {
        "label": label,
        "value": copy.deepcopy(value),
    }


def _migrate_v2_source(
    source: dict[str, Any],
    *,
    document_kind: str,
) -> dict[str, Any]:
    """Conservatively port schema-v2 documents into the scoped v3 model.

    Values with an obvious destination are copied there. Ambiguous legacy fields
    are preserved both in a read-only snapshot and a review queue so migration can
    never silently discard authored intent.
    """
    legacy = copy.deepcopy(source)
    legacy_identity = (
        legacy.get("identity")
        if isinstance(legacy.get("identity"), dict)
        else {}
    )
    result = default_source_document(
        title=str(legacy_identity.get("title", "")),
        slug=str(legacy_identity.get("slug", "")),
        document_kind=document_kind,
    )

    for key in (
        "genre",
        "tone",
        "weirdness",
        "one_sentence_pitch",
        "player_experience",
    ):
        if key in legacy_identity:
            result["identity"][key] = copy.deepcopy(legacy_identity[key])

    review_queue: list[dict[str, Any]] = []

    if document_kind == "world":
        result["premise"] = str(legacy.get("premise", "") or "")
        result["world_truths"] = _ensure_item_ids(legacy.get("world_truths"), namespace="world_truths")
        result["world_rules"] = []
        result["locations"] = _ensure_item_ids(legacy.get("locations"), namespace="locations")
        result["npcs"] = _ensure_item_ids(legacy.get("npcs"), namespace="npcs")
        result["lore_secrets"] = _ensure_item_ids(legacy.get("lore_secrets"), namespace="lore_secrets")
        result["forbidden_rules"] = _ensure_item_ids(legacy.get("forbidden_rules"), namespace="forbidden_rules")
        result["story_threads"] = _ensure_item_ids(legacy.get("story_threads"), namespace="story_threads")

        old_guidance = legacy.get("story_guidance")
        if isinstance(old_guidance, dict):
            for key in ("humor", "danger", "violence", "weirdness"):
                if key in old_guidance:
                    result["story_guidance"][key] = str(old_guidance.get(key, "") or "")
            for label, key in (
                ("Legacy choice guidance", "choice_guidance"),
                ("Legacy failure philosophy", "failure_philosophy"),
            ):
                item = _legacy_review_item(label, old_guidance.get(key))
                if item:
                    review_queue.append(item)

        legacy_run_controls = {}
        for key, default in (
            ("primary_type", "mystery"),
            ("secondary_type", ""),
            ("length", "short"),
            ("difficulty", "introductory"),
        ):
            value = legacy_identity.get(key, default)
            if value != default:
                legacy_run_controls[key] = copy.deepcopy(value)
        item = _legacy_review_item(
            "Legacy adventure controls stored on this World",
            legacy_run_controls,
        )
        if item:
            review_queue.append(item)

        for label, key in (
            ("Legacy adventure moments stored on this World", "moments"),
            ("Legacy replayability stored on this World", "replayability"),
        ):
            item = _legacy_review_item(label, legacy.get(key))
            if item:
                review_queue.append(item)

        result["director_notes"] = str(legacy.get("freeform_notes", "") or "")

    else:
        for key in (
            "primary_type",
            "secondary_type",
            "length",
            "difficulty",
        ):
            if key in legacy_identity:
                result["identity"][key] = copy.deepcopy(legacy_identity[key])

        result["starting_situation"] = str(legacy.get("premise", "") or "")
        result["core_goal"] = ""
        result["adventure_facts"] = _ensure_item_ids(legacy.get("world_truths"), namespace="world_truths")
        result["locations"] = _ensure_item_ids(legacy.get("locations"), namespace="locations")
        result["npcs"] = _ensure_item_ids(legacy.get("npcs"), namespace="npcs")
        result["lore_secrets"] = _ensure_item_ids(legacy.get("lore_secrets"), namespace="lore_secrets")
        result["moments"] = _ensure_item_ids(legacy.get("moments"), namespace="moments")
        result["forbidden_rules"] = _ensure_item_ids(legacy.get("forbidden_rules"), namespace="forbidden_rules")
        result["story_threads"] = _ensure_item_ids(legacy.get("story_threads"), namespace="story_threads")

        old_guidance = legacy.get("story_guidance")
        if isinstance(old_guidance, dict):
            result["story_guidance"] = _deep_merge(
                _base_adventure_story_guidance(),
                old_guidance,
            )
        old_replay = legacy.get("replayability")
        if isinstance(old_replay, dict):
            result["replayability"] = _deep_merge(
                _base_replayability(),
                old_replay,
            )
        result["director_notes"] = str(legacy.get("freeform_notes", "") or "")

    result["migration"] = {
        "from_schema_version": int(legacy.get("schema_version", 2) or 2),
        "legacy_snapshot": legacy,
        "review_queue": review_queue,
    }
    return result


def normalize_source_document(
    source: dict[str, Any],
    *,
    document_kind: str | None = None,
) -> dict[str, Any]:
    if not isinstance(source, dict):
        raise ValueError("Adventure source must be an object.")

    identity = source.get("identity") if isinstance(source.get("identity"), dict) else {}
    resolved_kind = normalize_document_kind(
        document_kind
        or identity.get("document_kind")
        or "world"
    )

    try:
        schema_version = int(source.get("schema_version", 2) or 2)
    except (TypeError, ValueError):
        schema_version = 2

    if schema_version < 3:
        result = _migrate_v2_source(source, document_kind=resolved_kind)
    else:
        result = _deep_merge(
            default_source_document(
                title=str(identity.get("title", "")),
                slug=str(identity.get("slug", "")),
                document_kind=resolved_kind,
            ),
            source,
        )

    result["schema_version"] = 3
    result["identity"]["document_kind"] = resolved_kind

    shared_lists = (
        "locations",
        "npcs",
        "lore_secrets",
        "forbidden_rules",
        "story_threads",
    )
    for key in shared_lists:
        result[key] = _ensure_item_ids(result.get(key), namespace=key)

    if resolved_kind == "world":
        result["world_truths"] = _ensure_item_ids(result.get("world_truths"), namespace="world_truths")
        result["world_rules"] = _ensure_item_ids(result.get("world_rules"), namespace="world_rules")
        # Enforce the kind-specific shape. Legacy-only adventure fields survive in
        # migration.legacy_snapshot/review_queue rather than leaking into World UI.
        for key in (
            "starting_situation",
            "core_goal",
            "adventure_facts",
            "world_references",
            "moments",
            "replayability",
        ):
            result.pop(key, None)
        for key in ("primary_type", "secondary_type", "length", "difficulty"):
            result["identity"].pop(key, None)
    else:
        result["adventure_facts"] = _ensure_item_ids(result.get("adventure_facts"), namespace="adventure_facts")
        result["moments"] = _ensure_item_ids(result.get("moments"), namespace="moments")
        refs = result.get("world_references")
        if not isinstance(refs, dict):
            refs = {}
        result["world_references"] = {
            key: _ensure_item_ids(refs.get(key), namespace=f"world_ref_{key}")
            for key in ("locations", "npcs", "lore_secrets")
        }
        result.pop("premise", None)
        result.pop("world_truths", None)
        result.pop("world_rules", None)

    guidance_default = (
        _base_world_story_guidance()
        if resolved_kind == "world"
        else _base_adventure_story_guidance()
    )
    if not isinstance(result.get("story_guidance"), dict):
        result["story_guidance"] = guidance_default
    else:
        result["story_guidance"] = _deep_merge(
            guidance_default,
            result["story_guidance"],
        )
        if resolved_kind == "world":
            # Never let adventure mechanics leak back into durable World defaults.
            result["story_guidance"].pop("choice_guidance", None)
            result["story_guidance"].pop("failure_philosophy", None)

    migration = result.get("migration")
    if not isinstance(migration, dict):
        migration = _base_migration()
    result["migration"] = _deep_merge(_base_migration(), migration)

    return result


def generation_source_document(source: dict[str, Any]) -> dict[str, Any]:
    """Return the AI/runtime-visible source with author-private material removed."""
    result = normalize_source_document(source)
    result = copy.deepcopy(result)
    result.pop("private_notes", None)
    result.pop("migration", None)
    return result

def normalize_slug(
    value: str,
) -> str:

    slug = (
        str(
            value
            or ""
        )
        .strip()
        .lower()
    )


    slug = re.sub(
        r"[^a-z0-9]+",
        "_",
        slug,
    )


    slug = slug.strip(
        "_"
    )


    if not slug:

        raise ValueError(
            "Adventure slug is required."
        )


    if len(
        slug
    ) > 80:

        raise ValueError(
            "Adventure slug is too long."
        )


    return slug


def _text_strength(
    value: Any,
    *,
    target_chars: int,
) -> float:

    length = len(
        str(
            value
            or ""
        ).strip()
    )


    if length <= 0:

        return 0.0


    return min(
        1.0,
        length
        / max(
            target_chars,
            1,
        ),
    )


def _list_strength(
    value: Any,
    *,
    target_items: int,
    text_keys: tuple[
        str,
        ...,
    ] = (
        "text",
        "name",
        "description",
        "notes",
    ),
) -> float:

    if not isinstance(
        value,
        list,
    ):

        return 0.0


    useful = 0.0


    for item in value:

        if isinstance(
            item,
            str,
        ):

            if item.strip():

                useful += 1.0

            continue


        if not isinstance(
            item,
            dict,
        ):

            continue


        combined = " ".join(
            str(
                item.get(
                    key,
                    "",
                )
            ).strip()

            for key
            in text_keys
        ).strip()


        if combined:

            useful += min(
                1.0,
                0.35
                + len(
                    combined
                )
                / 400,
            )


    return min(
        1.0,
        useful
        / max(
            target_items,
            1,
        ),
    )


def strength_label(
    score: int,
) -> str:

    if score <= 0:

        return "EMPTY"

    if score < 20:

        return "SPARSE"

    if score < 40:

        return "DEVELOPING"

    if score < 60:

        return "SOLID"

    if score < 80:

        return "ROBUST"

    return "EXTENSIVE"


def _reference_strength(source: dict[str, Any]) -> float:
    refs = source.get("world_references", {})
    if not isinstance(refs, dict):
        return 0.0
    total = sum(
        len(refs.get(key, []))
        for key in ("locations", "npcs", "lore_secrets")
        if isinstance(refs.get(key), list)
    )
    return min(1.0, total / 4.0)


def assess_document_strength(
    source: dict[str, Any],
) -> dict[str, Any]:
    source = normalize_source_document(source)
    identity = source["identity"]
    kind = identity.get("document_kind", "world")

    if kind == "world":
        identity_fields = (
            identity.get("title"),
            identity.get("genre"),
            identity.get("tone"),
            identity.get("one_sentence_pitch"),
        )
        identity_score = sum(
            1.0 if str(value or "").strip() else 0.0
            for value in identity_fields
        ) / len(identity_fields)

        guidance = source.get("story_guidance", {})
        guidance_score = sum(
            _text_strength(guidance.get(key), target_chars=80)
            for key in ("humor", "danger", "violence", "weirdness")
        ) / 4

        sections = {
            "identity": identity_score,
            "setting": _text_strength(source.get("premise"), target_chars=300),
            "canon": _list_strength(source.get("world_truths"), target_items=5),
            "rules": _list_strength(source.get("world_rules"), target_items=3),
            "locations": _list_strength(source.get("locations"), target_items=4),
            "people": _list_strength(source.get("npcs"), target_items=4),
            "lore": _list_strength(source.get("lore_secrets"), target_items=4),
            "boundaries": _list_strength(source.get("forbidden_rules"), target_items=3),
            "tensions": _list_strength(source.get("story_threads"), target_items=3),
            "defaults": guidance_score,
            "director_notes": _text_strength(source.get("director_notes"), target_chars=220),
        }
        weights = {
            "identity": 12,
            "setting": 12,
            "canon": 14,
            "rules": 8,
            "locations": 12,
            "people": 12,
            "lore": 10,
            "boundaries": 8,
            "tensions": 6,
            "defaults": 4,
            "director_notes": 2,
        }
    else:
        identity_fields = (
            identity.get("title"),
            identity.get("primary_type"),
            identity.get("one_sentence_pitch"),
            identity.get("player_experience"),
        )
        identity_score = sum(
            1.0 if str(value or "").strip() else 0.0
            for value in identity_fields
        ) / len(identity_fields)

        guidance = source.get("story_guidance", {})
        guidance_score = sum(
            _text_strength(guidance.get(key), target_chars=80)
            for key in (
                "humor",
                "danger",
                "violence",
                "weirdness",
                "choice_guidance",
            )
        ) / 5

        replayability = source.get("replayability", {})
        replayability_score = sum(
            _text_strength(replayability.get(key), target_chars=100)
            for key in ("variable_elements", "fixed_elements", "notes")
        ) / 3

        sections = {
            "identity": identity_score,
            "starting_situation": _text_strength(
                source.get("starting_situation"), target_chars=280
            ),
            "core_goal": _text_strength(source.get("core_goal"), target_chars=140),
            "adventure_facts": _list_strength(
                source.get("adventure_facts"), target_items=4
            ),
            "world_references": _reference_strength(source),
            "local_locations": _list_strength(source.get("locations"), target_items=2),
            "local_npcs": _list_strength(source.get("npcs"), target_items=2),
            "local_secrets": _list_strength(source.get("lore_secrets"), target_items=2),
            "moments": _list_strength(source.get("moments"), target_items=4),
            "restrictions": _list_strength(source.get("forbidden_rules"), target_items=2),
            "guidance": guidance_score,
            "threads": _list_strength(source.get("story_threads"), target_items=3),
            "replayability": replayability_score,
            "director_notes": _text_strength(source.get("director_notes"), target_chars=180),
        }
        weights = {
            "identity": 10,
            "starting_situation": 12,
            "core_goal": 10,
            "adventure_facts": 8,
            "world_references": 10,
            "local_locations": 6,
            "local_npcs": 6,
            "local_secrets": 6,
            "moments": 10,
            "restrictions": 6,
            "guidance": 6,
            "threads": 4,
            "replayability": 4,
            "director_notes": 2,
        }

    score = int(round(sum(sections[key] * weight for key, weight in weights.items())))
    return {
        "score": score,
        "label": strength_label(score),
        "sections": {
            key: {
                "score": int(round(value * 100)),
                "label": strength_label(int(round(value * 100))),
            }
            for key, value in sections.items()
        },
    }

def _authority_items(
    items: list,
    authority: str,
) -> list[dict]:

    return [
        item

        for item
        in items

        if (
            isinstance(
                item,
                dict,
            )
            and str(
                item.get(
                    "authority",
                    "",
                )
            ).casefold()
            == authority.casefold()
        )
    ]


def compile_source_document(
    source: dict[str, Any],
) -> dict[str, Any]:
    source = normalize_source_document(source)
    kind = source["identity"].get("document_kind", "world")

    if kind == "world":
        canon = copy.deepcopy(source.get("world_truths", []))
        canon.extend(copy.deepcopy(source.get("world_rules", [])))
        return {
            "schema_version": 3,
            "source_scope": "world",
            "identity": copy.deepcopy(source["identity"]),
            "premise": source.get("premise", ""),
            "canon": canon,
            "world_rules": copy.deepcopy(source.get("world_rules", [])),
            "locations": copy.deepcopy(source.get("locations", [])),
            "npcs": copy.deepcopy(source.get("npcs", [])),
            "lore_and_secrets": copy.deepcopy(source.get("lore_secrets", [])),
            "required_moments": [],
            "preferred_moments": [],
            "inspiration_moments": [],
            "forbidden": copy.deepcopy(source.get("forbidden_rules", [])),
            "story_threads": copy.deepcopy(source.get("story_threads", [])),
            "story_guidance": copy.deepcopy(source.get("story_guidance", {})),
            "replayability": _base_replayability(),
            "director_notes": source.get("director_notes", ""),
            # Compatibility alias for older tooling. Private notes are deliberately absent.
            "freeform_notes": source.get("director_notes", ""),
        }

    moments = source.get("moments", [])
    return {
        "schema_version": 3,
        "source_scope": "adventure",
        "identity": copy.deepcopy(source["identity"]),
        "premise": source.get("starting_situation", ""),
        "starting_situation": source.get("starting_situation", ""),
        "core_goal": source.get("core_goal", ""),
        "canon": copy.deepcopy(source.get("adventure_facts", [])),
        "adventure_facts": copy.deepcopy(source.get("adventure_facts", [])),
        "world_references": copy.deepcopy(source.get("world_references", {})),
        "locations": copy.deepcopy(source.get("locations", [])),
        "npcs": copy.deepcopy(source.get("npcs", [])),
        "lore_and_secrets": copy.deepcopy(source.get("lore_secrets", [])),
        "required_moments": _authority_items(moments, "required"),
        "preferred_moments": _authority_items(moments, "preferred"),
        "inspiration_moments": _authority_items(moments, "inspiration"),
        "forbidden": copy.deepcopy(source.get("forbidden_rules", [])),
        "story_threads": copy.deepcopy(source.get("story_threads", [])),
        "story_guidance": copy.deepcopy(source.get("story_guidance", {})),
        "replayability": copy.deepcopy(source.get("replayability", {})),
        "director_notes": source.get("director_notes", ""),
        "freeform_notes": source.get("director_notes", ""),
    }

def _clean_text(
    value: Any,
) -> str:

    return str(
        value
        or ""
    ).strip()


def _append_section(
    lines: list[str],
    heading: str,
    body: str,
) -> None:

    body = _clean_text(
        body
    )


    if not body:

        return


    lines.extend(
        [
            "",
            f"## {heading}",
            "",
            body,
        ]
    )


def _append_repeatable(
    lines: list[str],
    heading: str,
    items: list,
    *,
    title_key: str = "name",
    body_keys: tuple[
        str,
        ...,
    ] = (
        "text",
        "description",
        "notes",
    ),
) -> None:

    usable = [
        item
        for item
        in items
        if isinstance(
            item,
            dict,
        )
    ]


    if not usable:

        return


    lines.extend(
        [
            "",
            f"## {heading}",
            "",
        ]
    )


    for item in usable:

        title = (
            _clean_text(
                item.get(
                    title_key
                )
            )
        )


        body_parts = [
            _clean_text(
                item.get(
                    key
                )
            )

            for key
            in body_keys
        ]


        body_parts = [
            part
            for part
            in body_parts
            if part
        ]


        if not title and not body_parts:

            continue


        authority = (
            _clean_text(
                item.get(
                    "authority"
                )
            )
            .upper()
        )


        if title:

            lines.append(
                f"### {title}"
            )

        elif authority:

            lines.append(
                f"### {authority}"
            )


        if (
            authority
            and title
        ):

            lines.append(
                f"**Authority:** {authority}"
            )


        for part in body_parts:

            lines.extend(
                [
                    "",
                    part,
                ]
            )


        details = []


        for (
            label,
            key,
        ) in (
            (
                "Role",
                "role",
            ),
            (
                "Importance",
                "importance",
            ),
            (
                "AI Freedom",
                "ai_freedom",
            ),
            (
                "Who Knows",
                "who_knows",
            ),
            (
                "Reveal Guidance",
                "reveal_guidance",
            ),
        ):

            value = (
                _clean_text(
                    item.get(
                        key
                    )
                )
            )


            if value:

                details.append(
                    f"**{label}:** {value}"
                )


        if details:

            lines.extend(
                [
                    "",
                    *details,
                ]
            )


        lines.append(
            ""
        )


def _guidance_body(guidance: dict[str, Any], *, include_choice: bool) -> str:
    fields = [
        ("Humor", "humor"),
        ("Danger", "danger"),
        ("Violence", "violence"),
        ("Weirdness", "weirdness"),
    ]
    if include_choice:
        fields.append(("Choice Guidance", "choice_guidance"))
    return "\n\n".join(
        f"### {label}\n{_clean_text(guidance.get(key))}"
        for label, key in fields
        if _clean_text(guidance.get(key))
    )


def _reference_design_body(refs: dict[str, Any]) -> str:
    lines: list[str] = []
    for heading, key in (
        ("Locations", "locations"),
        ("Characters", "npcs"),
        ("Lore / Secrets", "lore_secrets"),
    ):
        items = refs.get(key, []) if isinstance(refs, dict) else []
        usable = [item for item in items if isinstance(item, dict)]
        if not usable:
            continue
        lines.append(f"### {heading}")
        for item in usable:
            name = _clean_text(item.get("name") or item.get("title") or item.get("source_id"))
            use = _clean_text(item.get("use") or item.get("notes"))
            treatment = _clean_text(item.get("treatment"))
            timing = _clean_text(item.get("timing"))
            detail = "; ".join(part for part in (use, treatment, timing) if part)
            lines.append(f"- **{name or 'Referenced item'}**" + (f" — {detail}" if detail else ""))
        lines.append("")
    return "\n".join(lines).strip()


def render_design_document(
    source: dict[str, Any],
) -> str:
    source = normalize_source_document(source)
    identity = source["identity"]
    title = _clean_text(identity.get("title")) or "Untitled"
    kind = _clean_text(identity.get("document_kind")).lower() or "world"

    lines = [
        f"# {title}",
        "",
        f"**Document Type:** {'WORLD BIBLE' if kind == 'world' else 'ADVENTURE BRIEF'}",
        f"**Genre:** {_clean_text(identity.get('genre')) or 'Unspecified'}",
        f"**Tone:** {_clean_text(identity.get('tone')) or 'Unspecified'}",
        f"**Weirdness:** {identity.get('weirdness', 0)}/5",
    ]

    if kind == "brief":
        lines.extend([
            f"**Primary Type:** {_clean_text(identity.get('primary_type')) or 'Unspecified'}",
            f"**Secondary Type:** {_clean_text(identity.get('secondary_type')) or 'None'}",
            f"**Length:** {_clean_text(identity.get('length')) or 'Unspecified'}",
            f"**Difficulty:** {_clean_text(identity.get('difficulty')) or 'Unspecified'}",
        ])

    _append_section(lines, "One-Sentence Pitch", identity.get("one_sentence_pitch"))
    _append_section(lines, "Player Experience", identity.get("player_experience"))

    if kind == "world":
        _append_section(lines, "Setting & World Premise", source.get("premise"))
        _append_repeatable(
            lines,
            "Canon / World Truths",
            source.get("world_truths", []),
            title_key="authority",
            body_keys=("text",),
        )
        _append_repeatable(
            lines,
            "World Rules",
            source.get("world_rules", []),
            title_key="authority",
            body_keys=("text",),
        )
    else:
        _append_section(lines, "Starting Situation", source.get("starting_situation"))
        _append_section(lines, "Core Goal / Pressure", source.get("core_goal"))
        _append_repeatable(
            lines,
            "Adventure Facts / Local Conditions",
            source.get("adventure_facts", []),
            title_key="authority",
            body_keys=("text",),
        )
        _append_section(
            lines,
            "Featured World Content",
            _reference_design_body(source.get("world_references", {})),
        )

    _append_repeatable(
        lines,
        "World Locations" if kind == "world" else "Adventure-Only Locations",
        source.get("locations", []),
        body_keys=("description", "canon"),
    )
    _append_repeatable(
        lines,
        "People & Factions" if kind == "world" else "Adventure-Only Cast",
        source.get("npcs", []),
        body_keys=(
            "appearance",
            "personality",
            "wants",
            "knows",
            "secret",
            "relationship",
            "canonical_facts",
        ),
    )
    _append_repeatable(
        lines,
        "World Lore & Secrets" if kind == "world" else "Adventure-Only Secrets",
        source.get("lore_secrets", []),
        title_key="title",
        body_keys=("text",),
    )

    if kind == "brief":
        _append_repeatable(
            lines,
            "Required / Preferred Moments",
            source.get("moments", []),
            title_key="authority",
            body_keys=("text",),
        )

    _append_section(
        lines,
        "World Flavor Defaults" if kind == "world" else "Story & Choice Guidance",
        _guidance_body(source.get("story_guidance", {}), include_choice=(kind == "brief")),
    )
    _append_repeatable(
        lines,
        "Canon Boundaries" if kind == "world" else "Adventure Restrictions",
        source.get("forbidden_rules", []),
        title_key="authority",
        body_keys=("text",),
    )
    _append_repeatable(
        lines,
        "Ongoing Tensions" if kind == "world" else "Adventure Threads",
        source.get("story_threads", []),
        title_key="title",
        body_keys=("description",),
    )

    if kind == "brief":
        replayability = source.get("replayability", {})
        replayability_body = "\n\n".join(
            f"### {label}\n{_clean_text(replayability.get(key))}"
            for label, key in (
                ("May Change Between Runs", "variable_elements"),
                ("Must Stay Fixed", "fixed_elements"),
                ("Notes", "notes"),
            )
            if _clean_text(replayability.get(key))
        )
        _append_section(lines, "Replayability", replayability_body)

    _append_section(lines, "Director Notes", source.get("director_notes"))
    _append_section(lines, "Private Author Notes", source.get("private_notes"))

    migration = source.get("migration", {})
    if isinstance(migration, dict) and migration.get("from_schema_version"):
        review = migration.get("review_queue", [])
        body = (
            f"Ported from schema v{migration.get('from_schema_version')}. "
            "The original source snapshot is retained internally for lossless migration."
        )
        if isinstance(review, list) and review:
            body += "\n\nItems to review after migration:\n" + "\n".join(
                f"- {item.get('label', 'Legacy field')}"
                for item in review
                if isinstance(item, dict)
            )
        _append_section(lines, "Migration Notes", body)

    return "\n".join(lines).strip() + "\n"

