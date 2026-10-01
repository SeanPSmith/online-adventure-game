from __future__ import annotations

import asyncio
import hashlib

from contextlib import (
    asynccontextmanager,
)

from pathlib import Path

import socketio

from fastapi import (
    FastAPI,
)

from fastapi.responses import (
    FileResponse,
)

from fastapi.staticfiles import (
    StaticFiles,
)

from app.auth.routes import (
    router as auth_router,
)

from app.auth.service import (
    auth_service,
)

from app.auth.socket_auth import (
    socket_auth,
)

from app.authoring.routes import (
    router as authoring_router,
)

from app.authoring.store import (
    authoring_store,
)

from app.generation.routes import (
    router as generation_router,
)

from app.generation.service import (
    generation_service,
)

from app.generation.director import (
    DirectorError,
    runtime_director,
)

from app.generation.store import (
    generated_adventure_store,
)

from app.characters.routes import (
    router as character_router,
)

from app.characters.service import (
    CharacterError,
    character_service,
)

from app.characters.advancement import (
    ADVANCEMENT_SKILL_CAP,
    ADVANCEMENT_STAT_CAP,
    award_for_level_transition,
)

from app.characters.progression import (
    level_for_experience,
    progression_public_data,
)

from app.characters.effects import (
    decay_finite_effect_turns,
)

from app.characters.health import (
    max_health_for_level,
    per_turn_health_cap,
    scaled_health_delta,
)

from app.adventures.registry import (
    adventure_registry,
)

from app.game.rooms import (
    rooms,
)

from app.game.session import (
    game_sessions,
)

from app.game.micro_events import (
    public_micro_event,
)

from app.networking.chat import (
    chat,
)

from app.persistence.bootstrap import (
    restore_runtime_state,
)

from app.persistence.store import (
    store,
)


# =========================================================
# PATHS
# =========================================================

BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
)

WEB_DIR = (
    BASE_DIR
    / "web"
)


# =========================================================
# SOCKET.IO
# =========================================================

sio = socketio.AsyncServer(

    async_mode=
        "asgi",

    cors_allowed_origins=
        [],
)


# =========================================================
# CONNECTED ACCOUNT SOCKETS
# =========================================================

_user_sids: dict[
    str,
    set[str],
] = {}


# Socket.IO choice handlers can overlap. A room lock guarantees that
# only one handler may resolve / direct a particular turn.
_turn_resolution_locks: dict[
    str,
    asyncio.Lock,
] = {}


# Rooms currently inside an outbound Director request. This is deliberately
# in-memory: after a process restart any persisted pending TurnFacts are
# considered retryable rather than pretending a vanished request is active.
_director_active_rooms: set[str] = set()


def turn_resolution_lock(
    room_code: str,
) -> asyncio.Lock:

    lock = _turn_resolution_locks.get(
        room_code
    )


    if lock is None:

        lock = asyncio.Lock()

        _turn_resolution_locks[
            room_code
        ] = lock


    return lock


def register_user_sid(
    user_id: str,
    sid: str,
) -> None:

    _user_sids.setdefault(
        user_id,
        set(),
    ).add(
        sid
    )


def unregister_user_sid(
    user_id: str,
    sid: str,
) -> None:

    sids = (
        _user_sids.get(
            user_id
        )
    )


    if (
        sids is None
    ):

        return


    sids.discard(
        sid
    )


    if (
        not sids
    ):

        _user_sids.pop(
            user_id,
            None,
        )


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(
    app: FastAPI,
):

    await store.initialize()

    await auth_service.initialize()

    await authoring_store.initialize()

    await generated_adventure_store.initialize()

    generated_registered = (
        await generation_service
        .register_approved_adventures()
    )

    await character_service.initialize()


    restored_rooms = (
        await restore_runtime_state()
    )


    socket_auth.clear()

    _user_sids.clear()

    _turn_resolution_locks.clear()

    _director_active_rooms.clear()


    print(
        f"[PERSISTENCE] "
        f"Restored {restored_rooms} room(s)."
    )


    print(
        f"[GENERATION] "
        f"Registered {generated_registered} "
        f"approved generated adventure(s)."
    )


    yield


# =========================================================
# FASTAPI
# =========================================================

fastapi_app = FastAPI(

    title=
        "Tales of Two",

    version=
        "0.5.1",

    lifespan=
        lifespan,
)


fastapi_app.include_router(
    auth_router
)


fastapi_app.include_router(
    authoring_router
)


fastapi_app.include_router(
    generation_router
)


fastapi_app.include_router(
    character_router
)


fastapi_app.mount(

    "/static",

    StaticFiles(
        directory=
            WEB_DIR
    ),

    name=
        "static",
)


@fastapi_app.get("/")
async def index():

    return FileResponse(
        WEB_DIR
        / "index.html"
    )


@fastapi_app.get(
    "/author"
)
@fastapi_app.get(
    "/author/"
)
async def author_console():

    return FileResponse(
        WEB_DIR
        / "author"
        / "index.html"
    )


@fastapi_app.get(
    "/health"
)
async def health():

    return {
        "status":
            "ok",

        "version":
            "0.5.1",
    }


# =========================================================
# GAME STATE
# =========================================================

def room_can_start_solo(
    room,
    session,
) -> bool:

    if (
        room is None
        or session is None
    ):

        return False


    if (
        getattr(
            room,
            "play_mode",
            "coop",
        )
        != "coop"
    ):

        return False


    if room.player_count != 1:

        return False


    only_player = next(
        iter(
            room.players.values()
        ),
        None,
    )


    if (
        only_player is None
        or not only_player.is_host
    ):

        return False


    # A generated opening scene may already have Director history or
    # pending story facts before the first Hero acts. Those are setup
    # artifacts, not evidence that co-op play has begun. Solo remains
    # available until a player has actually committed/resolved turn 1.
    return (
        int(
            session.turn_number
            or 1
        )
        == 1
        and not session.submissions
        and not session.last_resolution
        and not session.completed
    )


def build_game_state(
    room_code: str,
) -> dict | None:

    room = (
        rooms.room_by_code(
            room_code
        )
    )


    if (
        room is None
    ):

        return None


    session = (
        game_sessions.get_or_create(
            room_code
        )
    )


    readiness = []


    for (
        player_id,
        player,
    ) in room.players.items():

        readiness.append(
            {
                "player_id":
                    player_id,

                "user_id":
                    player.user_id,

                "character_id":
                    player.character_id,

                "name":
                    player.name,

                "online":
                    player.is_online,

                "ready":
                    player_id
                    in session.submissions,
            }
        )


    return {
        "room_code":
            room_code,

        "play_mode":
            room.play_mode,

        "required_players":
            room.required_players,

        "can_start_solo":
            room_can_start_solo(
                room,
                session,
            ),

        "adventure_id":
            session.adventure_id,

        "adventure_title":
            session.adventure.title,

        "turn_number":
            session.turn_number,

        "scene":
            session.scene.public_data(),

        "readiness":
            readiness,

        "last_resolution":
            session.last_resolution,

        "director_complete":
            session.completed,

        "ai_directed":
            session.is_ai_directed,

        "minimum_turns":
            (
                session.director_min_turns
                if session.is_ai_directed
                else None
            ),

        "target_turns":
            (
                session.director_target_turns
                if session.is_ai_directed
                else None
            ),

        "max_turns":
            (
                session.director_max_turns
                if session.is_ai_directed
                else None
            ),

        "wrap_up_available":
            bool(
                session.is_ai_directed
                and not session.completed
                and session.turn_number > 1
            ),

        "wrap_up_active":
            bool(session.wrap_up_active),

        "wrap_up_turns_remaining":
            int(session.wrap_up_turns_remaining or 0),

        "wrap_up_votes":
            list(session.wrap_up_votes),

        "turn_pending":
            bool(
                session.pending_turn_facts
            ),

        "director_request_active":
            room_code in _director_active_rooms,

        "director_retry_required":
            bool(
                session.pending_turn_facts
            )
            and room_code not in _director_active_rooms,

        # Durable transition metadata.  The one-shot
        # ``story_advancing`` event is still emitted for the happy path,
        # but clients can reconstruct the intermission after a missed
        # event, refresh, or reconnect while the Director is working.
        "pending_intermission":
            (
                {
                    "game_id":
                        game_sessions.intermission_game_id(
                            session.turn_number
                        ),

                    "play_mode":
                        room.play_mode,

                    "intermission_stats":
                        game_sessions.intermission_stats(
                            room.code,
                            room.players,
                        ),
                }
                if session.pending_turn_facts
                else None
            ),

        "pending_micro_event":
            public_micro_event(
                session.pending_micro_event
            ),

        "micro_event_history":
            list(
                session.micro_event_history[-4:]
            ),

        "director_usage":
            (
                dict(
                    session.director_usage
                )
                if session.is_ai_directed
                else None
            ),

        "story_state_summary":
            (
                {
                    "current_goal":
                        session.story_state.get(
                            "current_goal",
                            "",
                        ),

                    "story_phase":
                        session.story_state.get(
                            "story_phase",
                            "",
                        ),

                    "active_threat_count":
                        len(
                            session.story_state.get(
                                "active_threats",
                                [],
                            )
                        ),

                    "unresolved_thread_count":
                        len(
                            session.story_state.get(
                                "unresolved_threads",
                                [],
                            )
                        ),

                    "closed_opportunity_count":
                        len(
                            session.story_state.get(
                                "closed_opportunities",
                                [],
                            )
                        ),
                }

                if session.is_ai_directed
                else None
            ),

        "intermission_stats":
            game_sessions
            .intermission_stats(
                room_code,
                room.players,
            ),

        "last_intermission_result":
            (
                session
                .intermission_results
                .get(
                    str(
                        session.turn_number - 1
                    )
                )
            ),
    }


