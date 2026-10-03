from __future__ import annotations

from copy import (
    deepcopy,
)

from dataclasses import (
    dataclass,
    field,
)

from typing import (
    Any,
)

from app.adventures.bootstrap import (
    register_builtin_adventures,
)

from app.adventures.models import (
    AdventureDefinition,
    CheckSpec,
    ChoiceDefinition,
    SceneDefinition,
)

from app.adventures.registry import (
    adventure_registry,
)

from app.characters.progression import (
    choice_xp_breakdown,
)

from app.characters.models import (
    Character,
    Skill,
    Stat,
)

from app.game.check_engine import (
    perform_character_check,
)

from app.game.challenge_scaling import (
    build_challenge_profile,
    scale_director_difficulty,
)

from app.game.micro_events import (
    MAX_MICRO_EVENT_HISTORY,
    build_micro_event,
    public_micro_event,
    resolve_micro_event,
    should_schedule_micro_event,
)


# =========================================================
# BUILT-IN CONTENT
# =========================================================

DEFAULT_ADVENTURE_ID = (
    "old_chapel"
)


register_builtin_adventures()


# =========================================================
# BACKWARD-COMPATIBILITY ALIASES
#
# These keep older imports working while the content models
# now live under app.adventures.
# =========================================================

ChoiceCheck = CheckSpec
Choice = ChoiceDefinition
Scene = SceneDefinition


# =========================================================
# RUNTIME SCENE VIEW
#
# The adventure definition is immutable content.
# This small view binds that content to a session's mutable
# world flags so existing callers can continue using:
#
#     session.scene.public_data()
#
# without needing to know about the content/runtime split.
# =========================================================

@dataclass(
    frozen=True
)
class RuntimeSceneView:

    definition: SceneDefinition

    world_flags: dict[
        str,
        Any,
    ]


    @property
    def id(
        self,
    ) -> str:

        return self.definition.id


    @property
    def title(
        self,
    ) -> str:

        return self.definition.title


    @property
    def body(
        self,
    ) -> str:

        return self.definition.body


    @property
    def ascii_art(
        self,
    ) -> str:

        return self.definition.ascii_art


    @property
    def choices(
        self,
    ) -> tuple[
        ChoiceDefinition,
        ...,
    ]:

        return (
            self.definition
            .available_choices(
                self.world_flags
            )
        )


    @property
    def next_scene_id(
        self,
    ) -> str | None:

        return (
            self.definition
            .default_next_scene_id
        )


    def public_data(
        self,
    ) -> dict:

        return (
            self.definition
            .public_data(
                self.world_flags
            )
        )


# =========================================================
# LIVE GAME SESSION
# =========================================================

