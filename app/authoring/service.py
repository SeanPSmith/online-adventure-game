from __future__ import annotations

import copy
import hmac
import os
import re

from typing import Any


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


def default_source_document(
    *,
    title: str = "",
    slug: str = "",
    document_kind: str = "world",
) -> dict[str, Any]:

    document_kind = (
        normalize_document_kind(
            document_kind
        )
    )


    return {
        "schema_version":
            2,

        "identity": {
            "document_kind":
                document_kind,

            "title":
                title,

            "slug":
                slug,

            "primary_type":
                "mystery",

            "secondary_type":
                "",

            "length":
                "short",

            "genre":
                "",

            "tone":
                "",

            "difficulty":
                "introductory",

            "weirdness":
                2,

            "one_sentence_pitch":
                "",

            "player_experience":
                "",
        },

        "premise":
            "",

        "world_truths":
            [],

        "locations":
            [],

        "npcs":
            [],

        "lore_secrets":
            [],

        "moments":
            [],

        "forbidden_rules":
            [],

        "story_threads":
            [],

        "story_guidance": {
            "humor":
                "",

            "danger":
                "",

            "violence":
                "",

            "weirdness":
                "",

            "choice_guidance":
                "",

            "failure_philosophy":
                (
                    "Failure should usually create "
                    "complications rather than stop progress."
                ),
        },

        "replayability": {
            "variable_elements":
                "",

            "fixed_elements":
                "",

            "notes":
                "",
        },

        "freeform_notes":
            "",
    }


def _deep_merge(
    base: dict,
    overlay: dict,
) -> dict:

    result = copy.deepcopy(
        base
    )


    for (
        key,
        value,
    ) in overlay.items():

        if (
            key in result
            and isinstance(
                result[
                    key
                ],
                dict,
            )
            and isinstance(
                value,
                dict,
            )
        ):

            result[
                key
            ] = _deep_merge(
                result[
                    key
                ],
                value,
            )

        else:

            result[
                key
            ] = copy.deepcopy(
                value
            )


    return result


def normalize_source_document(
    source: dict[str, Any],
    *,
    document_kind: (
        str
        | None
    ) = None,
) -> dict[str, Any]:

    if not isinstance(
        source,
        dict,
    ):

        raise ValueError(
            "Adventure source must be an object."
        )


    identity = (
        source.get(
            "identity"
        )
        if isinstance(
            source.get(
                "identity"
            ),
            dict,
        )
        else {}
    )


    resolved_kind = (
        normalize_document_kind(
            document_kind
            or identity.get(
                "document_kind"
            )
            or "world"
        )
    )


    result = _deep_merge(
        default_source_document(
            title=
                str(
                    identity.get(
                        "title",
                        "",
                    )
                ),

            slug=
                str(
                    identity.get(
                        "slug",
                        "",
                    )
                ),

            document_kind=
                resolved_kind,
        ),
        source,
    )


    result[
        "schema_version"
    ] = 2


    result[
        "identity"
    ][
        "document_kind"
    ] = resolved_kind


    for key in (
        "world_truths",
        "locations",
        "npcs",
        "lore_secrets",
        "moments",
        "forbidden_rules",
        "story_threads",
    ):

        if not isinstance(
            result.get(
                key
            ),
            list,
        ):

            result[
                key
            ] = []


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