# =========================================================
# ADVENTURE CATALOG
# =========================================================

def build_adventure_catalog(
) -> list[
    dict
]:

    catalog = []


    for adventure in (
        adventure_registry.all()
    ):

        catalog.append(
            {
                "adventure_id":
                    adventure.id,

                "title":
                    adventure.title,

                "description":
                    adventure.description,

                "tags":
                    list(
                        adventure.tags
                    ),

                "metadata":
                    dict(
                        adventure.metadata
                    ),
            }
        )


    catalog.sort(
        key=lambda item:
            item[
                "title"
            ].lower()
    )


    return catalog


async def send_adventure_catalog(
    sid: str,
) -> None:

    await sio.emit(

        "adventure_catalog",

        {
            "adventures":
                build_adventure_catalog()
        },

        to=
            sid,
    )


# =========================================================
# ADVENTURE LIST
# =========================================================

def build_adventure_list(
    user_id: str,
) -> list[
    dict
]:

    adventures = []


    for (
        room,
        player,
    ) in rooms.adventures_for_user(
        user_id
    ):

        session = (
            game_sessions.get_or_create(
                room.code
            )
        )


        adventures.append(
            {
                "room_code":
                    room.code,

                "player_id":
                    player.player_id,

                "character_id":
                    player.character_id,

                "character_name":
                    player.name,

                "adventure_id":
                    session.adventure_id,

                "adventure_title":
                    session.adventure.title,

                "is_host":
                    player.is_host,

                "is_online":
                    player.is_online,

                "player_count":
                    room.player_count,

                "online_count":
                    room.online_count,

                "max_players":
                    room.max_players,

                "required_players":
                    room.required_players,

                "play_mode":
                    room.play_mode,

                "turn_number":
                    session.turn_number,

                "completed":
                    bool(session.completed),

                "ending_label":
                    str(session.ending_label or ""),

                "scene_id":
                    session.scene.id,

                "scene_title":
                    session.scene.title,

                "players": [
                    room_player.public_data()

                    for room_player
                    in room.players.values()
                ],
            }
        )


    adventures.sort(
        key=lambda adventure: (
            adventure[
                "character_name"
            ].lower(),

            adventure[
                "room_code"
            ],
        )
    )


    return adventures


async def send_adventure_list(
    sid: str,
    user_id: str,
) -> None:

    await sio.emit(

        "adventure_list",

        {
            "adventures":
                build_adventure_list(
                    user_id
                )
        },

        to=
            sid,
    )


async def send_adventure_list_to_user(
    user_id: str,
) -> None:

    for sid in list(
        _user_sids.get(
            user_id,
            set(),
        )
    ):

        await send_adventure_list(
            sid,
            user_id,
        )


async def refresh_adventure_lists(
    user_ids,
) -> None:

    for user_id in set(
        user_ids
    ):

        await send_adventure_list_to_user(
            user_id
        )


# =========================================================
# PERSISTENCE
# =========================================================

async def persist_room_state(
    room_code: str,
) -> None:

    room = (
        rooms.room_by_code(
            room_code
        )
    )


    if (
        room is None
    ):

        return


    session = (
        game_sessions.get_or_create(
            room_code
        )
    )


    await store.save_room_snapshot(
        room,
        session,
    )


# =========================================================
# BROADCAST
# =========================================================

async def broadcast_room_state(
    room_code: str,
) -> None:

    room = (
        rooms.room_by_code(
            room_code
        )
    )


    if (
        room is None
    ):

        return


    await sio.emit(

        "room_state",

        room.public_data(),

        room=
            room_code,
    )


async def broadcast_game_state(
    room_code: str,
) -> None:

    state = (
        build_game_state(
            room_code
        )
    )


    if (
        state is None
    ):

        return


    await sio.emit(

        "game_state",

        state,

        room=
            room_code,
    )


# =========================================================
# AUTH GUARD
# =========================================================

async def require_socket_user(
    sid: str,
    *,
    error_event: str = "room_error",
):

    user = (
        socket_auth.get_user(
            sid
        )
    )


    if (
        user is not None
    ):

        return user


    await sio.emit(

        error_event,

        {
            "message":
                "You must be logged in."
        },

        to=
            sid,
    )


    return None


# =========================================================
# CHARACTER GUARD
# =========================================================

async def require_owned_character(
    sid: str,
    user,
    data: dict,
):

    character_id = str(
        data.get(
            "character_id",
            "",
        )
        or ""
    ).strip()


    if (
        not character_id
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Select a character first."
            },

            to=
                sid,
        )

        return None


    try:

        return (
            await character_service
            .get_owned_character(

                owner_user_id=
                    user.user_id,

                character_id=
                    character_id,
            )
        )

    except CharacterError:

        await sio.emit(

            "room_error",

            {
                "message":
                    "That character is not available."
            },

            to=
                sid,
        )

        return None


# =========================================================
# ACTIVE VIEW DETACH
# =========================================================

async def detach_active_view(
    sid: str,
) -> tuple[
    object | None,
    object | None,
]:

    room = (
        rooms.room_for_socket(
            sid
        )
    )


    if (
        room is None
    ):

        return (
            None,
            None,
        )


    room_code = (
        room.code
    )


    await sio.leave_room(
        sid,
        room_code,
    )


    detached_room, player = (
        rooms.detach_socket(
            sid
        )
    )


    if (
        detached_room is not None
    ):

        await persist_room_state(
            room_code
        )


        await broadcast_room_state(
            room_code
        )


    return (
        detached_room,
        player,
    )


# =========================================================
# TURN CHARACTERS
# =========================================================

async def load_turn_characters(
    room,
) -> dict:

    characters_by_player_id = {}


    for (
        player_id,
        player,
    ) in room.players.items():

        character = (
            await character_service
            .get_owned_character(

                owner_user_id=
                    player.user_id,

                character_id=
                    player.character_id,
            )
        )


        characters_by_player_id[
            player_id
        ] = character


    return characters_by_player_id



# =========================================================
# HERO PROGRESSION / PERSISTENT CONSEQUENCES
# =========================================================

def _effect_applies_to_player(effect: dict, player) -> bool:
    affected = str(effect.get("affected", "") or "").strip().lower()
    if not affected:
        return True
    broad = {"all", "both", "party", "heroes", "players", "everyone", "the party"}
    if affected in broad:
        return True
    targets = {
        str(player.name or "").strip().lower(),
        str(player.character_id or "").strip().lower(),
    }
    return any(target and target in affected for target in targets)


def _health_event_from_consequence(*, room_code: str, effect: dict) -> dict | None:
    description = str(effect.get("description", "") or "").strip()
    affected = str(effect.get("affected", "") or "").strip().lower()
    health_impact = max(-5, min(4, int(effect.get("health_delta", 0) or 0)))
    if health_impact == 0:
        return None

    digest = hashlib.sha1(
        f"{room_code}|{affected}|{description}|{health_impact}".encode("utf-8")
    ).hexdigest()[:16]
    return {
        "event_key": f"health:{room_code}:{digest}",
        "description": description or ("WOUND" if health_impact < 0 else "RECOVERY"),
        "health_impact": health_impact,
    }