@dataclass
class GameSession:

    room_code: str

    adventure_id: str = (
        DEFAULT_ADVENTURE_ID
    )

    scene_id: str | None = None

    turn_number: int = 1


    # player_id -> choice_id

    submissions: dict[
        str,
        str,
    ] = field(
        default_factory=dict
    )


    world_flags: dict[
        str,
        Any,
    ] = field(
        default_factory=dict
    )


    last_resolution: str | None = None

    # AI-directed runtime state.
    dynamic_scene: dict[
        str,
        Any,
    ] | None = None

    director_memory: str = ""

    # Durable AI-directed soft state. This stores narrative continuity only;
    # canonical mechanics remain server-owned elsewhere.
    story_state: dict[
        str,
        Any,
    ] = field(
        default_factory=dict
    )

    director_history: list[
        dict[
            str,
            Any,
        ]
    ] = field(
        default_factory=list
    )

    director_min_turns: int = 0

    director_target_turns: int = 0

    director_max_turns: int = 0

    # Cooperative wrap-up vote state.  A wrap-up becomes active only after
    # every Hero in the room has acknowledged it.  Once active, the Director
    # is given an exact three-resolution runway to bring existing threads to
    # a satisfying close.
    wrap_up_votes: list[str] = field(default_factory=list)

    wrap_up_active: bool = False

    wrap_up_turns_remaining: int = 0

    # Canonical server-resolved facts for a turn waiting on the Director.
    # Once populated, retries MUST reuse these facts instead of rerolling.
    pending_turn_facts: dict[
        str,
        Any,
    ] | None = None

    # Lightweight party interaction inserted between selected story nodes.
    # These events are deterministic/server-authored and never call the
    # Director.  Main story choices remain locked while one is pending.
    pending_micro_event: dict[
        str,
        Any,
    ] | None = None

    micro_event_history: list[
        dict[
            str,
            Any,
        ]
    ] = field(
        default_factory=list
    )

    director_usage: dict[
        str,
        int,
    ] = field(
        default_factory=lambda: {
            "requests":
                0,

            "input_tokens":
                0,

            "output_tokens":
                0,

            "total_tokens":
                0,
        }
    )

    # Authoritative, non-truncated per-adventure character totals.
    # Narrative history is intentionally capped for Director context,
    # so permanent stats must never depend on director_history length.
    character_adventure_stats: dict[
        str,
        dict[
            str,
            Any,
        ],
    ] = field(
        default_factory=dict
    )

    completed: bool = False

    ending_label: str = ""

    # Intermission mini-game stats are adventure-scoped for now.
    # These are intentionally isolated so they can later be promoted
    # into account/achievement stats without affecting RPG mechanics.
    intermission_scores: dict[
        str,
        dict[
            str,
            int,
        ],
    ] = field(
        default_factory=dict
    )

    intermission_results: dict[
        str,
        dict[
            str,
            Any,
        ],
    ] = field(
        default_factory=dict
    )

    intermission_wins: dict[
        str,
        int,
    ] = field(
        default_factory=dict
    )


    def __post_init__(
        self,
    ) -> None:

        adventure = (
            self.adventure
        )


        dynamic_scene_id = (
            str(
                self.dynamic_scene.get(
                    "id",
                    "",
                )
            ).strip()

            if isinstance(
                self.dynamic_scene,
                dict,
            )

            else ""
        )


        if (
            self.scene_id is None
            or (
                self.scene_id
                not in adventure.scenes
                and self.scene_id
                != dynamic_scene_id
            )
        ):

            self.scene_id = (
                adventure.starting_scene_id
            )


        if (
            adventure.metadata.get(
                "runtime_mode"
            )
            == "ai_director"
        ):

            metadata_min = int(
                adventure.metadata.get(
                    "director_min_turns",
                    8,
                )
                or 8
            )

            metadata_target = int(
                adventure.metadata.get(
                    "director_target_turns",
                    12,
                )
                or 12
            )

            metadata_max = int(
                adventure.metadata.get(
                    "director_max_turns",
                    16,
                )
                or 16
            )


            # Preserve values restored from an existing room snapshot.
            # Old 10-turn adventures therefore stay 10-turn adventures
            # instead of silently changing length after an upgrade.
            if self.director_min_turns <= 0:

                self.director_min_turns = (
                    metadata_min
                )


            if self.director_target_turns <= 0:

                self.director_target_turns = (
                    metadata_target
                )


            if self.director_max_turns <= 0:

                self.director_max_turns = (
                    metadata_max
                )


            self.director_max_turns = max(
                1,
                self.director_max_turns,
            )

            self.director_min_turns = max(
                1,
                min(
                    self.director_min_turns,
                    self.director_max_turns,
                ),
            )

            self.director_target_turns = max(
                self.director_min_turns,
                min(
                    self.director_target_turns,
                    self.director_max_turns,
                ),
            )


    @property
    def adventure(
        self,
    ) -> AdventureDefinition:

        return (
            adventure_registry.get(
                self.adventure_id
            )
        )


    @property
    def is_ai_directed(
        self,
    ) -> bool:

        return (
            self.adventure
            .metadata
            .get(
                "runtime_mode"
            )
            == "ai_director"
        )


    def _dynamic_scene_definition(
        self,
    ) -> SceneDefinition | None:

        data = (
            self.dynamic_scene
        )


        if not isinstance(
            data,
            dict,
        ):

            return None


        if (
            str(
                data.get(
                    "id",
                    "",
                )
            )
            != self.scene_id
        ):

            return None


        raw_choices = (
            data.get(
                "choices",
                [],
            )
        )


        def build_check(
            item: dict,
        ) -> CheckSpec | None:

            raw_check = (
                item.get(
                    "check"
                )
            )


            if not isinstance(
                raw_check,
                dict,
            ):

                return None


            raw_skill = (
                raw_check.get(
                    "skill"
                )
            )

            raw_stat = (
                raw_check.get(
                    "stat"
                )
            )


            skill = (
                Skill(
                    raw_skill
                )

                if raw_skill

                else None
            )

            stat = (
                Stat(
                    raw_stat
                )

                if raw_stat

                else None
            )


            return CheckSpec(

                difficulty=
                    int(
                        raw_check[
                            "difficulty"
                        ]
                    ),

                skill=
                    skill,

                stat=
                    stat,

                base_difficulty=(
                    int(raw_check["base_difficulty"])
                    if raw_check.get("base_difficulty") is not None
                    else None
                ),

                challenge_tier=str(raw_check.get("challenge_tier") or ""),
                effective_party_level=(
                    int(raw_check["effective_party_level"])
                    if raw_check.get("effective_party_level") is not None
                    else None
                ),
                level_adjustment=int(raw_check.get("level_adjustment", 0) or 0),
                adventure_adjustment=int(raw_check.get("adventure_adjustment", 0) or 0),
            )


        choices = tuple(
            ChoiceDefinition(

                id=
                    str(
                        item.get(
                            "id",
                            "",
                        )
                    ),

                label=
                    str(
                        item.get(
                            "label",
                            "",
                        )
                    ),

                description=
                    str(item.get("description", "")),

                archetype=
                    str(item.get("archetype", "")),

                tone=
                    str(item.get("tone", "")),

                risk_level=
                    str(item.get("risk_level", "")),

                reward_level=
                    str(item.get("reward_level", "")),

                impact_level=
                    str(item.get("impact_level", "")),

                possible_gains=
                    tuple(
                        str(value)
                        for value in item.get("possible_gains", [])
                        if str(value).strip()
                    ),

                possible_costs=
                    tuple(
                        str(value)
                        for value in item.get("possible_costs", [])
                        if str(value).strip()
                    ),

                check=
                    build_check(
                        item
                    ),
            )

            for item
            in raw_choices

            if (
                isinstance(
                    item,
                    dict,
                )
                and str(
                    item.get(
                        "id",
                        "",
                    )
                ).strip()
                and str(
                    item.get(
                        "label",
                        "",
                    )
                ).strip()
            )
        )


        return SceneDefinition(

            id=
                str(
                    data.get(
                        "id"
                    )
                ),

            title=
                str(
                    data.get(
                        "title",
                        "THE STORY CONTINUES",
                    )
                ),

            body=
                str(
                    data.get(
                        "body",
                        "",
                    )
                ),

            ascii_art=
                str(
                    data.get(
                        "ascii_art",
                        "",
                    )
                ),

            choices=
                choices,

            default_next_scene_id=
                None,
        )


    @property
    def scene(
        self,
    ) -> RuntimeSceneView:

        assert (
            self.scene_id
            is not None
        )


        definition = (
            self._dynamic_scene_definition()
        )


        if definition is None:

            definition = (
                self.adventure.scene(
                    self.scene_id
                )
            )


        return RuntimeSceneView(

            definition=
                definition,

            world_flags=
                self.world_flags,
        )


# =========================================================
# SESSION MANAGER
# =========================================================

