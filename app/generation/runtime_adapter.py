from __future__ import annotations

from typing import (
    Any,
)

from app.generation.ascii_art import generate_scene_ascii_art
from app.adventures.models import (
    AdventureDefinition,
    CheckSpec,
    ChoiceDefinition,
    SceneDefinition,
)

from app.characters.models import (
    Skill,
    Stat,
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


    raw_opening = seed.get("opening_scene")
    opening = raw_opening if isinstance(raw_opening, dict) else {}

    start_title = (
        str(opening.get("title", "")).strip()
        or title.upper()
    )
    start_body = (
        str(opening.get("body", "")).strip()
        or premise
        or player_synopsis
        or "The story is already in motion when the Heroes arrive."
    )

    def opening_check(raw_check: Any) -> CheckSpec | None:
        if not isinstance(raw_check, dict):
            return None
        raw_skill = str(raw_check.get("skill") or "").strip()
        raw_stat = str(raw_check.get("stat") or "").strip()
        try:
            skill = Skill(raw_skill) if raw_skill else None
            stat = Stat(raw_stat) if raw_stat else None
        except ValueError:
            return None
        if bool(skill) == bool(stat):
            return None
        return CheckSpec(
            difficulty=max(3, min(16, int(raw_check.get("difficulty", 9) or 9))),
            skill=skill,
            stat=stat,
        )

    raw_opening_choices = opening.get("choices", [])
    opening_choices: list[ChoiceDefinition] = []
    if isinstance(raw_opening_choices, list):
        for index, raw_choice in enumerate(raw_opening_choices[:6]):
            if not isinstance(raw_choice, dict):
                continue
            label = str(raw_choice.get("label", "")).strip()
            if not label:
                continue
            opening_choices.append(ChoiceDefinition(
                id=f"opening_{index + 1}",
                label=label,
                description=str(raw_choice.get("description", "")).strip(),
                archetype=str(raw_choice.get("archetype", "")).strip(),
                tone=str(raw_choice.get("tone", "")).strip(),
                risk_level=str(raw_choice.get("risk_level", "")).strip(),
                reward_level=str(raw_choice.get("reward_level", "")).strip(),
                impact_level=str(raw_choice.get("impact_level", "")).strip(),
                possible_gains=tuple(
                    str(value).strip() for value in raw_choice.get("possible_gains", [])
                    if str(value).strip()
                ),
                possible_costs=tuple(
                    str(value).strip() for value in raw_choice.get("possible_costs", [])
                    if str(value).strip()
                ),
                check=opening_check(raw_choice.get("check")),
            ))

    # Backward compatibility for already-approved seeds created before Pass 40.
    # Never restore the old fake LET'S GO gate: give legacy adventures a real
    # three-way first decision immediately, using the best spoiler-safe prose we
    # already have. Newly generated seeds always carry an authored opening_scene.
    if len(opening_choices) < 3:
        opening_choices = [
            ChoiceDefinition(
                id="opening_1",
                label="LOOK CLOSER",
                description="Study the immediate situation before committing to a course of action.",
                archetype="investigate",
                tone="careful",
                risk_level="low",
                reward_level="moderate",
                impact_level="meaningful",
                possible_gains=("Useful information",),
                possible_costs=("Time and initiative",),
                check=CheckSpec(difficulty=8, skill=Skill.AWARENESS),
            ),
            ChoiceDefinition(
                id="opening_2",
                label="MOVE WITH PURPOSE",
                description="Act on the most urgent opening before circumstances can close it.",
                archetype="direct",
                tone="decisive",
                risk_level="moderate",
                reward_level="high",
                impact_level="scene_shifting",
                possible_gains=("Position and momentum",),
                possible_costs=("Exposure to immediate danger",),
                check=CheckSpec(difficulty=10, stat=Stat.AGILITY),
            ),
            ChoiceDefinition(
                id="opening_3",
                label="TEST THE ROOM",
                description="Engage whoever or whatever is shaping the moment and see what reacts.",
                archetype="social",
                tone="bold",
                risk_level="high",
                reward_level="high",
                impact_level="meaningful",
                possible_gains=("Leverage or a revealing reaction",),
                possible_costs=("Attention from the wrong source",),
                check=CheckSpec(difficulty=12, stat=Stat.PRESENCE),
            ),
        ]


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
                        start_title,

                    body=
                        start_body,

                    ascii_art=
                        generate_scene_ascii_art(
                            title=title.upper(),
                            body=start_body,
                            goal=core_goal,
                            threat=str(seed.get("core_threat", "")),
                            mood=str(seed.get("tone", "")),
                        ),

                    choices=
                        tuple(opening_choices),

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

            # Generated adventures remain registered for already-running
            # rooms, but retirement can remove them from player discovery
            # immediately without breaking those live session references.
            "catalog_visible":
                True,
        },
    )


    adventure.validate()


    return adventure



# Backward-compatible name for older callers.
build_mock_runtime_adventure = (
    build_director_runtime_adventure
)