def _persistent_effect_from_consequence(*, room_code: str, turn_number: int, effect: dict, hero_level: int = 1) -> dict:
    description = str(effect.get("description", "") or "").strip()
    permanence = str(effect.get("permanence", "temporary") or "temporary").strip().lower()
    if permanence not in {"temporary", "lasting", "permanent"}:
        permanence = "temporary"

    modifier_value = max(-2, min(2, int(effect.get("modifier_value", 0) or 0)))
    modifier_stat = str(effect.get("modifier_stat", "") or "").strip().lower()
    modifier_skill = str(effect.get("modifier_skill", "") or "").strip().lower()

    valid_stats = {
        "strength", "agility", "intellect", "perception", "presence", "willpower"
    }
    valid_skills = {
        "athletics", "acrobatics", "stealth", "investigation", "knowledge",
        "technology", "awareness", "survival", "persuasion", "deception",
        "intimidation", "discipline",
    }

    stat_modifiers = {}
    skill_modifiers = {}
    if modifier_value and modifier_stat in valid_stats and not modifier_skill:
        stat_modifiers[modifier_stat] = modifier_value
    elif modifier_value and modifier_skill in valid_skills and not modifier_stat:
        skill_modifiers[modifier_skill] = modifier_value
    else:
        modifier_value = 0

    digest = hashlib.sha1(
        (
            f"{room_code}|{description}|{permanence}|"
            f"{modifier_stat}|{modifier_skill}|{modifier_value}"
        ).encode("utf-8")
    ).hexdigest()[:12]

    proposed_name = str(effect.get("effect_name", "") or "").strip()
    if proposed_name and len(proposed_name) <= 48:
        label = proposed_name
    elif modifier_stat:
        label = f"{modifier_stat.replace('_', ' ').upper()} {'BOON' if modifier_value > 0 else 'STRAIN'}"
    elif modifier_skill:
        label = f"{modifier_skill.replace('_', ' ').upper()} {'EDGE' if modifier_value > 0 else 'HINDRANCE'}"
    elif int(effect.get("health_delta", 0) or 0) < 0:
        label = "WOUNDED"
    elif int(effect.get("health_delta", 0) or 0) > 0:
        label = "RECOVERING"
    else:
        label = "STORY CONSEQUENCE"

    has_mechanics = bool(stat_modifiers or skill_modifiers)
    return {
        "effect_id": f"fx_{digest}",
        "source_key": f"director:{room_code}:{digest}",
        "name": label,
        "description": description,
        "category": "consequence",
        "source_room_code": room_code,
        "source_turn": int(turn_number),
        "active": True,
        "stat_modifiers": stat_modifiers,
        "skill_modifiers": skill_modifiers,
        # Mechanical boons/banes are short-lived combat/adventure state.
        # Long-term narrative scars/reputation remain in story/history instead.
        "story_permanence": permanence,
        "permanence": "temporary" if has_mechanics else permanence,
        "remaining_checks": None,
        "remaining_turns": 3 if has_mechanics else None,
    }


async def apply_turn_progression(
    *,
    room,
    session,
    characters_by_player_id: dict,
    result: dict,
    resolved_turn_number: int,
) -> dict[str, dict]:
    """Apply server-owned, idempotent Hero progression after a committed turn."""
    updates: dict[str, dict] = {}
    recent_consequences = session.story_state.get("recent_consequences", [])
    if not isinstance(recent_consequences, list):
        recent_consequences = []

    for turn_result in result.get("results", []) or []:
        player_id = str(turn_result.get("player_id", "") or "")
        character = characters_by_player_id.get(player_id)
        player = room.players.get(player_id)
        if character is None or player is None:
            continue

        # Finite mechanical effects age by resolved turn, not by mouse clicks or
        # number of checks.  Decay existing effects before granting this turn's
        # new effect so a fresh three-turn boon receives three future turns.
        expired_effects = decay_finite_effect_turns(character)
        effects_cleaned = False

        # Legacy narrative-only "effects" were really copied story sentences.
        # Retire them from the active mechanic tray; their narrative consequence
        # remains in story state/history where it belongs.
        for existing_effect in character.effects:
            if not isinstance(existing_effect, dict) or existing_effect.get("active", True) is False:
                continue
            if not (existing_effect.get("stat_modifiers") or existing_effect.get("skill_modifiers")):
                existing_effect["active"] = False
                effects_cleaned = True

        # Enforce the hard active-effect ceiling on legacy saves as well. Keep
        # the three newest finite mechanical effects and retire older overflow.
        active_existing = [
            effect for effect in character.effects
            if isinstance(effect, dict)
            and effect.get("active", True) is not False
            and (effect.get("stat_modifiers") or effect.get("skill_modifiers"))
            and str(effect.get("permanence", "temporary") or "temporary").lower() != "permanent"
        ]
        active_existing.sort(key=lambda effect: int(effect.get("source_turn", 0) or 0), reverse=True)
        for overflow in active_existing[3:]:
            overflow["active"] = False
            effects_cleaned = True

        check_payload = turn_result.get("check")

        xp_reward = max(0, int(turn_result.get("xp_reward", 0) or 0))
        xp_event = (
            f"choice:{room.code}:{resolved_turn_number}:"
            f"{player_id}:{turn_result.get('choice_id', '')}"
        )
        xp_gained = 0
        level_before = max(1, int(character.level or 1))
        if xp_reward and xp_event not in character.awarded_xp_events:
            character.awarded_xp_events.append(xp_event)
            character.experience += xp_reward
            character.level = level_for_experience(character.experience)
            xp_gained = xp_reward
        level_after = max(1, int(character.level or 1))
        levels_gained = max(0, level_after - level_before)

        # Max HP grows from deterministic level math.  A level-up grants the
        # newly-created HP immediately while preserving any existing wounds.
        level_health_floor = max_health_for_level(level_after)
        if int(character.max_health or 1) < level_health_floor:
            health_growth = level_health_floor - int(character.max_health or 1)
            character.max_health = level_health_floor
            character.health = min(
                character.max_health,
                int(character.health or 0) + health_growth,
            )

        adventure_totals = session.character_adventure_stats.setdefault(
            character.character_id,
            {},
        )
        adventure_totals.setdefault("starting_level", level_before)
        adventure_totals["ending_level"] = level_after
        adventure_totals["xp_earned"] = max(0, int(adventure_totals.get("xp_earned", 0) or 0)) + xp_gained
        if levels_gained > 0:
            level_events = adventure_totals.setdefault("level_ups", [])
            if isinstance(level_events, list):
                level_events.append({
                    "turn": int(resolved_turn_number),
                    "from_level": level_before,
                    "to_level": level_after,
                })
            advancement_award = award_for_level_transition(level_before, level_after)
            adventure_totals["advancement_stat_points_earned"] = (
                max(0, int(adventure_totals.get("advancement_stat_points_earned", 0) or 0))
                + advancement_award.stat_points
            )
            adventure_totals["advancement_skill_points_earned"] = (
                max(0, int(adventure_totals.get("advancement_skill_points_earned", 0) or 0))
                + advancement_award.skill_points
            )

        health_before = max(0, min(int(character.health or 0), int(character.max_health or 1)))
        pending_health_events = []
        for consequence in recent_consequences:
            if not isinstance(consequence, dict):
                continue
            if not _effect_applies_to_player(consequence, player):
                continue
            health_event = _health_event_from_consequence(
                room_code=room.code,
                effect=consequence,
            )
            if health_event is None:
                continue
            if health_event["event_key"] in character.applied_health_events:
                continue
            character.applied_health_events.append(health_event["event_key"])
            pending_health_events.append(health_event)

        scaled_health_events = []
        for item in pending_health_events:
            impact = int(item.get("health_impact", 0) or 0)
            applied_delta = scaled_health_delta(
                impact=impact,
                level=character.level,
                max_health=character.max_health,
            )
            scaled_item = dict(item)
            scaled_item["health_delta"] = applied_delta
            scaled_health_events.append(scaled_item)

        requested_health_delta = sum(
            int(item.get("health_delta", 0) or 0)
            for item in scaled_health_events
        )
        if requested_health_delta < 0:
            damage_cap = per_turn_health_cap(
                level=character.level,
                max_health=character.max_health,
                healing=False,
            )
            requested_health_delta = max(-damage_cap, requested_health_delta)
        elif requested_health_delta > 0:
            healing_cap = per_turn_health_cap(
                level=character.level,
                max_health=character.max_health,
                healing=True,
            )
            requested_health_delta = min(healing_cap, requested_health_delta)

        character.health = max(
            0,
            min(
                int(character.max_health or 1),
                health_before + requested_health_delta,
            ),
        )
        health_after = int(character.health)
        health_change = health_after - health_before

        died_this_turn = bool(health_before > 0 and health_after <= 0)
        if died_this_turn:
            damaging_events = [
                str(item.get("description", "") or "").strip()
                for item in scaled_health_events
                if int(item.get("health_delta", 0) or 0) < 0
            ]
            death_cause = next((text for text in reversed(damaging_events) if text), "Mortal wounds")
            character.death_record = {
                "room_code": room.code,
                "turn_number": int(resolved_turn_number),
                "cause": death_cause,
            }

        existing_effect_keys = {
            str(effect.get("source_key", ""))
            for effect in character.effects
            if isinstance(effect, dict)
        }
        active_finite_effects = [
            effect
            for effect in character.effects
            if isinstance(effect, dict)
            and effect.get("active", True) is not False
            and str(effect.get("permanence", "temporary") or "temporary").lower() != "permanent"
            and (effect.get("stat_modifiers") or effect.get("skill_modifiers"))
        ]

        # Effects are earned game-state, not a copy of every story consequence.
        # A Hero may gain at most one new mechanical effect per resolved turn.
        new_effects = []
        check_roll = 0
        check_outcome = ""
        if isinstance(check_payload, dict):
            check_roll = max(0, int(check_payload.get("roll", 0) or 0))
            check_outcome = str(check_payload.get("outcome", "") or "").strip().lower()

        for consequence in recent_consequences:
            if len(new_effects) >= 1 or len(active_finite_effects) >= 3:
                break
            if not isinstance(consequence, dict):
                continue
            if not _effect_applies_to_player(consequence, player):
                continue
            effect = _persistent_effect_from_consequence(
                room_code=room.code,
                turn_number=resolved_turn_number,
                effect=consequence,
                hero_level=character.level,
            )
            if effect["source_key"] in existing_effect_keys:
                continue

            stat_modifiers = effect.get("stat_modifiers") or {}
            skill_modifiers = effect.get("skill_modifiers") or {}
            values = [
                int(value or 0)
                for value in [*stat_modifiers.values(), *skill_modifiers.values()]
                if int(value or 0) != 0
            ]
            if not values:
                # Narrative consequences belong in story state/history, not in
                # the Hero's active perk/effect tray.
                continue

            proposed_value = values[0]
            positive = proposed_value > 0
            eligible = False
            if positive:
                eligible = bool(check_roll >= 18 or check_outcome == "critical_success")
            else:
                eligible = bool(
                    check_outcome == "critical_failure"
                    or check_roll == 1
                    or health_change < 0
                )
            if not eligible:
                continue

            # Natural 20 / critical failure can strengthen an otherwise modest
            # one-point effect. Server caps remain authoritative.
            if check_outcome == "critical_success" and proposed_value > 0:
                boosted = min(2, max(1, proposed_value + 1))
            elif check_outcome == "critical_failure" and proposed_value < 0:
                boosted = max(-2, min(-1, proposed_value - 1))
            else:
                boosted = proposed_value
            if stat_modifiers:
                target = next(iter(stat_modifiers))
                effect["stat_modifiers"] = {target: boosted}
            elif skill_modifiers:
                target = next(iter(skill_modifiers))
                effect["skill_modifiers"] = {target: boosted}

            effect["remaining_turns"] = 3
            effect["remaining_checks"] = None
            effect["permanence"] = "temporary"
            character.effects.append(effect)
            existing_effect_keys.add(effect["source_key"])
            active_finite_effects.append(effect)
            new_effects.append(effect)

        if xp_gained or new_effects or expired_effects or pending_health_events or died_this_turn or effects_cleaned:
            await character_service.save_owned_character(
                character.owner_user_id,
                character,
            )

        updates[player_id] = {
            "character_id": character.character_id,
            "level": character.level,
            "experience": character.experience,
            **progression_public_data(character.level, character.experience),
            "xp_gained": xp_gained,
            "xp_breakdown": (
                dict(turn_result.get("xp_breakdown", {}))
                if isinstance(turn_result.get("xp_breakdown"), dict)
                else {}
            ),
            "level_before": level_before,
            "level_after": level_after,
            "leveled_up": levels_gained > 0,
            "levels_gained": levels_gained,
            "health": health_after,
            "max_health": int(character.max_health),
            "health_before": health_before,
            "health_after": health_after,
            "health_change": health_change,
            "health_events": scaled_health_events,
            "at_zero_health": health_after <= 0,
            "is_alive": bool(character.is_alive),
            "died_this_turn": died_this_turn,
            "death_record": (dict(character.death_record) if isinstance(character.death_record, dict) else None),
            "new_effects": new_effects,
            "expired_effects": expired_effects,
            "effects": [dict(effect) for effect in character.effects if isinstance(effect, dict) and effect.get("active", True)],
        }

    return updates