def assess_document_strength(
    source: dict[str, Any],
) -> dict[str, Any]:

    source = (
        normalize_source_document(
            source
        )
    )


    identity = (
        source[
            "identity"
        ]
    )


    identity_fields = [
        identity.get(
            "title"
        ),
        identity.get(
            "primary_type"
        ),
        identity.get(
            "one_sentence_pitch"
        ),
        identity.get(
            "player_experience"
        ),
    ]


    identity_score = (
        sum(
            1.0
            if str(
                value
                or ""
            ).strip()
            else 0.0

            for value
            in identity_fields
        )
        / len(
            identity_fields
        )
    )


    guidance = (
        source[
            "story_guidance"
        ]
    )


    guidance_score = (
        sum(
            _text_strength(
                guidance.get(
                    key
                ),
                target_chars=90,
            )

            for key in (
                "humor",
                "danger",
                "violence",
                "weirdness",
                "choice_guidance",
                "failure_philosophy",
            )
        )
        / 6
    )


    replayability = (
        source[
            "replayability"
        ]
    )


    replayability_score = (
        sum(
            _text_strength(
                replayability.get(
                    key
                ),
                target_chars=100,
            )

            for key in (
                "variable_elements",
                "fixed_elements",
                "notes",
            )
        )
        / 3
    )


    sections = {
        "identity":
            identity_score,

        "premise":
            _text_strength(
                source[
                    "premise"
                ],
                target_chars=300,
            ),

        "canon":
            _list_strength(
                source[
                    "world_truths"
                ],
                target_items=6,
            ),

        "locations":
            _list_strength(
                source[
                    "locations"
                ],
                target_items=4,
            ),

        "npcs":
            _list_strength(
                source[
                    "npcs"
                ],
                target_items=4,
            ),

        "lore":
            _list_strength(
                source[
                    "lore_secrets"
                ],
                target_items=4,
            ),

        "moments":
            _list_strength(
                source[
                    "moments"
                ],
                target_items=5,
            ),

        "forbidden":
            _list_strength(
                source[
                    "forbidden_rules"
                ],
                target_items=3,
            ),

        "guidance":
            guidance_score,

        "threads":
            _list_strength(
                source[
                    "story_threads"
                ],
                target_items=4,
            ),

        "replayability":
            replayability_score,

        "freeform":
            _text_strength(
                source[
                    "freeform_notes"
                ],
                target_chars=250,
            ),
    }


    weights = {
        "identity":
            10,

        "premise":
            10,

        "canon":
            12,

        "locations":
            10,

        "npcs":
            10,

        "lore":
            8,

        "moments":
            10,

        "forbidden":
            7,

        "guidance":
            8,

        "threads":
            5,

        "replayability":
            5,

        "freeform":
            5,
    }


    score = int(
        round(
            sum(
                sections[
                    key
                ]
                * weight

                for (
                    key,
                    weight,
                ) in weights.items()
            )
        )
    )


    return {
        "score":
            score,

        "label":
            strength_label(
                score
            ),

        "sections": {
            key: {
                "score":
                    int(
                        round(
                            value
                            * 100
                        )
                    ),

                "label":
                    strength_label(
                        int(
                            round(
                                value
                                * 100
                            )
                        )
                    ),
            }

            for (
                key,
                value,
            ) in sections.items()
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

    source = (
        normalize_source_document(
            source
        )
    )


    moments = (
        source[
            "moments"
        ]
    )


    return {
        "schema_version":
            2,

        "identity":
            copy.deepcopy(
                source[
                    "identity"
                ]
            ),

        "premise":
            source[
                "premise"
            ],

        "canon":
            copy.deepcopy(
                source[
                    "world_truths"
                ]
            ),

        "locations":
            copy.deepcopy(
                source[
                    "locations"
                ]
            ),

        "npcs":
            copy.deepcopy(
                source[
                    "npcs"
                ]
            ),

        "lore_and_secrets":
            copy.deepcopy(
                source[
                    "lore_secrets"
                ]
            ),

        "required_moments":
            _authority_items(
                moments,
                "required",
            ),

        "preferred_moments":
            _authority_items(
                moments,
                "preferred",
            ),

        "inspiration_moments":
            _authority_items(
                moments,
                "inspiration",
            ),

        "forbidden":
            copy.deepcopy(
                source[
                    "forbidden_rules"
                ]
            ),

        "story_threads":
            copy.deepcopy(
                source[
                    "story_threads"
                ]
            ),

        "story_guidance":
            copy.deepcopy(
                source[
                    "story_guidance"
                ]
            ),

        "replayability":
            copy.deepcopy(
                source[
                    "replayability"
                ]
            ),

        "freeform_notes":
            source[
                "freeform_notes"
            ],
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


def render_design_document(
    source: dict[str, Any],
) -> str:

    source = (
        normalize_source_document(
            source
        )
    )


    identity = (
        source[
            "identity"
        ]
    )


    title = (
        _clean_text(
            identity.get(
                "title"
            )
        )
        or "Untitled"
    )


    kind = (
        _clean_text(
            identity.get(
                "document_kind"
            )
        )
        .upper()
    )


    lines = [
        f"# {title}",
        "",
        f"**Document Type:** {kind}",
        f"**Primary Type:** {_clean_text(identity.get('primary_type')) or 'Unspecified'}",
        f"**Secondary Type:** {_clean_text(identity.get('secondary_type')) or 'None'}",
        f"**Length:** {_clean_text(identity.get('length')) or 'Unspecified'}",
        f"**Genre:** {_clean_text(identity.get('genre')) or 'Unspecified'}",
        f"**Tone:** {_clean_text(identity.get('tone')) or 'Unspecified'}",
        f"**Difficulty:** {_clean_text(identity.get('difficulty')) or 'Unspecified'}",
        f"**Weirdness:** {identity.get('weirdness', 0)}/5",
    ]


    _append_section(
        lines,
        "One-Sentence Pitch",
        identity.get(
            "one_sentence_pitch"
        ),
    )


    _append_section(
        lines,
        "Player Experience",
        identity.get(
            "player_experience"
        ),
    )


    _append_section(
        lines,
        "Premise",
        source[
            "premise"
        ],
    )


    _append_repeatable(
        lines,
        "Canon / World Truths",
        source[
            "world_truths"
        ],
        title_key=
            "authority",

        body_keys=(
            "text",
        ),
    )


    _append_repeatable(
        lines,
        "Locations",
        source[
            "locations"
        ],
        body_keys=(
            "description",
            "canon",
        ),
    )


    _append_repeatable(
        lines,
        "NPCs",
        source[
            "npcs"
        ],
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
        "Lore & Secrets",
        source[
            "lore_secrets"
        ],
        title_key=
            "title",

        body_keys=(
            "text",
        ),
    )


    _append_repeatable(
        lines,
        "Required / Preferred Moments",
        source[
            "moments"
        ],
        title_key=
            "authority",

        body_keys=(
            "text",
        ),
    )


    guidance = (
        source[
            "story_guidance"
        ]
    )


    guidance_body = "\n\n".join(
        (
            f"### {label}\n{_clean_text(guidance.get(key))}"
        )

        for (
            label,
            key,
        ) in (
            (
                "Humor",
                "humor",
            ),
            (
                "Danger",
                "danger",
            ),
            (
                "Violence",
                "violence",
            ),
            (
                "Weirdness",
                "weirdness",
            ),
            (
                "Choice Guidance",
                "choice_guidance",
            ),
            (
                "Failure Philosophy",
                "failure_philosophy",
            ),
        )

        if _clean_text(
            guidance.get(
                key
            )
        )
    )


    _append_section(
        lines,
        "Story & Choice Guidance",
        guidance_body,
    )


    _append_repeatable(
        lines,
        "Forbidden Rules",
        source[
            "forbidden_rules"
        ],
        title_key=
            "authority",

        body_keys=(
            "text",
        ),
    )


    _append_repeatable(
        lines,
        "Story Threads",
        source[
            "story_threads"
        ],
        title_key=
            "title",

        body_keys=(
            "description",
        ),
    )


    replayability = (
        source[
            "replayability"
        ]
    )


    replayability_body = "\n\n".join(
        (
            f"### {label}\n{_clean_text(replayability.get(key))}"
        )

        for (
            label,
            key,
        ) in (
            (
                "May Change Between Runs",
                "variable_elements",
            ),
            (
                "Must Stay Canon",
                "fixed_elements",
            ),
            (
                "Notes",
                "notes",
            ),
        )

        if _clean_text(
            replayability.get(
                key
            )
        )
    )


    _append_section(
        lines,
        "Replayability",
        replayability_body,
    )


    _append_section(
        lines,
        "Freeform Notes",
        source[
            "freeform_notes"
        ],
    )


    return (
        "\n".join(
            lines
        )
        .strip()
        + "\n"
    )