class GameSessionManager:

    def __init__(
        self,
    ) -> None:

        self._sessions: dict[
            str,
            GameSession,
        ] = {}


    # =====================================================
    # SESSION LIFECYCLE
    # =====================================================

    def create(
        self,
        room_code: str,
        adventure_id: str = (
            DEFAULT_ADVENTURE_ID
        ),
    ) -> GameSession:

        adventure_registry.get(
            adventure_id
        )


        session = GameSession(

            room_code=
                room_code,

            adventure_id=
                adventure_id,
        )


        self._sessions[
            room_code
        ] = session


        return session


    def get(
        self,
        room_code: str,
    ) -> GameSession | None:

        return self._sessions.get(
            room_code
        )


    def get_or_create(
        self,
        room_code: str,
    ) -> GameSession:

        session = self.get(
            room_code
        )


        if session is None:

            session = self.create(
                room_code
            )


        return session


    def remove(
        self,
        room_code: str,
    ) -> None:

        self._sessions.pop(
            room_code,
            None,
        )


    # =====================================================
    # PERSISTENCE / RESTORATION
    # =====================================================

    def clear(
        self,
    ) -> None:

        self._sessions.clear()


    def restore_session(
        self,
        room_code: str,
        data: dict,
    ) -> GameSession:

        adventure_id = str(
            data.get(
                "adventure_id",
                DEFAULT_ADVENTURE_ID,
            )
            or DEFAULT_ADVENTURE_ID
        )


        # Old snapshots predate adventure_id. Unknown or
        # removed adventure ids safely fall back to the
        # original built-in chapel.

        if not adventure_registry.exists(
            adventure_id
        ):

            adventure_id = (
                DEFAULT_ADVENTURE_ID
            )


        adventure = (
            adventure_registry.get(
                adventure_id
            )
        )


        scene_id = str(
            data.get(
                "scene_id",
                adventure.starting_scene_id,
            )
            or adventure.starting_scene_id
        )


        # AI-directed adventures move into runtime-generated scenes that are
        # intentionally not present in adventure.scenes.
        #
        # Older restore logic treated every non-static scene id as stale and
        # reset it to generated_opening. That is why a resumed adventure
        # could return to the first decision even though dynamic_scene,
        # director history, and turn_number were correctly persisted.
        #
        # Prefer the persisted dynamic scene whenever it has a valid id.
        # This also heals snapshots already affected by the old restore path:
        # if scene_id says generated_opening but dynamic_scene says ai_turn_7,
        # ai_turn_7 is the real current scene.

        raw_dynamic_scene = (
            data.get(
                "dynamic_scene"
            )
        )


        dynamic_scene_id = (
            str(
                raw_dynamic_scene.get(
                    "id",
                    "",
                )
            ).strip()

            if isinstance(
                raw_dynamic_scene,
                dict,
            )

            else ""
        )


        if (
            dynamic_scene_id
            and adventure.metadata.get(
                "runtime_mode"
            )
            == "ai_director"
        ):

            scene_id = (
                dynamic_scene_id
            )

        elif (
            scene_id
            not in adventure.scenes
        ):

            # Protect static adventures against stale/removed content.

            scene_id = (
                adventure.starting_scene_id
            )


        raw_world_flags = (
            data.get(
                "world_flags",
                {},
            )
        )


        world_flags = (
            dict(
                raw_world_flags
            )

            if isinstance(
                raw_world_flags,
                dict,
            )

            else {}
        )


        session = GameSession(

            room_code=
                room_code,

            adventure_id=
                adventure_id,

            scene_id=
                scene_id,

            turn_number=
                int(
                    data.get(
                        "turn_number",
                        1,
                    )
                ),

            submissions=
                dict(
                    data.get(
                        "submissions",
                        {},
                    )
                ),

            world_flags=
                world_flags,

            last_resolution=
                data.get(
                    "last_resolution"
                ),

            dynamic_scene=
                (
                    dict(
                        data.get(
                            "dynamic_scene",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "dynamic_scene"
                        ),
                        dict,
                    )

                    else None
                ),

            director_memory=
                str(
                    data.get(
                        "director_memory",
                        "",
                    )
                    or ""
                ),

            story_state=
                (
                    deepcopy(
                        data.get(
                            "story_state",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "story_state"
                        ),
                        dict,
                    )

                    else {}
                ),

            director_history=
                (
                    list(
                        data.get(
                            "director_history",
                            [],
                        )
                    )

                    if isinstance(
                        data.get(
                            "director_history"
                        ),
                        list,
                    )

                    else []
                ),

            director_min_turns=
                int(
                    data.get(
                        "director_min_turns",
                        0,
                    )
                    or 0
                ),

            director_target_turns=
                int(
                    data.get(
                        "director_target_turns",
                        0,
                    )
                    or 0
                ),

            director_max_turns=
                int(
                    data.get(
                        "director_max_turns",
                        0,
                    )
                    or 0
                ),

            wrap_up_votes=
                [
                    str(value)
                    for value in data.get(
                        "wrap_up_votes",
                        [],
                    )
                    if str(value).strip()
                ]
                if isinstance(data.get("wrap_up_votes", []), list)
                else [],

            wrap_up_active=
                bool(
                    data.get(
                        "wrap_up_active",
                        False,
                    )
                ),

            wrap_up_turns_remaining=
                max(
                    0,
                    int(
                        data.get(
                            "wrap_up_turns_remaining",
                            0,
                        )
                        or 0
                    ),
                ),

            pending_turn_facts=
                (
                    dict(
                        data.get(
                            "pending_turn_facts",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "pending_turn_facts"
                        ),
                        dict,
                    )
                    and data.get(
                        "pending_turn_facts"
                    )

                    else None
                ),

            pending_micro_event=
                (
                    deepcopy(data.get("pending_micro_event"))
                    if isinstance(data.get("pending_micro_event"), dict)
                    and data.get("pending_micro_event")
                    else None
                ),

            micro_event_history=
                (
                    deepcopy(data.get("micro_event_history", []))
                    if isinstance(data.get("micro_event_history"), list)
                    else []
                ),

            director_usage=
                (
                    {
                        "requests":
                            int(
                                data.get(
                                    "director_usage",
                                    {},
                                ).get(
                                    "requests",
                                    0,
                                )
                                or 0
                            ),

                        "input_tokens":
                            int(
                                data.get(
                                    "director_usage",
                                    {},
                                ).get(
                                    "input_tokens",
                                    0,
                                )
                                or 0
                            ),

                        "output_tokens":
                            int(
                                data.get(
                                    "director_usage",
                                    {},
                                ).get(
                                    "output_tokens",
                                    0,
                                )
                                or 0
                            ),

                        "total_tokens":
                            int(
                                data.get(
                                    "director_usage",
                                    {},
                                ).get(
                                    "total_tokens",
                                    0,
                                )
                                or 0
                            ),
                    }

                    if isinstance(
                        data.get(
                            "director_usage"
                        ),
                        dict,
                    )

                    else {
                        "requests":
                            0,

                        "input_tokens":
                            0,

                        "output_tokens":
                            0,

                        "total_tokens":
                            0,
                    }
                ),

            character_adventure_stats=
                (
                    deepcopy(
                        data.get(
                            "character_adventure_stats",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "character_adventure_stats"
                        ),
                        dict,
                    )

                    else {}
                ),

            completed=
                bool(
                    data.get(
                        "completed",
                        False,
                    )
                ),

            ending_label=
                str(
                    data.get(
                        "ending_label",
                        "",
                    )
                    or ""
                ),

            intermission_scores=
                (
                    dict(
                        data.get(
                            "intermission_scores",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "intermission_scores"
                        ),
                        dict,
                    )

                    else {}
                ),

            intermission_results=
                (
                    dict(
                        data.get(
                            "intermission_results",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "intermission_results"
                        ),
                        dict,
                    )

                    else {}
                ),

            intermission_wins=
                (
                    dict(
                        data.get(
                            "intermission_wins",
                            {},
                        )
                    )

                    if isinstance(
                        data.get(
                            "intermission_wins"
                        ),
                        dict,
                    )

                    else {}
                ),
        )


        self._sessions[
            room_code
        ] = session


        return session


    # =====================================================
    # QUICK MICRO-EVENTS
    # =====================================================

    def maybe_schedule_micro_event(
        self,
        room_code: str,
        *,
        resolved_turn_number: int,
    ) -> dict | None:

        session = self.get_or_create(room_code)

        if (
            not session.is_ai_directed
            or session.pending_micro_event is not None
            or not should_schedule_micro_event(
                resolved_turn_number=resolved_turn_number,
                completed=session.completed,
                wrap_up_active=session.wrap_up_active,
            )
        ):
            return None

        event = build_micro_event(
            room_code=room_code,
            resolved_turn_number=resolved_turn_number,
            scene_title=session.scene.title,
            scene_body=session.scene.body,
            last_resolution=str(session.last_resolution or ""),
            story_state=dict(session.story_state),
        )
        session.pending_micro_event = event
        return public_micro_event(event)


    def submit_micro_event_choice(
        self,
        room_code: str,
        *,
        player_id: str,
        option_id: str,
        required_player_ids: list[str],
        response_names: dict[str, str],
    ) -> tuple[dict, bool]:

        session = self.get_or_create(room_code)
        event = session.pending_micro_event

        if not isinstance(event, dict) or not event:
            raise ValueError("There is no quick event waiting for a response.")

        timeout_response = str(option_id) == "__timeout__"

        option = next(
            (
                item
                for item in event.get("options", [])
                if isinstance(item, dict)
                and str(item.get("id", "")) == str(option_id)
            ),
            None,
        )

        if option is None and not timeout_response:
            raise ValueError("That quick-event response is not available.")

        responses = event.setdefault("responses", {})
        responses[str(player_id)] = str(option_id)

        required = [str(value) for value in required_player_ids if str(value).strip()]
        complete = bool(required) and all(player in responses for player in required)

        if complete:
            history_entry = resolve_micro_event(
                event=event,
                response_names=response_names,
            )

            # Preserve the individual reactions as durable story facts.  The
            # next Director call receives this history explicitly.
            for outcome in history_entry.get("outcomes", []):
                player_key = str(outcome.get("player_id", ""))
                option_key = str(outcome.get("option_id", ""))
                if player_key and option_key:
                    session.world_flags[
                        f"micro_event:{event.get('id')}:{player_key}"
                    ] = option_key

            session.micro_event_history.append(history_entry)
            session.micro_event_history = session.micro_event_history[-MAX_MICRO_EVENT_HISTORY:]
            event["resolved"] = True
            event["resolution"] = history_entry.get("resolution", "")
            event["outcomes"] = deepcopy(history_entry.get("outcomes", []))
            public_event = public_micro_event(event) or {}
            session.pending_micro_event = None
            return public_event, True

        return public_micro_event(event) or {}, False


    # =====================================================
    # PLAYER SUBMISSIONS
    # =====================================================

    def remove_player_submission(
        self,
        room_code: str,
        player_id: str,
    ) -> None:

        session = self.get(
            room_code
        )


        if session is None:

            return


        session.submissions.pop(
            player_id,
            None,
        )


    def submit_choice(
        self,
        room_code: str,
        player_id: str,
        choice_id: str,
    ) -> ChoiceDefinition:

        session = (
            self.get_or_create(
                room_code
            )
        )


        if session.completed:

            raise ValueError(
                "This adventure is complete."
            )


        if session.pending_micro_event is not None:

            raise ValueError(
                "Resolve the quick event before choosing the next action."
            )


        if (
            session.pending_turn_facts
            is not None
        ):

            pending_result = next(
                (
                    result
                    for result
                    in session.pending_turn_facts.get(
                        "results",
                        []
                    )
                    if result.get(
                        "player_id"
                    )
                    == player_id
                ),
                None,
            )


            if (
                pending_result
                is not None
            ):

                pending_choice_id = str(
                    pending_result.get(
                        "choice_id",
                        "",
                    )
                )


                if (
                    choice_id
                    != pending_choice_id
                ):

                    raise ValueError(
                        "This turn is already locked while the story is advancing."
                    )


        choice = next(
            (
                choice
                for choice
                in session.scene.choices
                if choice.id
                == choice_id
            ),
            None,
        )


        if choice is None:

            raise ValueError(
                "That choice is not available."
            )


        session.submissions[
            player_id
        ] = choice.id


        return choice


    def all_players_ready(
        self,
        room_code: str,
        player_ids: list[
            str
        ],
        required_players: int = 2,
    ) -> bool:

        session = self.get(
            room_code
        )


        if session is None:

            return False


        if (
            len(
                player_ids
            )
            < max(
                1,
                int(
                    required_players
                    or 1
                ),
            )
        ):

            return False


        return all(

            player_id
            in session.submissions

            for player_id
            in player_ids
        )


    # =====================================================
    # CHOICE LOOKUP
    # =====================================================

    @staticmethod
    def _find_choice(
        scene: RuntimeSceneView,
        choice_id: str | None,
    ) -> ChoiceDefinition | None:

        if not choice_id:

            return None


        return next(
            (
                choice
                for choice
                in scene.choices
                if choice.id
                == choice_id
            ),
            None,
        )


    # =====================================================
    # CHECK RESOLUTION
    # =====================================================

    @staticmethod
    def _resolve_choice_check(
        choice: ChoiceDefinition,
        character: Character,
    ) -> dict | None:

        if (
            choice.check
            is None
        ):

            return None


        result = (
            perform_character_check(

                character=
                    character,

                request=
                    choice.check
                    .to_check_request(),
            )
        )


        return result.to_dict()


    # =====================================================
    # WORLD EFFECTS
    # =====================================================

    @staticmethod
    def _apply_choice_effects(
        session: GameSession,
        choices: list[
            ChoiceDefinition
        ],
    ) -> None:

        for choice in choices:

            for effect in (
                choice.set_flags
            ):

                session.world_flags[
                    effect.key
                ] = effect.value


    @staticmethod
    def _next_scene_id(
        scene: RuntimeSceneView,
        choices: list[
            ChoiceDefinition
        ],
    ) -> str | None:

        explicit_targets = {
            choice.next_scene_id

            for choice
            in choices

            if (
                choice.next_scene_id
                is not None
            )
        }


        # A single explicit branch is unambiguous.
        # If players choose conflicting explicit branches,
        # fall back to the scene's deterministic default.
        #
        # Current chapel content uses only defaults, so this
        # preserves the live game exactly.

        if (
            len(
                explicit_targets
            )
            == 1
        ):

            return next(
                iter(
                    explicit_targets
                )
            )


        return scene.next_scene_id


    # =====================================================
    # RESOLUTION TEXT
    # =====================================================

    @staticmethod
    def _format_result_text(
        result: dict,
    ) -> list[str]:

        player_name = (
            result[
                "player_name"
            ]
        )


        choice_label = (
            result[
                "choice_label"
            ]
        )


        lines = [

            (
                f"{player_name} chose "
                f"{choice_label}."
            )
        ]


        check = result.get(
            "check"
        )


        if check is None:

            return lines


        stat_label = (
            str(
                check[
                    "stat"
                ]
            )
            .replace(
                "_",
                " ",
            )
            .title()
        )


        skill = check.get(
            "skill"
        )


        skill_label = (
            str(
                skill
            )
            .replace(
                "_",
                " ",
            )
            .title()

            if skill
            else None
        )


        outcome_label = (
            str(
                check[
                    "outcome"
                ]
            )
            .replace(
                "_",
                " ",
            )
            .upper()
        )


        lines.append(
            (
                f"  CHECK: "
                f"{skill_label or stat_label} "
                f"vs DC {check['difficulty']}"
            )
        )


        lines.append(
            (
                f"  ROLL: "
                f"{check['roll']} "
                f"+ {stat_label} "
                f"{check['stat_value']}"
                + (
                    f" + {skill_label} "
                    f"{check['skill_value']}"

                    if skill_label
                    else ""
                )
                + (
                    f" + modifiers "
                    f"{check['equipment_modifier'] + check['situation_modifier'] + check['performance_modifier']}"

                    if (
                        check[
                            "equipment_modifier"
                        ]
                        or check[
                            "situation_modifier"
                        ]
                        or check[
                            "performance_modifier"
                        ]
                    )
                    else ""
                )
                + (
                    f" = {check['total']}"
                )
            )
        )


        lines.append(
            f"  RESULT: {outcome_label}"
        )


        return lines


    # =====================================================
    # TURN RESOLUTION
    # =====================================================

    def resolve_turn(
        self,
        room_code: str,
        players: dict,
        characters_by_player_id: dict[
            str,
            Character,
        ],
    ) -> dict:

        session = (
            self.get_or_create(
                room_code
            )
        )


        scene = (
            session.scene
        )


        if (
            session.is_ai_directed
            and session.pending_turn_facts
            is not None
        ):

            print(
                "[TURN FACTS REUSE] "
                f"room={room_code} "
                f"turn={session.turn_number}"
            )


            return deepcopy(
                session.pending_turn_facts
            )


        results: list[
            dict
        ] = []


        resolved_choices: list[
            ChoiceDefinition
        ] = []


        for (
            player_id,
            player,
        ) in players.items():

            choice_id = (
                session.submissions.get(
                    player_id
                )
            )


            choice = (
                self._find_choice(
                    scene,
                    choice_id,
                )
            )


            if choice is None:

                continue


            character = (
                characters_by_player_id
                .get(
                    player_id
                )
            )


            if character is None:

                raise ValueError(
                    f"Character data is missing "
                    f"for {player.name}."
                )


            if (
                character.character_id
                != player.character_id
            ):

                raise ValueError(
                    f"Character identity mismatch "
                    f"for {player.name}."
                )


            check_result = None


            if (
                choice.check
                is not None
            ):

                check_result = (
                    self._resolve_choice_check(
                        choice,
                        character,
                    )
                )


            xp_breakdown = (
                choice_xp_breakdown(
                    has_check=
                        choice.check is not None,
                    difficulty=(
                        choice.check.difficulty
                        if choice.check
                        else None
                    ),
                    risk_level=
                        choice.risk_level,
                    hero_level=
                        character.level,
                    outcome=(
                        check_result.get(
                            "outcome"
                        )
                        if isinstance(
                            check_result,
                            dict,
                        )
                        else None
                    ),
                    check_total=(
                        check_result.get(
                            "total"
                        )
                        if isinstance(
                            check_result,
                            dict,
                        )
                        else None
                    ),
                )
            )


            resolved_choices.append(
                choice
            )


            results.append(
                {
                    "player_id":
                        player_id,

                    "user_id":
                        player.user_id,

                    "character_id":
                        player.character_id,

                    "hero_level":
                        int(character.level or 1),

                    "player_name":
                        player.name,

                    "choice_id":
                        choice.id,

                    "choice_label":
                        choice.label,

                    "choice_risk_level":
                        xp_breakdown[
                            "risk_level"
                        ],

                    "xp_reward":
                        xp_breakdown[
                            "final_xp"
                        ],

                    "xp_breakdown":
                        xp_breakdown,

                    "check":
                        check_result,
                }
            )


        resolution_lines: list[
            str
        ] = []


        for result in results:

            result_lines = (
                self._format_result_text(
                    result
                )
            )


            if resolution_lines:

                resolution_lines.append(
                    ""
                )


            resolution_lines.extend(
                result_lines
            )


        resolution_text = (
            "\n".join(
                resolution_lines
            )
        )


        previous_scene_id = (
            session.scene.id
        )


        # For AI-directed adventures this function creates authoritative
        # TURN FACTS only. No turn/scene mutation happens until the AI
        # response has validated and commit_director_turn() is called.
        if session.is_ai_directed:

            turn_facts = {
                "adventure_id":
                    session.adventure_id,

                "previous_scene_id":
                    previous_scene_id,

                "scene_id":
                    session.scene.id,

                "resolution":
                    resolution_text,

                "results":
                    results,

                "turn_number":
                    session.turn_number,

                "world_flags":
                    dict(
                        session.world_flags
                    ),
            }


            # Freeze the authoritative rolls/choices BEFORE any model call.
            # If the Director times out, crashes, or the server restarts,
            # the exact same facts are reused.
            session.pending_turn_facts = (
                deepcopy(
                    turn_facts
                )
            )


            return deepcopy(
                turn_facts
            )


        session.last_resolution = (
            resolution_text
        )


        self._apply_choice_effects(
            session,
            resolved_choices,
        )


        next_scene_id = (
            self._next_scene_id(
                scene,
                resolved_choices,
            )
        )


        if next_scene_id:

            session.scene_id = (
                next_scene_id
            )


        session.turn_number += 1


        # Only clear after the entire turn resolves
        # successfully.

        session.submissions.clear()


        return {
            "adventure_id":
                session.adventure_id,

            "previous_scene_id":
                previous_scene_id,

            "scene_id":
                session.scene_id,

            "resolution":
                resolution_text,

            "results":
                results,

            "turn_number":
                session.turn_number,

            "world_flags":
                dict(
                    session.world_flags
                ),
        }


    # =====================================================
    # AI DIRECTOR COMMIT
    # =====================================================

    def commit_director_turn(
        self,
        room_code: str,
        *,
        turn_facts: dict,
        director_output: dict,
        characters_by_player_id: dict[str, Character] | None = None,
    ) -> dict:

        session = (
            self.get_or_create(
                room_code
            )
        )


        if not session.is_ai_directed:

            raise ValueError(
                "This session is not AI-directed."
            )


        if session.completed:

            raise ValueError(
                "This adventure is already complete."
            )


        canonical_turn_facts = (
            deepcopy(
                session.pending_turn_facts
            )

            if session.pending_turn_facts
            is not None

            else deepcopy(
                turn_facts
            )
        )


        supplied_characters = characters_by_player_id or {}
        hero_levels = [
            int(character.level or 1)
            for character in supplied_characters.values()
            if character is not None
        ]

        if not hero_levels:
            hero_levels = [
                int(item.get("hero_level", 1) or 1)
                for item in canonical_turn_facts.get("results", [])
                if isinstance(item, dict)
            ]

        challenge_profile = build_challenge_profile(
            hero_levels,
            adventure_difficulty=(
                session.adventure.metadata.get("difficulty")
                if isinstance(session.adventure.metadata, dict)
                else None
            ),
        )


        resolved_turn = int(
            session.turn_number
        )

        completed = bool(
            director_output.get(
                "completed",
                False,
            )
        )


        next_turn = (
            resolved_turn
            if completed
            else resolved_turn + 1
        )


        raw_choices = (
            director_output.get(
                "choices",
                []
            )
        )


        if (
            not completed
            and len(
                raw_choices
            )
            < 3
        ):

            raise ValueError(
                "Story Director returned fewer than 3 active choices."
            )


        choices = []


        if not completed:

            for (
                index,
                raw_choice,
            ) in enumerate(
                raw_choices
            ):

                # Backward compatibility:
                # older tests / already-materialized Director payloads used
                # plain string choices. Treat those exactly like an unchecked
                # structured choice instead of rejecting them.
                if isinstance(
                    raw_choice,
                    str,
                ):

                    raw_choice = {
                        "label":
                            raw_choice,

                        "check":
                            None,
                    }


                if not isinstance(
                    raw_choice,
                    dict,
                ):

                    raise ValueError(
                        "Story Director returned an invalid choice."
                    )


                label = str(
                    raw_choice.get(
                        "label",
                        "",
                    )
                ).strip()


                if not label:

                    raise ValueError(
                        "Story Director returned a blank choice."
                    )


                normalized_check = None

                raw_check = (
                    raw_choice.get(
                        "check"
                    )
                )


                if raw_check is not None:

                    if not isinstance(
                        raw_check,
                        dict,
                    ):

                        raise ValueError(
                            "Story Director returned an invalid check."
                        )


                    difficulty = int(
                        raw_check.get(
                            "difficulty",
                            0,
                        )
                    )


                    if (
                        difficulty < 3
                        or difficulty > 16
                    ):

                        raise ValueError(
                            "Story Director check difficulty is outside 3-16."
                        )


                    raw_skill = (
                        raw_check.get(
                            "skill"
                        )
                    )

                    raw_stat = (
                        raw_check.get(
                            "stat"
                        )
                    )


                    if (
                        bool(
                            raw_skill
                        )
                        == bool(
                            raw_stat
                        )
                    ):

                        raise ValueError(
                            "A Story Director check must use exactly one skill or stat."
                        )


                    skill = (
                        Skill(
                            raw_skill
                        )

                        if raw_skill

                        else None
                    )

                    stat = (
                        Stat(
                            raw_stat
                        )

                        if raw_stat

                        else None
                    )


                    # The Director proposes only a novice-band relative
                    # difficulty (3-16). The server owns the final level-aware
                    # DC presented to the players and used for the roll.
                    scaled = scale_director_difficulty(
                        difficulty,
                        challenge_profile,
                    )

                    check_spec = CheckSpec(

                        difficulty=
                            int(scaled["difficulty"]),

                        skill=
                            skill,

                        stat=
                            stat,

                        base_difficulty=int(scaled["base_difficulty"]),
                        challenge_tier=str(scaled["challenge_tier"]),
                        effective_party_level=int(scaled["effective_party_level"]),
                        level_adjustment=int(scaled["level_adjustment"]),
                        adventure_adjustment=int(scaled["adventure_adjustment"]),
                    )


                    normalized_check = (
                        check_spec
                        .public_data()
                    )


                choices.append({
                    "id":
                        f"ai_t{next_turn}_{index + 1}",

                    "label":
                        label,

                    "description":
                        str(raw_choice.get("description", "")).strip(),

                    "archetype":
                        str(raw_choice.get("archetype", "")).strip(),

                    "tone":
                        str(raw_choice.get("tone", "")).strip(),

                    "risk_level":
                        str(raw_choice.get("risk_level", "")).strip(),

                    "reward_level":
                        str(raw_choice.get("reward_level", "")).strip(),

                    "impact_level":
                        str(raw_choice.get("impact_level", "")).strip(),

                    "possible_gains":
                        [
                            str(value).strip()
                            for value in raw_choice.get("possible_gains", [])
                            if str(value).strip()
                        ],

                    "possible_costs":
                        [
                            str(value).strip()
                            for value in raw_choice.get("possible_costs", [])
                            if str(value).strip()
                        ],

                    "check":
                        normalized_check,
                })


        scene_id = (
            f"ai_epilogue_t{resolved_turn}"

            if completed

            else f"ai_turn_{next_turn}"
        )


        session.dynamic_scene = {
            "id":
                scene_id,

            "title":
                str(
                    director_output.get(
                        "title",
                        "THE STORY CONTINUES",
                    )
                ).strip()
                or "THE STORY CONTINUES",

            "body":
                str(
                    director_output.get(
                        "scene_body",
                        "",
                    )
                ).strip(),

            "ascii_art":
                (
                    "       .  *  .\n"
                    "    *         *\n"
                    "       STORY\n"
                    "    *         *\n"
                    "       .  *  ."
                ),

            "choices":
                choices,
        }


        session.scene_id = (
            scene_id
        )


        session.last_resolution = (
            str(
                director_output.get(
                    "resolution_narration",
                    "",
                )
            ).strip()
        )


        session.director_memory = (
            str(
                director_output.get(
                    "memory_summary",
                    "",
                )
            ).strip()
        )


        raw_story_state = (
            director_output.get(
                "story_state"
            )
        )


        if isinstance(
            raw_story_state,
            dict,
        ):

            session.story_state = (
                deepcopy(
                    raw_story_state
                )
            )


        for result in canonical_turn_facts.get(
            "results",
            [],
        ):

            check = result.get(
                "check"
            )


            if not isinstance(
                check,
                dict,
            ):

                continue


            character_id = str(
                result.get(
                    "character_id",
                    check.get(
                        "character_id",
                        "",
                    ),
                )
                or ""
            )


            if not character_id:

                continue


            totals = (
                session
                .character_adventure_stats
                .setdefault(
                    character_id,
                    {
                        "checks_total": 0,
                        "checks_succeeded": 0,
                        "critical_successes": 0,
                        "critical_failures": 0,
                    },
                )
            )


            totals[
                "checks_total"
            ] = int(
                totals.get(
                    "checks_total",
                    0,
                )
            ) + 1


            outcome = str(
                check.get(
                    "outcome",
                    "",
                )
            )


            if outcome in {
                "success",
                "critical_success",
            }:

                totals[
                    "checks_succeeded"
                ] = int(
                    totals.get(
                        "checks_succeeded",
                        0,
                    )
                ) + 1


            if outcome == "critical_success":

                totals[
                    "critical_successes"
                ] = int(
                    totals.get(
                        "critical_successes",
                        0,
                    )
                ) + 1


            elif outcome == "critical_failure":

                totals[
                    "critical_failures"
                ] = int(
                    totals.get(
                        "critical_failures",
                        0,
                    )
                ) + 1


        session.director_history.append({
            "turn_number":
                resolved_turn,

            "choices": [
                {
                    "player_name":
                        result.get(
                            "player_name"
                        ),

                    "choice_label":
                        result.get(
                            "choice_label"
                        ),

                    "check":
                        result.get(
                            "check"
                        ),
                }

                for result
                in canonical_turn_facts.get(
                    "results",
                    []
                )
            ],

            "resolution":
                session.last_resolution,

            "offered_choices": [
                {
                    "label": str(choice.get("label", "")).strip(),
                    "description": str(choice.get("description", "")).strip(),
                }
                for choice in director_output.get("choices", [])
                if isinstance(choice, dict)
                and str(choice.get("label", "")).strip()
            ][:7],

            "scene_opening": (
                str(director_output.get("scene_body", "")).strip().split("\n", 1)[0][:280]
            ),

            "scene_title":
                session.dynamic_scene[
                    "title"
                ],

            "pressure_level":
                str(
                    director_output.get(
                        "pressure_level",
                        "",
                    )
                ).strip(),

            "scene_function":
                str(
                    director_output.get(
                        "scene_function",
                        "",
                    )
                ).strip(),

            "story_state_summary": {
                "current_goal":
                    str(
                        session.story_state.get(
                            "current_goal",
                            "",
                        )
                    ),

                "story_phase":
                    str(
                        session.story_state.get(
                            "story_phase",
                            "",
                        )
                    ),

                "unresolved_threads":
                    list(
                        session.story_state.get(
                            "unresolved_threads",
                            [],
                        )
                    )[
                        -6:
                    ],

                "closed_opportunities":
                    list(
                        session.story_state.get(
                            "closed_opportunities",
                            [],
                        )
                    )[
                        -4:
                    ],
            },

            "completed":
                completed,
        })


        session.director_history = (
            session.director_history[
                -10:
            ]
        )


        session.completed = (
            completed
        )


        if session.wrap_up_active:
            if completed:
                session.wrap_up_turns_remaining = 0
            else:
                session.wrap_up_turns_remaining = max(
                    0,
                    int(session.wrap_up_turns_remaining or 0) - 1,
                )


        session.ending_label = (
            str(
                director_output.get(
                    "ending_label",
                    "",
                )
            ).strip()

            if completed

            else ""
        )


        session.turn_number = (
            next_turn
        )


        usage = (
            director_output
            .get(
                "director_meta",
                {},
            )
            .get(
                "usage",
                {},
            )
        )


        session.director_usage[
            "requests"
        ] = (
            int(
                session.director_usage.get(
                    "requests",
                    0,
                )
            )
            + 1
        )


        for usage_key in (
            "input_tokens",
            "output_tokens",
            "total_tokens",
        ):

            session.director_usage[
                usage_key
            ] = (
                int(
                    session.director_usage.get(
                        usage_key,
                        0,
                    )
                )
                + int(
                    usage.get(
                        usage_key,
                        0,
                    )
                    or 0
                )
            )


        session.pending_turn_facts = (
            None
        )

        session.submissions.clear()


        print(
            "[DIRECTOR COMMIT] "
            f"room={room_code} "
            f"resolved_turn={resolved_turn} "
            f"next_turn={session.turn_number} "
            f"completed={session.completed}"
        )


        print(
            "[DIRECTOR USAGE] "
            f"room={room_code} "
            f"request_tokens={int(usage.get('total_tokens', 0) or 0)} "
            f"adventure_tokens={session.director_usage['total_tokens']} "
            f"requests={session.director_usage['requests']}"
        )


        return {
            "adventure_id":
                session.adventure_id,

            "previous_scene_id":
                canonical_turn_facts.get(
                    "previous_scene_id"
                ),

            "scene_id":
                session.scene.id,

            "resolution":
                session.last_resolution,

            "results":
                turn_facts.get(
                    "results",
                    []
                ),

            "turn_number":
                session.turn_number,

            "world_flags":
                dict(
                    session.world_flags
                ),

            "director":
                director_output.get(
                    "director_meta",
                    {}
                ),

            "completed":
                session.completed,

            "ending_label":
                session.ending_label,
        }


    # =====================================================
    # INTERMISSION MINI-GAMES
    # =====================================================

    @staticmethod
    def intermission_game_id(
        turn_number: int,
    ) -> str:

        game_ids = (
            "rune_catch",
            "lantern_keep",
            "relic_scramble",
            "sigil_memory",
            "ward_breaker",
            "shadow_step",
        )

        index = (
            max(
                1,
                int(
                    turn_number
                ),
            )
            - 1
        ) % len(
            game_ids
        )

        return game_ids[
            index
        ]


    def intermission_stats(
        self,
        room_code: str,
        players: dict,
    ) -> list[
        dict
    ]:

        session = (
            self.get_or_create(
                room_code
            )
        )


        return [
            {
                "player_id":
                    player_id,

                "name":
                    player.name,

                "wins":
                    int(
                        session
                        .intermission_wins
                        .get(
                            player_id,
                            0,
                        )
                    ),
            }

            for player_id, player
            in players.items()
        ]


    def submit_intermission_score(
        self,
        room_code: str,
        *,
        turn_number: int,
        game_id: str,
        player_id: str,
        score: int,
        players: dict,
    ) -> tuple[
        dict | None,
        bool,
    ]:

        session = (
            self.get_or_create(
                room_code
            )
        )


        turn_number = int(
            turn_number
        )

        expected_game = (
            self.intermission_game_id(
                turn_number
            )
        )


        if (
            game_id
            != expected_game
        ):

            raise ValueError(
                "That intermission game does not match this turn."
            )


        if (
            turn_number
            not in {
                session.turn_number,
                session.turn_number - 1,
            }
        ):

            raise ValueError(
                "That intermission score is stale."
            )


        score = max(
            0,
            min(
                999,
                int(
                    score
                ),
            ),
        )


        turn_key = str(
            turn_number
        )


        existing_result = (
            session
            .intermission_results
            .get(
                turn_key
            )
        )


        if existing_result is not None:

            return (
                existing_result,
                False,
            )


        scores = (
            session
            .intermission_scores
            .setdefault(
                turn_key,
                {},
            )
        )


        # A client may resubmit its final score after story-ready.
        # Keep the larger legitimate score rather than double-counting.
        scores[
            player_id
        ] = max(
            score,
            int(
                scores.get(
                    player_id,
                    0,
                )
            ),
        )


        player_ids = list(
            players.keys()
        )


        if not all(
            candidate_id
            in scores

            for candidate_id
            in player_ids
        ):

            return (
                None,
                False,
            )


        if len(
            player_ids
        ) == 1:

            solo_player_id = (
                player_ids[
                    0
                ]
            )

            result = {
                "turn_number":
                    turn_number,

                "game_id":
                    game_id,

                "solo":
                    True,

                "tie":
                    False,

                "winner_player_id":
                    None,

                "winner_name":
                    None,

                "scores": [
                    {
                        "player_id":
                            solo_player_id,

                        "name":
                            players[
                                solo_player_id
                            ].name,

                        "score":
                            int(
                                scores[
                                    solo_player_id
                                ]
                            ),

                        "wins":
                            int(
                                session
                                .intermission_wins
                                .get(
                                    solo_player_id,
                                    0,
                                )
                            ),
                    }
                ],
            }

            session.intermission_results[
                turn_key
            ] = result

            return (
                result,
                True,
            )


        top_score = max(
            scores[
                candidate_id
            ]

            for candidate_id
            in player_ids
        )


        winners = [
            candidate_id

            for candidate_id
            in player_ids

            if scores[
                candidate_id
            ]
            == top_score
        ]


        winner_id = (
            winners[
                0
            ]

            if len(
                winners
            )
            == 1

            else None
        )


        if winner_id is not None:

            session.intermission_wins[
                winner_id
            ] = (
                int(
                    session
                    .intermission_wins
                    .get(
                        winner_id,
                        0,
                    )
                )
                + 1
            )


        result = {
            "turn_number":
                turn_number,

            "game_id":
                game_id,

            "tie":
                winner_id is None,

            "winner_player_id":
                winner_id,

            "winner_name":
                (
                    players[
                        winner_id
                    ].name

                    if winner_id is not None

                    else None
                ),

            "scores": [
                {
                    "player_id":
                        candidate_id,

                    "name":
                        players[
                            candidate_id
                        ].name,

                    "score":
                        int(
                            scores[
                                candidate_id
                            ]
                        ),

                    "wins":
                        int(
                            session
                            .intermission_wins
                            .get(
                                candidate_id,
                                0,
                            )
                        ),
                }

                for candidate_id
                in player_ids
            ],
        }


        session.intermission_results[
            turn_key
        ] = result


        return (
            result,
            True,
        )


# =========================================================
# SINGLETON
# =========================================================

game_sessions = (
    GameSessionManager()
)