async def commit_completed_adventure_advancement(
    *,
    session,
    characters_by_player_id: dict,
) -> None:
    """Bank level-up allocation points only when the journey is complete."""
    for character in characters_by_player_id.values():
        stats = session.character_adventure_stats.setdefault(character.character_id, {})
        if bool(stats.get("advancement_committed")):
            continue
        stat_points = max(0, int(stats.get("advancement_stat_points_earned", 0) or 0))
        skill_points = max(0, int(stats.get("advancement_skill_points_earned", 0) or 0))
        if stat_points or skill_points:
            character.unspent_stat_points += stat_points
            character.unspent_skill_points += skill_points
            await character_service.save_owned_character(character.owner_user_id, character)
        stats["advancement_committed"] = True


# =========================================================
# CONNECT
# =========================================================

@sio.event
async def connect(
    sid,
    environ,
    auth,
):

    print(
        f"[SOCKET CONNECTED] "
        f"{sid}"
    )


    user = (
        await socket_auth.authenticate(
            sid,
            environ,
        )
    )


    if (
        user is None
    ):

        print(
            f"[SOCKET AUTH] "
            f"{sid} | ANONYMOUS"
        )

        return


    register_user_sid(
        user.user_id,
        sid,
    )


    print(
        f"[SOCKET AUTH] "
        f"{sid} | "
        f"{user.username} | "
        f"{user.user_id}"
    )


    # Do NOT auto-select an adventure.
    # An account may now belong to many.

    await send_adventure_catalog(
        sid
    )


    await send_adventure_list(
        sid,
        user.user_id,
    )


# =========================================================
# DISCONNECT
# =========================================================

@sio.event
async def disconnect(
    sid,
    reason,
):

    user = (
        socket_auth.get_user(
            sid
        )
    )


    if (
        user is not None
    ):

        unregister_user_sid(
            user.user_id,
            sid,
        )


    socket_auth.disconnect(
        sid
    )


    room, player = (
        rooms.mark_disconnected(
            sid
        )
    )


    if (
        player is not None
        and room is not None
    ):

        print(
            f"[OFFLINE] "
            f"{player.name} | "
            f"room={room.code}"
        )


        await persist_room_state(
            room.code
        )


        await broadcast_room_state(
            room.code
        )


        await refresh_adventure_lists(
            player.user_id
            for player
            in room.players.values()
        )


# =========================================================
# EXIT ACTIVE VIEW
# =========================================================

@sio.event
async def exit_adventure_view(
    sid,
    data=None,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if (
        user is None
    ):

        return


    room, player = (
        await detach_active_view(
            sid
        )
    )


    await sio.emit(

        "adventure_view_exited",

        {
            "room_code":
                (
                    room.code
                    if room
                    else None
                )
        },

        to=
            sid,
    )


    if (
        room is not None
    ):

        await refresh_adventure_lists(
            member.user_id

            for member
            in room.players.values()
        )


# =========================================================
# CREATE ROOM
# =========================================================

@sio.event
async def create_room(
    sid,
    data,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if (
        user is None
    ):

        return


    if not isinstance(
        data,
        dict,
    ):

        return


    character = (
        await require_owned_character(
            sid,
            user,
            data,
        )
    )


    if (
        character is None
    ):

        return


    adventure_id = str(
        data.get(
            "adventure_id",
            "old_chapel",
        )
        or "old_chapel"
    ).strip()


    if not adventure_registry.exists(
        adventure_id
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "That adventure is not available."
            },

            to=
                sid,
        )

        return


    if (
        rooms.player_for_character(
            character.character_id
        )
        is not None
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "That character is already "
                    "in an active adventure."
            },

            to=
                sid,
        )

        return


    await detach_active_view(
        sid
    )


    try:

        room, player = (
            rooms.create_room(

                sid=
                    sid,

                user_id=
                    user.user_id,

                character_id=
                    character.character_id,

                player_name=
                    character.name,
            )
        )

    except ValueError as error:

        await sio.emit(

            "room_error",

            {
                "message":
                    str(
                        error
                    )
            },

            to=
                sid,
        )

        return


    session = (
        game_sessions.create(

            room.code,

            adventure_id=
                adventure_id,
        )
    )


    await sio.enter_room(
        sid,
        room.code,
    )


    await persist_room_state(
        room.code
    )


    await sio.emit(

        "room_joined",

        {
            "room":
                room.public_data(),

            "player_name":
                player.name,

            "player_id":
                player.player_id,

            "character_id":
                player.character_id,

            "adventure_id":
                session.adventure_id,

            "adventure_title":
                session.adventure.title,
        },

        to=
            sid,
    )


    await sio.emit(

        "chat_history",

        {
            "room_code":
                room.code,

            "messages":
                chat.history(
                    room.code
                )
        },

        to=
            sid,
    )


    await broadcast_room_state(
        room.code
    )


    await broadcast_game_state(
        room.code
    )


    await refresh_adventure_lists(
        player.user_id
        for player
        in room.players.values()
    )


