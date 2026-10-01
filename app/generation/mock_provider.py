from __future__ import annotations

from typing import (
    Any,
)

from app.generation.provider import (
    AdventureGenerationProvider,
)


def _clean(
    value: Any,
) -> str:

    return str(
        value
        or ""
    ).strip()


def _item_names(
    items,
    *,
    max_items: int,
) -> list[str]:

    results = []


    for item in (
        items
        if isinstance(
            items,
            list,
        )
        else []
    ):

        if not isinstance(
            item,
            dict,
        ):

            continue


        name = (
            _clean(
                item.get(
                    "name"
                )
            )
            or _clean(
                item.get(
                    "title"
                )
            )
        )


        if name:

            results.append(
                name
            )


        if len(
            results
        ) >= max_items:

            break


    return results


def _item_texts(
    items,
    *,
    max_items: int,
    authority: (
        str
        | None
    ) = None,
) -> list[str]:

    results = []


    for item in (
        items
        if isinstance(
            items,
            list,
        )
        else []
    ):

        if not isinstance(
            item,
            dict,
        ):

            continue


        if (
            authority
            and _clean(
                item.get(
                    "authority"
                )
            ).casefold()
            != authority.casefold()
        ):

            continue


        text = (
            _clean(
                item.get(
                    "text"
                )
            )
            or _clean(
                item.get(
                    "description"
                )
            )
        )


        if text:

            results.append(
                text
            )


        if len(
            results
        ) >= max_items:

            break


    return results


