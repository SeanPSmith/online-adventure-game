from __future__ import annotations

from typing import (
    Any,
)

from app.adventures.models import (
    AdventureDefinition,
    CheckSpec,
    ChoiceDefinition,
    SceneDefinition,
)

from app.characters.models import (
    Skill,
)

from app.generation.pacing import (
    director_turn_window,
)


def runtime_adventure_id(
    generated_adventure_id: str,
) -> str:

    compact = (
        str(
            generated_adventure_id
        )
        .replace(
            "-",
            "",
        )
    )


    return (
        "generated_"
        + compact
    )


def _bullet_block(
    heading: str,
    values,
) -> str:

    cleaned = [
        str(
            value
        ).strip()

        for value
        in (
            values
            if isinstance(
                values,
                list,
            )
            else []
        )

        if str(
            value
        ).strip()
    ]


    if not cleaned:

        return ""


    return (
        heading
        + "\n"
        + "\n".join(
            f"- {value}"
            for value
            in cleaned
        )
    )



def build_director_runtime_adventure(
    generated: dict[
        str,
        Any,
    ],
) -> AdventureDefinition:

    seed = (
        generated[
            "seed"
        ]
    )


    adventure_id = (
        runtime_adventure_id(
            generated[
                "generated_adventure_id"
            ]
        )
    )


    title = (
        str(
            seed.get(
                "title",
                "Generated Adventure",
            )
        ).strip()
        or "Generated Adventure"
    )


    premise = (
        str(
            seed.get(
                "premise",
                "",
            )
        ).strip()
    )


    core_goal = (
        str(
            seed.get(
                "core_goal",
                "",
            )
        ).strip()
    )


    player_synopsis = (
        str(
            seed.get(
                "player_synopsis",
                "",
            )
        ).strip()
    )


    start_sections = [
        premise,
        (
            "GOAL\n"
            + core_goal
            if core_goal
            else ""
        ),
        _bullet_block(
            "MAJOR LOCATIONS",
            seed.get(
                "major_locations"
            ),
        ),
        _bullet_block(
            "KNOWN STORY THREADS",
            seed.get(
                "open_threads"
            ),
        ),
    ]


    start_body = "\n\n".join(
        section

        for section
        in start_sections

        if section
    )


    if not start_body:

        start_body = (
            "The generated adventure is ready "
            "to begin."
        )


    adventure = AdventureDefinition(

        id=
            adventure_id,

        title=
            title.upper(),

        description=
            (
                player_synopsis
                or core_goal
                or premise
                or "Generated adventure seed."
            ),

        starting_scene_id=
            "generated_opening",

        scenes={
            "generated_opening":
                SceneDefinition(

                    id=
                        "generated_opening",

                    title=
                        title.upper(),

                    body=
                        start_body,

                    ascii_art=
                        (
                            "       .  *  .\n"
                            "    *    /\\    *\n"
                            "        /  \\\n"
                            "   ____/____\\____\n"
                            "      ADVENTURE"
                        ),

                    choices=(
                        ChoiceDefinition(

                            id=
                                "begin_adventure",

                            label=
                                "LET'S GO",
                        ),
                    ),

                    default_next_scene_id=
                        None,
                ),
        },

        tags=(
            "generated",
            "ai-directed",
            str(
                seed.get(
                    "primary_type",
                    "adventure",
                )
            ),
        ),

        metadata={
            "generated":
                True,

            "generator":
                seed.get(
                    "generator",
                    "mock",
                ),

            "generated_adventure_id":
                generated[
                    "generated_adventure_id"
                ],

            "world_document_id":
                generated[
                    "world_document_id"
                ],

            "world_version_number":
                generated[
                    "world_version_number"
                ],

            "brief_document_id":
                generated[
                    "brief_document_id"
                ],

            "brief_version_number":
                generated[
                    "brief_version_number"
                ],

            "primary_type":
                seed.get(
                    "primary_type"
                ),

            "secondary_type":
                seed.get(
                    "secondary_type"
                ),

            "target_length":
                seed.get(
                    "target_length"
                ),

            "difficulty":
                seed.get(
                    "difficulty"
                ),

            "tone":
                seed.get(
                    "tone"
                ),

            "weirdness":
                seed.get(
                    "weirdness"
                ),

            "world_title":
                (
                    seed.get(
                        "source",
                        {},
                    )
                    .get(
                        "world",
                        {},
                    )
                    .get(
                        "title"
                    )
                ),

            "brief_title":
                (
                    seed.get(
                        "source",
                        {},
                    )
                    .get(
                        "brief",
                        {},
                    )
                    .get(
                        "title"
                    )
                ),

            "runtime_mode":
                "ai_director",

            "director_min_turns":
                director_turn_window(
                    seed.get(
                        "target_length"
                    )
                )[0],

            "director_target_turns":
                director_turn_window(
                    seed.get(
                        "target_length"
                    )
                )[1],

            "director_max_turns":
                director_turn_window(
                    seed.get(
                        "target_length"
                    )
                )[2],

            "quality_tier":
                seed.get(
                    "quality_tier",
                    "story",
                ),

            "player_synopsis":
                player_synopsis,
        },
    )


    adventure.validate()


    return adventure



# Backward-compatible name for older callers.
build_mock_runtime_adventure = (
    build_director_runtime_adventure
)