# =========================================================
# JOIN ROOM
# =========================================================

@sio.event
async def join_room(
    sid,
    data,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if (
        user is None
    ):

        return


    if not isinstance(
        data,
        dict,
    ):

        return


    character = (
        await require_owned_character(
            sid,
            user,
            data,
        )
    )


    if (
        character is None
    ):

        return


    room_code = str(
        data.get(
            "room_code",
            "",
        )
    ).strip().upper()


    if (
        not room_code
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Enter a room code."
            },

            to=
                sid,
        )

        return


    if (
        rooms.player_for_character(
            character.character_id
        )
        is not None
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "That character is already "
                    "in an active adventure."
            },

            to=
                sid,
        )

        return


    await detach_active_view(
        sid
    )


    try:

        room, player = (
            rooms.join_room(

                sid=
                    sid,

                user_id=
                    user.user_id,

                character_id=
                    character.character_id,

                player_name=
                    character.name,

                code=
                    room_code,
            )
        )

    except ValueError as error:

        await sio.emit(

            "room_error",

            {
                "message":
                    str(
                        error
                    )
            },

            to=
                sid,
        )

        return


    await sio.enter_room(
        sid,
        room.code,
    )


    game_sessions.get_or_create(
        room.code
    )


    await persist_room_state(
        room.code
    )


    await sio.emit(

        "room_joined",

        {
            "room":
                room.public_data(),

            "player_name":
                player.name,

            "player_id":
                player.player_id,

            "character_id":
                player.character_id,
        },

        to=
            sid,
    )


    await sio.emit(

        "chat_history",

        {
            "room_code":
                room.code,

            "messages":
                chat.history(
                    room.code
                )
        },

        to=
            sid,
    )


    await broadcast_room_state(
        room.code
    )


    await broadcast_game_state(
        room.code
    )


    await refresh_adventure_lists(
        member.user_id

        for member
        in room.players.values()
    )


# =========================================================
# RESUME
# =========================================================

@sio.event
async def resume_adventure(
    sid,
    data,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if (
        user is None
    ):

        return


    if not isinstance(
        data,
        dict,
    ):

        return


    room_code = str(
        data.get(
            "room_code",
            "",
        )
    ).strip().upper()


    character_id = str(
        data.get(
            "character_id",
            "",
        )
    ).strip()


    if (
        not room_code
        or not character_id
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Missing adventure selection."
            },

            to=
                sid,
        )

        return


    try:

        character = (
            await character_service
            .get_owned_character(

                owner_user_id=
                    user.user_id,

                character_id=
                    character_id,
            )
        )

    except CharacterError as error:

        await sio.emit(

            "room_error",

            {
                "message":
                    str(
                        error
                    )
            },

            to=
                sid,
        )

        return


    await detach_active_view(
        sid
    )


    try:

        room, player = (
            rooms.resume_adventure(

                sid=
                    sid,

                user_id=
                    user.user_id,

                room_code=
                    room_code,

                character_id=
                    character_id,
            )
        )

    except ValueError as error:

        await sio.emit(

            "room_error",

            {
                "message":
                    str(
                        error
                    )
            },

            to=
                sid,
        )

        return


    player.name = (
        character.name
    )


    await sio.enter_room(
        sid,
        room.code,
    )


    await persist_room_state(
        room.code
    )


    resume_payload = {
        "room":
            room.public_data(),

        "player_name":
            player.name,

        "player_id":
            player.player_id,

        "character_id":
            player.character_id,
    }


    session = (
        game_sessions.get_or_create(
            room.code
        )
    )


    if session.completed:

        characters_by_player_id = (
            await load_turn_characters(
                room
            )
        )


        resume_payload["completed"] = True
        resume_payload["finale"] = (
            build_adventure_finale_payload(
                room=room,
                session=session,
                characters_by_player_id=characters_by_player_id,
            )
        )


    await sio.emit(

        "resume_success",

        resume_payload,

        to=
            sid,
    )


    await sio.emit(

        "chat_history",

        {
            "room_code":
                room.code,

            "messages":
                chat.history(
                    room.code
                )
        },

        to=
            sid,
    )


    await broadcast_room_state(
        room.code
    )


    await broadcast_game_state(
        room.code
    )


    await refresh_adventure_lists(
        member.user_id

        for member
        in room.players.values()
    )


# =========================================================
# LEAVE ADVENTURE
# =========================================================

@sio.event
async def leave_adventure(
    sid,
    data,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if (
        user is None
    ):

        return


    if not isinstance(
        data,
        dict,
    ):

        data = {}


    active_player = (
        rooms.player_for_socket(
            sid
        )
    )


    active_room = (
        rooms.room_for_socket(
            sid
        )
    )


    room_code = str(
        data.get(
            "room_code",
            (
                active_room.code
                if active_room
                else ""
            ),
        )
    ).strip().upper()


    character_id = str(
        data.get(
            "character_id",
            (
                active_player.character_id
                if active_player
                else ""
            ),
        )
    ).strip()


    room_before = (
        rooms.room_by_code(
            room_code
        )
    )


    if (
        room_before is None
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Adventure does not exist."
            },

            to=
                sid,
        )

        return


    player_before = (
        room_before.player_for_character(
            character_id
        )
    )


    if (
        player_before is None
        or player_before.user_id
        != user.user_id
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Adventure membership not found."
            },

            to=
                sid,
        )

        return


    affected_user_ids = {
        member.user_id

        for member
        in room_before.players.values()
    }


    affected_user_ids.add(
        user.user_id
    )


    player_id = (
        player_before.player_id
    )


    game_sessions.remove_player_submission(
        room_code,
        player_id,
    )


    if (
        player_before.sid
        == sid
    ):

        await sio.leave_room(
            sid,
            room_code,
        )


    (
        room,
        removed_player,
        room_is_empty,
    ) = rooms.remove_character_from_room(

        room_code=
            room_code,

        user_id=
            user.user_id,

        character_id=
            character_id,
    )


    await sio.emit(

        "adventure_left",

        {
            "room_code":
                room_code,

            "character_id":
                character_id,
        },

        to=
            sid,
    )


    if (
        room_is_empty
    ):

        game_sessions.remove(
            room_code
        )


        await store.delete_room(
            room_code
        )

    else:

        await persist_room_state(
            room_code
        )


        await broadcast_room_state(
            room_code
        )


        await broadcast_game_state(
            room_code
        )


    await refresh_adventure_lists(
        affected_user_ids
    )


# =========================================================
# ABANDON
# =========================================================

@sio.event
async def abandon_adventure(
    sid,
    data,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if (
        user is None
    ):

        return


    if not isinstance(
        data,
        dict,
    ):

        data = {}


    active_room = (
        rooms.room_for_socket(
            sid
        )
    )


    room_code = str(
        data.get(
            "room_code",
            (
                active_room.code
                if active_room
                else ""
            ),
        )
    ).strip().upper()


    room = (
        rooms.room_by_code(
            room_code
        )
    )


    if (
        room is None
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Adventure does not exist."
            },

            to=
                sid,
        )

        return


    player = (
        room.player_for_user(
            user.user_id
        )
    )


    if (
        player is None
        or not player.is_host
    ):

        await sio.emit(

            "room_error",

            {
                "message":
                    "Only the host can abandon "
                    "the adventure."
            },

            to=
                sid,
        )

        return


    affected_user_ids = {
        member.user_id

        for member
        in room.players.values()
    }


    connected_sids = [
        member.sid

        for member
        in room.players.values()

        if member.sid
    ]


    await sio.emit(

        "adventure_abandoned",

        {
            "room_code":
                room_code,

            "message":
                "The host abandoned the adventure.",
        },

        room=
            room_code,
    )


    for member_sid in (
        connected_sids
    ):

        await sio.leave_room(
            member_sid,
            room_code,
        )


    rooms.remove_room(
        room_code
    )


    game_sessions.remove(
        room_code
    )


    await store.delete_room(
        room_code
    )


    await refresh_adventure_lists(
        affected_user_ids
    )


# =========================================================
# START SOLO
# =========================================================