class MockAdventureGenerationProvider(
    AdventureGenerationProvider
):

    async def generate_seed(
        self,
        *,
        world_version: dict[
            str,
            Any,
        ],
        brief_version: dict[
            str,
            Any,
        ],
        special_request: str,
        quality_tier: str = "story",
    ) -> dict[
        str,
        Any,
    ]:

        world = (
            world_version[
                "source"
            ]
        )

        brief = (
            brief_version[
                "source"
            ]
        )


        world_identity = (
            world.get(
                "identity",
                {},
            )
        )

        brief_identity = (
            brief.get(
                "identity",
                {},
            )
        )


        title = (
            _clean(
                brief_identity.get(
                    "title"
                )
            )
            or "Generated Adventure"
        )


        premise = (
            _clean(
                brief.get(
                    "premise"
                )
            )
            or _clean(
                brief_identity.get(
                    "one_sentence_pitch"
                )
            )
            or (
                "A new adventure begins inside "
                + (
                    _clean(
                        world_identity.get(
                            "title"
                        )
                    )
                    or "the authored world"
                )
                + "."
            )
        )


        major_locations = (
            _item_names(
                brief.get(
                    "locations"
                ),
                max_items=5,
            )
        )


        if not major_locations:

            major_locations = (
                _item_names(
                    world.get(
                        "locations"
                    ),
                    max_items=5,
                )
            )


        major_npcs = (
            _item_names(
                brief.get(
                    "npcs"
                ),
                max_items=5,
            )
        )


        if not major_npcs:

            major_npcs = (
                _item_names(
                    world.get(
                        "npcs"
                    ),
                    max_items=5,
                )
            )


        required_elements = (
            _item_texts(
                brief.get(
                    "moments"
                ),
                max_items=6,
                authority=
                    "required",
            )
        )


        if not required_elements:

            required_elements = (
                _item_texts(
                    brief.get(
                        "world_truths"
                    ),
                    max_items=4,
                )
            )


        open_threads = (
            _item_texts(
                brief.get(
                    "story_threads"
                ),
                max_items=6,
            )
        )


        if not open_threads:

            open_threads = (
                _item_texts(
                    world.get(
                        "story_threads"
                    ),
                    max_items=6,
                )
            )


        hidden_truths = (
            _item_texts(
                brief.get(
                    "lore_secrets"
                ),
                max_items=4,
            )
        )


        if not hidden_truths:

            hidden_truths = (
                _item_texts(
                    world.get(
                        "lore_secrets"
                    ),
                    max_items=4,
                )
            )


        story_guidance = (
            brief.get(
                "story_guidance",
                {}
            )
        )


        director_guidance = [
            text

            for text in (
                _clean(
                    story_guidance.get(
                        "choice_guidance"
                    )
                ),
                _clean(
                    story_guidance.get(
                        "failure_philosophy"
                    )
                ),
                _clean(
                    special_request
                ),
            )

            if text
        ]


        if not director_guidance:

            director_guidance = [
                (
                    "Keep the story grounded in the "
                    "published world and brief."
                )
            ]


        return {
            "schema_version":
                1,

            "generator":
                "mock",

            "model":
                "deterministic",

            "quality_tier":
                str(
                    quality_tier
                    or "story"
                ).strip().casefold(),

            "title":
                title,

            "subtitle":
                "MOCK GENERATED SEED",

            "primary_type":
                _clean(
                    brief_identity.get(
                        "primary_type"
                    )
                )
                or "quest",

            "secondary_type":
                _clean(
                    brief_identity.get(
                        "secondary_type"
                    )
                ),

            "target_length":
                _clean(
                    brief_identity.get(
                        "length"
                    )
                )
                or "medium",

            "tone":
                _clean(
                    brief_identity.get(
                        "tone"
                    )
                )
                or _clean(
                    world_identity.get(
                        "tone"
                    )
                ),

            "difficulty":
                _clean(
                    brief_identity.get(
                        "difficulty"
                    )
                )
                or "moderate",

            "weirdness":
                brief_identity.get(
                    "weirdness",
                    2,
                ),

            "premise":
                premise,

            "player_synopsis":
                (
                    _clean(
                        brief_identity.get(
                            "one_sentence_pitch"
                        )
                    )
                    or premise
                ),

            "core_goal":
                (
                    _clean(
                        brief_identity.get(
                            "one_sentence_pitch"
                        )
                    )
                    or premise
                ),

            "major_locations":
                major_locations,

            "major_npcs":
                major_npcs,

            "canon_constraints":
                _item_texts(
                    world.get(
                        "world_truths"
                    ),
                    max_items=8,
                    authority=
                        "canon",
                )
                + _item_texts(
                    brief.get(
                        "world_truths"
                    ),
                    max_items=4,
                    authority=
                        "canon",
                ),

            "required_elements":
                required_elements,

            "forbidden_elements":
                _item_texts(
                    world.get(
                        "forbidden_rules"
                    ),
                    max_items=6,
                )
                + _item_texts(
                    brief.get(
                        "forbidden_rules"
                    ),
                    max_items=6,
                ),

            "open_threads":
                open_threads,

            "hidden_truths":
                hidden_truths,

            "potential_finale":
                (
                    "Resolve the adventure's central problem "
                    "in a way that reflects the players' choices."
                ),

            "director_guidance":
                director_guidance,

            "special_request":
                _clean(
                    special_request
                ),

            "source": {
                "world": {
                    "document_id":
                        world_version[
                            "document_id"
                        ],

                    "version_number":
                        world_version[
                            "version_number"
                        ],

                    "title":
                        _clean(
                            world_identity.get(
                                "title"
                            )
                        ),
                },

                "brief": {
                    "document_id":
                        brief_version[
                            "document_id"
                        ],

                    "version_number":
                        brief_version[
                            "version_number"
                        ],

                    "title":
                        _clean(
                            brief_identity.get(
                                "title"
                            )
                        ),
                },
            },
        }


    def public_status(
        self,
    ) -> dict[
        str,
        Any,
    ]:

        return {
            "provider":
                "mock",

            "available":
                True,

            "default_quality":
                "story",

            "profiles": [
                {
                    "id":
                        "story",

                    "label":
                        "STORY",

                    "description":
                        "Deterministic mock generation.",

                    "model":
                        "deterministic",

                    "reasoning":
                        "none",
                },
                {
                    "id":
                        "economy",

                    "label":
                        "ECONOMY",

                    "description":
                        "Deterministic mock generation.",

                    "model":
                        "deterministic",

                    "reasoning":
                        "none",
                },
            ],
        }


mock_generation_provider = (
    MockAdventureGenerationProvider()
)