@sio.event
async def start_solo(
    sid,
    data,
):

    user = (
        await require_socket_user(
            sid
        )
    )


    if user is None:

        return


    room = (
        rooms.room_for_socket(
            sid
        )
    )


    player = (
        rooms.player_for_socket(
            sid
        )
    )


    if (
        room is None
        or player is None
    ):

        await sio.emit(
            "room_error",
            {
                "message":
                    "Resume an adventure first."
            },
            to=sid,
        )

        return


    if (
        player.user_id != user.user_id
        or not player.is_host
    ):

        await sio.emit(
            "room_error",
            {
                "message":
                    "Only the host can start solo mode."
            },
            to=sid,
        )

        return


    session = (
        game_sessions.get_or_create(
            room.code
        )
    )


    if not room_can_start_solo(
        room,
        session,
    ):

        await sio.emit(
            "room_error",
            {
                "message":
                    (
                        "Solo mode can only be started before "
                        "the adventure begins and before another Hero joins."
                    )
            },
            to=sid,
        )

        return


    try:

        rooms.start_solo(
            room_code=room.code,
            user_id=user.user_id,
        )

    except ValueError as error:

        await sio.emit(
            "room_error",
            {
                "message":
                    str(error)
            },
            to=sid,
        )

        return


    await persist_room_state(
        room.code
    )


    await sio.emit(
        "solo_started",
        {
            "room_code":
                room.code,

            "play_mode":
                room.play_mode,
        },
        room=room.code,
    )


    await broadcast_room_state(
        room.code
    )


    await broadcast_game_state(
        room.code
    )


    await refresh_adventure_lists(
        member.user_id
        for member
        in room.players.values()
    )


# =========================================================
# WRAP UP ADVENTURE
# =========================================================

@sio.event
async def request_wrap_up(
    sid,
    data,
):

    user = await require_socket_user(
        sid,
        error_event="game_error",
    )

    if user is None:
        return

    room = rooms.room_for_socket(sid)
    player = rooms.player_for_socket(sid)

    if (
        room is None
        or player is None
        or player.user_id != user.user_id
    ):
        await sio.emit(
            "game_error",
            {"message": "Resume the adventure before calling for its final chapter."},
            to=sid,
        )
        return

    session = game_sessions.get_or_create(room.code)

    if not session.is_ai_directed:
        await sio.emit(
            "game_error",
            {"message": "This chronicle does not use the live Story Director."},
            to=sid,
        )
        return

    if session.completed:
        await sio.emit(
            "game_error",
            {"message": "This journey has already reached its ending."},
            to=sid,
        )
        return

    if session.turn_number <= 1:
        await sio.emit(
            "game_error",
            {"message": "Let the tale breathe for at least one turn before calling for the ending."},
            to=sid,
        )
        return

    if session.wrap_up_active:
        await broadcast_game_state(room.code)
        return

    if player.player_id not in session.wrap_up_votes:
        session.wrap_up_votes.append(player.player_id)

    wrap_characters = await load_turn_characters(room)
    required_player_ids = [
        player_id
        for player_id, character in wrap_characters.items()
        if bool(getattr(character, "is_alive", character.health > 0))
        and int(character.health or 0) > 0
    ]
    all_acknowledged = bool(required_player_ids) and all(
        player_id in session.wrap_up_votes
        for player_id in required_player_ids
    )

    if all_acknowledged:
        session.wrap_up_active = True
        session.wrap_up_turns_remaining = 3

        print(
            "[WRAP UP APPROVED] "
            f"room={room.code} "
            f"turn={session.turn_number} "
            "runway=3"
        )

        await sio.emit(
            "wrap_up_approved",
            {
                "room_code": room.code,
                "turns_remaining": 3,
                "message": "The party has called for the final chapter. Three turns remain.",
            },
            room=room.code,
        )
    else:
        await sio.emit(
            "wrap_up_vote_recorded",
            {
                "room_code": room.code,
                "player_id": player.player_id,
                "votes": len(session.wrap_up_votes),
                "required": len(required_player_ids),
                "message": "Your vow is marked. The final chapter waits for every Hero to agree.",
            },
            room=room.code,
        )

    await persist_room_state(room.code)
    await broadcast_game_state(room.code)


# =========================================================
# SYNC ACTIVE ADVENTURE STATE
# =========================================================

@sio.event
async def sync_adventure_state(
    sid,
    data,
):

    user = await require_socket_user(
        sid
    )

    if user is None:
        return

    room = rooms.room_for_socket(
        sid
    )

    player = rooms.player_for_socket(
        sid
    )

    if (
        room is None
        or player is None
        or player.user_id != user.user_id
    ):
        return

    await sio.emit(
        "room_state",
        room.public_data(),
        to=sid,
    )

    state = build_game_state(
        room.code
    )

    if state is not None:

        await sio.emit(
            "game_state",
            state,
            to=sid,
        )


# =========================================================
# TURN FINALIZATION / DIRECTOR REQUEST
# =========================================================

def build_adventure_finale_payload(
    *,
    room,
    session,
    characters_by_player_id: dict,
) -> dict:
    """Build a deterministic, player-facing completion summary."""

    heroes = []
    rank_scores = []

    for player_id, player in room.players.items():
        character = characters_by_player_id.get(player_id)
        if character is None:
            continue

        stats = dict(
            session.character_adventure_stats.get(
                character.character_id,
                {},
            )
            or {}
        )

        checks_total = max(0, int(stats.get("checks_total", 0) or 0))
        checks_succeeded = max(0, int(stats.get("checks_succeeded", 0) or 0))
        critical_successes = max(0, int(stats.get("critical_successes", 0) or 0))
        critical_failures = max(0, int(stats.get("critical_failures", 0) or 0))
        xp_earned = max(0, int(stats.get("xp_earned", 0) or 0))
        starting_level = max(1, int(stats.get("starting_level", character.level) or character.level or 1))
        ending_level = max(starting_level, int(character.level or starting_level))
        levels_gained = max(0, ending_level - starting_level)
        success_rate = (checks_succeeded / checks_total) if checks_total else 0.0

        score = round(
            45
            + (success_rate * 35)
            + min(12, critical_successes * 4)
            - min(8, critical_failures * 3)
            + min(10, levels_gained * 5)
        )
        score = max(0, min(100, score))

        if score >= 95:
            rank = "S"
        elif score >= 85:
            rank = "A"
        elif score >= 72:
            rank = "B"
        elif score >= 58:
            rank = "C"
        else:
            rank = "D"

        rank_scores.append(score)

        level_ups = []
        for event in stats.get("level_ups", []) or []:
            if not isinstance(event, dict):
                continue
            level_ups.append({
                "turn": max(1, int(event.get("turn", 1) or 1)),
                "from_level": max(1, int(event.get("from_level", starting_level) or starting_level)),
                "to_level": max(1, int(event.get("to_level", ending_level) or ending_level)),
            })

        heroes.append({
            "player_id": player_id,
            "character_id": character.character_id,
            "character_name": character.name,
            "is_host": bool(player.is_host),
            "starting_level": starting_level,
            "ending_level": ending_level,
            "levels_gained": levels_gained,
            "xp_earned": xp_earned,
            "checks_total": checks_total,
            "checks_succeeded": checks_succeeded,
            "critical_successes": critical_successes,
            "critical_failures": critical_failures,
            "success_rate": round(success_rate * 100, 1),
            "rank": rank,
            "rank_score": score,
            "level_ups": level_ups,
            "is_alive": bool(getattr(character, "is_alive", character.health > 0)),
            "health": int(character.health),
            "max_health": int(character.max_health),
            "death_record": (dict(character.death_record) if isinstance(getattr(character, "death_record", None), dict) else None),
            "advancement_stat_points_earned": max(0, int(stats.get("advancement_stat_points_earned", 0) or 0)),
            "advancement_skill_points_earned": max(0, int(stats.get("advancement_skill_points_earned", 0) or 0)),
            "unspent_stat_points": max(0, int(getattr(character, "unspent_stat_points", 0) or 0)),
            "unspent_skill_points": max(0, int(getattr(character, "unspent_skill_points", 0) or 0)),
            "advancement_stat_cap": ADVANCEMENT_STAT_CAP,
            "advancement_skill_cap": ADVANCEMENT_SKILL_CAP,
            "stats": {key.value: int(value) for key, value in character.stats.items()},
            "skills": {key.value: int(value) for key, value in character.skills.items()},
        })

    party_score = round(sum(rank_scores) / len(rank_scores)) if rank_scores else 0
    if party_score >= 95:
        party_rank = "S"
    elif party_score >= 85:
        party_rank = "A"
    elif party_score >= 72:
        party_rank = "B"
    elif party_score >= 58:
        party_rank = "C"
    else:
        party_rank = "D"

    return {
        "room_code": room.code,
        "adventure_id": session.adventure_id,
        "adventure_title": session.adventure.title,
        "play_mode": room.play_mode,
        "ending_label": session.ending_label or "JOURNEY COMPLETE",
        "final_scene_title": str(session.scene.title),
        "final_resolution": str(session.last_resolution or ""),
        "turn_count": max(1, int(session.turn_number) - 1),
        "party_rank": party_rank,
        "party_rank_score": party_score,
        "heroes": heroes,
    }


async def finalize_resolved_turn(
    *,
    room,
    session,
    characters_by_player_id: dict,
    result: dict,
    resolved_turn_number: int,
) -> bool:

    try:

        if session.is_ai_directed:

            # Mark the request active BEFORE broadcasting the durable pending
            # state. Reconnects can therefore distinguish a live request from
            # frozen TurnFacts that need an explicit retry after a timeout or
            # process restart.
            _director_active_rooms.add(
                room.code
            )

            await persist_room_state(
                room.code
            )

            await broadcast_game_state(
                room.code
            )

            await sio.emit(
                "story_advancing",
                {
                    "room_code":
                        room.code,

                    "turn_number":
                        session.turn_number,

                    "game_id":
                        game_sessions.intermission_game_id(
                            session.turn_number
                        ),

                    "play_mode":
                        room.play_mode,

                    "intermission_stats":
                        game_sessions.intermission_stats(
                            room.code,
                            room.players,
                        ),
                },
                room=
                    room.code,
            )

            # The OpenAI SDK has its own request timeout, but an outer wall
            # clock deadline is intentional here. It prevents transport / SDK
            # retry behavior from leaving a room in THINKING for minutes.
            hard_timeout_seconds = min(
                120.0,
                max(
                    20.0,
                    float(
                        getattr(
                            runtime_director,
                            "timeout_seconds",
                            90,
                        )
                    ) + 5.0,
                ),
            )

            try:

                director_output = await asyncio.wait_for(
                    runtime_director.advance(
                        session=
                            session,

                        room=
                            room,

                        characters_by_player_id=
                            characters_by_player_id,

                        turn_facts=
                            result,
                    ),
                    timeout=
                        hard_timeout_seconds,
                )

            except asyncio.TimeoutError as error:

                raise DirectorError(
                    (
                        "Story Director timed out after "
                        f"{int(hard_timeout_seconds)} seconds. "
                        "Your locked choices and dice results were preserved."
                    )
                ) from error

            result = (
                game_sessions
                .commit_director_turn(
                    room.code,
                    turn_facts=
                        result,
                    director_output=
                        director_output,
                )
            )

        progression_updates = (
            await apply_turn_progression(
                room=room,
                session=session,
                characters_by_player_id=characters_by_player_id,
                result=result,
                resolved_turn_number=resolved_turn_number,
            )
        )

        if progression_updates:
            result["hero_progression"] = progression_updates

        living_after_turn = [
            character
            for character in characters_by_player_id.values()
            if bool(getattr(character, "is_alive", character.health > 0))
            and int(character.health or 0) > 0
        ]
        if not living_after_turn:
            session.completed = True
            session.ending_label = "THE HEROES HAVE FALLEN" if len(room.players) > 1 else "THE HERO HAS FALLEN"
            result["completed"] = True
            result["ending_label"] = session.ending_label

        if not session.completed:
            game_sessions.maybe_schedule_micro_event(
                room.code,
                resolved_turn_number=resolved_turn_number,
            )

        _director_active_rooms.discard(
            room.code
        )

        await persist_room_state(
            room.code
        )

        if session.completed:

            await commit_completed_adventure_advancement(
                session=session,
                characters_by_player_id=characters_by_player_id,
            )

            # Persist the committed advancement marker with the room snapshot
            # so a restart cannot bank the same level-up points twice.
            await persist_room_state(room.code)

            await store.record_completed_adventure(
                room,
                session,
            )

        turn_payload = {
            "room_code":
                room.code,
            **result,
        }

        if session.completed:
            turn_payload["finale"] = build_adventure_finale_payload(
                room=room,
                session=session,
                characters_by_player_id=characters_by_player_id,
            )

        await sio.emit(
            "turn_resolved",
            turn_payload,
            room=
                room.code,
        )

        await broadcast_game_state(
            room.code
        )

        await refresh_adventure_lists(
            member.user_id
            for member
            in room.players.values()
        )

        return True

    except (
        CharacterError,
        DirectorError,
        ValueError,
    ) as error:

        _director_active_rooms.discard(
            room.code
        )

        print(
            "[DIRECTOR ERROR] "
            f"room={room.code} "
            f"type={type(error).__name__} "
            f"message={error}"
        )

        # Keep pending_turn_facts + submissions intact. A retry reuses the
        # exact same locked actions and dice, so a provider failure can never
        # become a free reroll.
        await persist_room_state(
            room.code
        )

        await sio.emit(
            "game_error",
            {
                "room_code":
                    room.code,

                "message":
                    str(error),

                "retryable":
                    bool(
                        session.pending_turn_facts
                    ),
            },
            room=
                room.code,
        )

        await broadcast_game_state(
            room.code
        )

        return False

    except Exception as error:

        _director_active_rooms.discard(
            room.code
        )

        # Unexpected provider/schema/runtime failures must never strand the
        # client in an intermission with no recovery control. If authoritative
        # TurnFacts still exist, preserve them and explicitly expose retry.
        retryable = bool(
            session.pending_turn_facts
        )

        print(
            "[TURN FINALIZE ERROR] "
            f"room={room.code} "
            f"type={type(error).__name__} "
            f"message={error}"
        )

        await persist_room_state(
            room.code
        )

        await sio.emit(
            "game_error",
            {
                "room_code":
                    room.code,

                "message":
                    (
                        "The Story Director hit an unexpected error. "
                        "Your locked choices and dice results were preserved for retry."
                        if retryable
                        else "The turn could not be finalized."
                    ),

                "retryable":
                    retryable,
            },
            room=
                room.code,
        )

        await broadcast_game_state(
            room.code
        )

        return False

    finally:

        _director_active_rooms.discard(
            room.code
        )


# =========================================================
# CHOICE
# =========================================================

@sio.event
async def submit_choice(
    sid,
    data,
):

    user = (
        await require_socket_user(

            sid,

            error_event=
                "game_error",
        )
    )


    if (
        user is None
    ):

        return


    room = (
        rooms.room_for_socket(
            sid
        )
    )


    player = (
        rooms.player_for_socket(
            sid
        )
    )


    if (
        room is None
        or player is None
    ):

        await sio.emit(

            "game_error",

            {
                "message":
                    "Resume an adventure first."
            },

            to=
                sid,
        )

        return


    if (
        player.user_id
        != user.user_id
    ):

        await sio.emit(

            "game_error",

            {
                "message":
                    "Player ownership mismatch."
            },

            to=
                sid,
        )

        return


    if not isinstance(
        data,
        dict,
    ):

        return


    choice_id = str(
        data.get(
            "choice_id",
            "",
        )
    ).strip()


    if (
        not choice_id
    ):

        return


    try:
        hero = await character_service.get_owned_character(
            owner_user_id=user.user_id,
            character_id=player.character_id,
        )
        if not bool(getattr(hero, "is_alive", hero.health > 0)) or int(hero.health or 0) <= 0:
            await sio.emit(
                "game_error",
                {"message": "This Hero has fallen and can no longer choose an action."},
                to=sid,
            )
            return

        choice = (
            game_sessions.submit_choice(

                room_code=
                    room.code,

                player_id=
                    player.player_id,

                choice_id=
                    choice_id,
            )
        )

    except ValueError as error:

        await sio.emit(

            "game_error",

            {
                "message":
                    str(
                        error
                    )
            },

            to=
                sid,
        )

        return


    await persist_room_state(
        room.code
    )


    await sio.emit(

        "choice_accepted",

        {
            "room_code":
                room.code,

            "choice_id":
                choice.id,

            "choice_label":
                choice.label,
        },

        to=
            sid,
    )


    await broadcast_game_state(
        room.code
    )


    # Only one coroutine may resolve a room turn at a time.
    # The readiness check lives INSIDE the lock so a second overlapping
    # socket handler cannot start a duplicate Director request.
    async with turn_resolution_lock(
        room.code
    ):

        readiness_characters = await load_turn_characters(room)
        player_ids = [
            player_id
            for player_id, character in readiness_characters.items()
            if bool(getattr(character, "is_alive", character.health > 0))
            and int(character.health or 0) > 0
        ]

        if not player_ids:
            return

        # Co-op rooms do not resolve as accidental solo sessions. The host
        # may lock a choice while waiting, but turn resolution cannot begin
        # until the room has reached its configured party size. Once the party
        # exists, only living Heroes are required to lock the current turn.
        if not room.has_required_party:
            return

        if not (
            game_sessions
            .all_players_ready(
                room.code,
                player_ids,
                required_players=len(player_ids),
            )
        ):
            return

        session = (
            game_sessions
            .get_or_create(
                room.code
            )
        )


        lock_countdown_seconds = 3

        await sio.emit(
            "turn_lock_countdown",
            {
                "room_code":
                    room.code,

                "turn_number":
                    session.turn_number,

                "duration_seconds":
                    lock_countdown_seconds,

                "play_mode":
                    room.play_mode,
            },
            room=room.code,
        )

        # The countdown is presentation only. Start resolving the locked
        # turn immediately so the Director request can overlap those three
        # seconds instead of adding artificial latency before generation.

        print(
            "[TURN READY] "
            f"room={room.code} "
            f"turn={session.turn_number} "
            f"ai_directed={session.is_ai_directed}"
        )


        try:

            characters_by_player_id = readiness_characters

            resolved_turn_number = int(
                session.turn_number
            )

            result = (
                game_sessions.resolve_turn(
                    room_code=
                        room.code,

                    players={
                        player_id: room.players[player_id]
                        for player_id in player_ids
                    },

                    characters_by_player_id=
                        characters_by_player_id,
                )
            )

            print(
                "[TURN FACTS] "
                f"room={room.code} "
                f"turn={session.turn_number} "
                f"results={len(result.get('results', []))}"
            )

        except (
            CharacterError,
            ValueError,
        ) as error:

            await sio.emit(
                "game_error",
                {
                    "room_code":
                        room.code,

                    "message":
                        str(error),

                    "retryable":
                        False,
                },
                room=
                    room.code,
            )

            return

        await finalize_resolved_turn(
            room=
                room,
            session=
                session,
            characters_by_player_id=
                characters_by_player_id,
            result=
                result,
            resolved_turn_number=
                resolved_turn_number,
        )


# =========================================================
# QUICK MICRO-EVENT RESPONSE
# =========================================================

@sio.event
async def submit_micro_event_choice(
    sid,
    data,
):

    user = await require_socket_user(
        sid,
        error_event="game_error",
    )
    if user is None:
        return

    room = rooms.room_for_socket(sid)
    player = rooms.player_for_socket(sid)

    if (
        room is None
        or player is None
        or player.user_id != user.user_id
    ):
        await sio.emit(
            "game_error",
            {"message": "Resume the adventure before answering the quick event."},
            to=sid,
        )
        return

    if not isinstance(data, dict):
        return

    supplied_room_code = str(data.get("room_code", "")).strip().upper()
    option_id = str(data.get("option_id", "")).strip()

    if supplied_room_code != room.code or not option_id:
        return

    characters = await load_turn_characters(room)
    required_player_ids = [
        player_id
        for player_id, character in characters.items()
        if bool(getattr(character, "is_alive", character.health > 0))
        and int(character.health or 0) > 0
    ]

    try:
        event, completed = game_sessions.submit_micro_event_choice(
            room.code,
            player_id=player.player_id,
            option_id=option_id,
            required_player_ids=required_player_ids,
            response_names={
                player_id: member.name
                for player_id, member in room.players.items()
            },
        )
    except ValueError as error:
        await sio.emit(
            "game_error",
            {"room_code": room.code, "message": str(error)},
            to=sid,
        )
        return

    await persist_room_state(room.code)

    await sio.emit(
        "micro_event_updated",
        {
            "room_code": room.code,
            "event": event,
            "completed": completed,
        },
        room=room.code,
    )

    await broadcast_game_state(room.code)


# =========================================================
# RETRY PENDING DIRECTOR TURN
# =========================================================

@sio.event
async def retry_pending_turn(
    sid,
    data,
):

    user = await require_socket_user(
        sid,
        error_event=
            "game_error",
    )

    if user is None:
        return

    room = rooms.room_for_socket(
        sid
    )

    player = rooms.player_for_socket(
        sid
    )

    if (
        room is None
        or player is None
        or player.user_id != user.user_id
    ):

        await sio.emit(
            "game_error",
            {
                "message":
                    "Resume the adventure before retrying the story.",
                "retryable":
                    False,
            },
            to=sid,
        )
        return

    async with turn_resolution_lock(
        room.code
    ):

        if room.code in _director_active_rooms:

            await sio.emit(
                "game_error",
                {
                    "room_code":
                        room.code,
                    "message":
                        "The Story Director is already working on this turn.",
                    "retryable":
                        False,
                },
                to=sid,
            )
            return

        session = game_sessions.get_or_create(
            room.code
        )

        if not session.pending_turn_facts:

            await sio.emit(
                "game_error",
                {
                    "room_code":
                        room.code,
                    "message":
                        "There is no pending story turn to retry.",
                    "retryable":
                        False,
                },
                to=sid,
            )
            return

        # A persisted pending_turn_facts snapshot is authoritative proof that
        # this turn already passed the normal party/readiness gate and that its
        # choices + rolls were frozen. Do NOT re-check current submissions or
        # party readiness here: reconnects/restarts can legitimately make those
        # transient collections differ even though the frozen turn is complete.
        # The retry path must replay the snapshot, never ask players to re-lock.

        try:

            characters_by_player_id = await load_turn_characters(
                room
            )

            resolved_turn_number = int(
                session.turn_number
            )

            # resolve_turn() deliberately reuses pending_turn_facts here.
            # No die is rolled again and no choice changes.
            result = game_sessions.resolve_turn(
                room_code=
                    room.code,
                players=
                    room.players,
                characters_by_player_id=
                    characters_by_player_id,
            )

        except (
            CharacterError,
            ValueError,
        ) as error:

            await sio.emit(
                "game_error",
                {
                    "room_code":
                        room.code,
                    "message":
                        str(error),
                    "retryable":
                        False,
                },
                to=sid,
            )
            return

        await finalize_resolved_turn(
            room=
                room,
            session=
                session,
            characters_by_player_id=
                characters_by_player_id,
            result=
                result,
            resolved_turn_number=
                resolved_turn_number,
        )


# =========================================================
# INTERMISSION SCORE
# =========================================================

@sio.event
async def submit_intermission_score(
    sid,
    data,
):

    user = (
        await require_socket_user(

            sid,

            error_event=
                "game_error",
        )
    )


    if user is None:

        return


    room = (
        rooms.room_for_socket(
            sid
        )
    )

    player = (
        rooms.player_for_socket(
            sid
        )
    )


    if (
        room is None
        or player is None
    ):

        return


    if (
        player.user_id
        != user.user_id
    ):

        return


    if not isinstance(
        data,
        dict,
    ):

        return


    supplied_room_code = str(
        data.get(
            "room_code",
            "",
        )
    ).strip().upper()


    if (
        supplied_room_code
        != room.code
    ):

        return


    try:

        result, created = (
            game_sessions
            .submit_intermission_score(

                room.code,

                turn_number=
                    int(
                        data.get(
                            "turn_number",
                            0,
                        )
                    ),

                game_id=
                    str(
                        data.get(
                            "game_id",
                            "",
                        )
                    ).strip(),

                player_id=
                    player.player_id,

                score=
                    int(
                        data.get(
                            "score",
                            0,
                        )
                    ),

                players=
                    room.players,
            )
        )

    except (
        TypeError,
        ValueError,
    ) as error:

        print(
            "[INTERMISSION SCORE ERROR] "
            f"room={room.code} "
            f"player={player.player_id} "
            f"message={error}"
        )

        return


    await persist_room_state(
        room.code
    )


    if (
        result is not None
        and created
    ):

        print(
            "[INTERMISSION RESULT] "
            f"room={room.code} "
            f"turn={result['turn_number']} "
            f"winner={result['winner_name'] or 'TIE'}"
        )


        await sio.emit(

            "intermission_result",

            {
                "room_code":
                    room.code,

                **result,
            },

            room=
                room.code,
        )


    await broadcast_game_state(
        room.code
    )


# =========================================================
# CHAT
# =========================================================

@sio.event
async def send_chat(
    sid,
    data,
):

    user = (
        await require_socket_user(

            sid,

            error_event=
                "chat_error",
        )
    )


    if (
        user is None
    ):

        return


    room = (
        rooms.room_for_socket(
            sid
        )
    )


    player = (
        rooms.player_for_socket(
            sid
        )
    )


    if (
        room is None
        or player is None
    ):

        await sio.emit(

            "chat_error",

            {
                "message":
                    "Resume an adventure before chatting."
            },

            to=
                sid,
        )

        return


    if (
        player.user_id
        != user.user_id
    ):

        await sio.emit(

            "chat_error",

            {
                "message":
                    "Player ownership mismatch."
            },

            to=
                sid,
        )

        return


    if not isinstance(
        data,
        dict,
    ):

        return


    text = str(
        data.get(
            "text",
            "",
        )
    ).strip()


    if (
        not text
    ):

        return


    if (
        len(
            text
        )
        > 500
    ):

        await sio.emit(

            "chat_error",

            {
                "message":
                    "Message exceeds "
                    "500 characters."
            },

            to=
                sid,
        )

        return


    message = (
        chat.create_message(

            room_code=
                room.code,

            player_name=
                player.name,

            text=
                text,
        )
    )


    await store.save_chat_message(
        room.code,
        message,
    )


    chat_payload = (
        message.to_dict()
    )


    chat_payload[
        "room_code"
    ] = room.code


    await sio.emit(

        "chat_message",

        chat_payload,

        room=
            room.code,
    )


# =========================================================
# ASGI
# =========================================================

app = socketio.ASGIApp(

    sio,

    other_asgi_app=
        fastapi_app,
)