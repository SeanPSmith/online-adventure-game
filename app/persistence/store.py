from __future__ import annotations

import asyncio
import json

from pathlib import Path

from app.database import (
    DatabaseConnection,
    connect_database,
)


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DATA_DIR = (
    PROJECT_ROOT
    / "data"
)

DATABASE_PATH = (
    DATA_DIR
    / "game_state.sqlite3"
)

SCHEMA_VERSION = 7


class SQLiteStateStore:

    def __init__(
        self,
        database_path: Path = DATABASE_PATH,
    ) -> None:

        self.database_path = (
            database_path
        )


    # =====================================================
    # CONNECTION
    # =====================================================

    def _connect(
        self,
    ) -> DatabaseConnection:

        return connect_database(
            self.database_path
        )


    # =====================================================
    # INITIALIZE
    # =====================================================

    async def initialize(
        self,
    ) -> None:

        await asyncio.to_thread(
            self._initialize_sync
        )


    def _initialize_sync(
        self,
    ) -> None:

        DATA_DIR.mkdir(
            parents=True,
            exist_ok=True,
        )


        with self._connect() as connection:

            connection.execute(
                "PRAGMA journal_mode=WAL"
            )

            connection.execute(
                "PRAGMA synchronous=NORMAL"
            )


            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS room_snapshots (
                    room_code TEXT PRIMARY KEY,
                    schema_version INTEGER NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                        DEFAULT CURRENT_TIMESTAMP
                )
                """
            )


            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    room_code TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    message_text TEXT NOT NULL,
                    message_timestamp TEXT NOT NULL
                )
                """
            )


            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_chat_room_timestamp
                ON chat_messages (
                    room_code,
                    message_timestamp
                )
                """
            )


            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS adventure_history (
                    history_id TEXT PRIMARY KEY,
                    room_code TEXT NOT NULL UNIQUE,
                    adventure_id TEXT NOT NULL,
                    adventure_title TEXT NOT NULL,
                    ending_label TEXT NOT NULL,
                    turn_count INTEGER NOT NULL,
                    final_scene_title TEXT NOT NULL,
                    final_resolution TEXT NOT NULL,
                    recap TEXT NOT NULL,
                    story_state_json TEXT NOT NULL,
                    director_history_json TEXT NOT NULL,
                    director_usage_json TEXT NOT NULL,
                    completed_at TEXT NOT NULL
                        DEFAULT CURRENT_TIMESTAMP
                )
                """
            )


            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS adventure_history_players (
                    history_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    character_id TEXT NOT NULL,
                    character_name TEXT NOT NULL,
                    is_host INTEGER NOT NULL DEFAULT 0,
                    checks_total INTEGER NOT NULL DEFAULT 0,
                    checks_succeeded INTEGER NOT NULL DEFAULT 0,
                    critical_successes INTEGER NOT NULL DEFAULT 0,
                    critical_failures INTEGER NOT NULL DEFAULT 0,
                    intermission_wins INTEGER NOT NULL DEFAULT 0,

                    PRIMARY KEY (
                        history_id,
                        character_id
                    )
                )
                """
            )


            connection.execute("""
                CREATE TABLE IF NOT EXISTS abandoned_adventures (
                    room_code TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (room_code, user_id)
                )
            """)

            connection.execute("""
                CREATE TABLE IF NOT EXISTS player_onboarding (
                    user_id TEXT PRIMARY KEY,
                    dismissed INTEGER NOT NULL DEFAULT 0
                )
            """)

            history_columns = {row["name"] for row in connection.execute("PRAGMA table_info(adventure_history)").fetchall()}
            for name in ("world_title", "play_mode"):
                if name not in history_columns:
                    connection.execute(f"ALTER TABLE adventure_history ADD COLUMN {name} TEXT NOT NULL DEFAULT ''")

            existing_player_columns = {
                row["name"]
                for row in connection.execute(
                    "PRAGMA table_info(adventure_history_players)"
                ).fetchall()
            }


            for column_name in (
                "checks_total",
                "checks_succeeded",
                "critical_successes",
                "critical_failures",
                "intermission_wins",
            ):

                if column_name not in existing_player_columns:

                    connection.execute(
                        f"ALTER TABLE adventure_history_players "
                        f"ADD COLUMN {column_name} "
                        "INTEGER NOT NULL DEFAULT 0"
                    )


            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_history_players_character
                ON adventure_history_players (
                    user_id,
                    character_id
                )
                """
            )


            connection.commit()


    # =====================================================
    # ROOM SNAPSHOTS
    # =====================================================

    async def save_room_snapshot(
        self,
        room,
        game_session,
    ) -> None:

        payload = {

            "room": {

                "code":
                    room.code,

                "play_mode":
                    room.play_mode,

                "players": [

                    {
                        "player_id":
                            player.player_id,

                        "user_id":
                            player.user_id,

                        "character_id":
                            player.character_id,

                        "name":
                            player.name,

                        "is_host":
                            player.is_host,

                        "is_online":
                            player.is_online,
                    }

                    for player
                    in room.players.values()
                ],
            },


            "game": {

                "adventure_title": game_session.adventure.title,
                "world_title": getattr(game_session.adventure, "metadata", {}).get("world_title", ""),

                "adventure_id":
                    game_session.adventure_id,

                "scene_id":
                    game_session.scene_id,

                "turn_number":
                    game_session.turn_number,

                "started":
                    bool(game_session.started),

                "submissions":
                    dict(
                        game_session.submissions
                    ),

                "world_flags":
                    dict(
                        game_session.world_flags
                    ),

                "last_resolution":
                    game_session.last_resolution,

                "dynamic_scene":
                    game_session.dynamic_scene,

                "director_memory":
                    game_session.director_memory,

                "story_state":
                    dict(
                        game_session.story_state
                    ),

                "director_history":
                    list(
                        game_session.director_history
                    ),

                "turn_archive":
                    list(
                        game_session.turn_archive
                    ),

                "director_min_turns":
                    game_session.director_min_turns,

                "director_target_turns":
                    game_session.director_target_turns,

                "director_max_turns":
                    game_session.director_max_turns,

                "wrap_up_votes":
                    list(game_session.wrap_up_votes),

                "wrap_up_active":
                    bool(game_session.wrap_up_active),

                "wrap_up_turns_remaining":
                    int(game_session.wrap_up_turns_remaining or 0),

                "pending_turn_facts":
                    game_session.pending_turn_facts,

                "director_usage":
                    dict(
                        game_session.director_usage
                    ),

                "character_adventure_stats":
                    dict(
                        game_session.character_adventure_stats
                    ),

                "completed":
                    game_session.completed,

                "ending_label":
                    game_session.ending_label,

                "intermission_scores":
                    dict(
                        game_session.intermission_scores
                    ),

                "intermission_results":
                    dict(
                        game_session.intermission_results
                    ),

                "intermission_wins":
                    dict(
                        game_session.intermission_wins
                    ),
            },
        }


        await asyncio.to_thread(
            self._save_room_snapshot_sync,
            room.code,
            payload,
        )


    def _save_room_snapshot_sync(
        self,
        room_code: str,
        payload: dict,
    ) -> None:

        encoded = json.dumps(
            payload
        )


        with self._connect() as connection:

            connection.execute(
                """
                INSERT INTO room_snapshots (
                    room_code,
                    schema_version,
                    payload,
                    updated_at
                )
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)

                ON CONFLICT(room_code)
                DO UPDATE SET
                    schema_version = excluded.schema_version,
                    payload = excluded.payload,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    room_code,
                    SCHEMA_VERSION,
                    encoded,
                ),
            )


            connection.commit()


    async def load_room_snapshots(
        self,
    ) -> list[dict]:

        return await asyncio.to_thread(
            self._load_room_snapshots_sync
        )


    def _load_room_snapshots_sync(
        self,
    ) -> list[dict]:

        snapshots: list[
            dict
        ] = []


        with self._connect() as connection:

            rows = connection.execute(
                """
                SELECT
                    payload
                FROM room_snapshots
                ORDER BY updated_at ASC
                """
            ).fetchall()


        for row in rows:

            try:

                payload = json.loads(
                    row[
                        "payload"
                    ]
                )

            except (
                json.JSONDecodeError,
                TypeError,
            ):

                continue


            if not isinstance(
                payload,
                dict,
            ):

                continue


            snapshots.append(
                payload
            )


        return snapshots


    # =====================================================
    # COMPLETED ADVENTURE HISTORY
    # =====================================================

    async def record_completed_adventure(
        self,
        room,
        game_session,
    ) -> None:

        await asyncio.to_thread(
            self._record_completed_adventure_sync,
            room,
            game_session,
        )


    def _record_completed_adventure_sync(
        self,
        room,
        game_session,
    ) -> None:

        if not game_session.completed:

            return


        history_id = (
            f"{room.code}:"
            f"{game_session.adventure_id}"
        )


        with self._connect() as connection:

            connection.execute(
                """
                INSERT INTO adventure_history (
                    history_id,
                    room_code,
                    adventure_id,
                    adventure_title,
                    ending_label,
                    turn_count,
                    final_scene_title,
                    final_resolution,
                    recap,
                    story_state_json,
                    director_history_json,
                    director_usage_json,
                    completed_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT(room_code)
                DO UPDATE SET
                    ending_label = excluded.ending_label,
                    turn_count = excluded.turn_count,
                    final_scene_title = excluded.final_scene_title,
                    final_resolution = excluded.final_resolution,
                    recap = excluded.recap,
                    story_state_json = excluded.story_state_json,
                    director_history_json = excluded.director_history_json,
                    director_usage_json = excluded.director_usage_json
                """,
                (
                    history_id,
                    room.code,
                    game_session.adventure_id,
                    game_session.adventure.title,
                    game_session.ending_label,
                    int(
                        game_session.turn_number
                    ),
                    str(
                        game_session.scene.title
                    ),
                    str(
                        game_session.last_resolution
                        or ""
                    ),
                    str(
                        game_session.director_memory
                        or game_session.last_resolution
                        or ""
                    ),
                    json.dumps(
                        game_session.story_state
                    ),
                    json.dumps(
                        getattr(
                            game_session,
                            "turn_archive",
                            [],
                        )
                        or game_session.director_history
                    ),
                    json.dumps(
                        game_session.director_usage
                    ),
                ),
            )


            connection.execute(
                "UPDATE adventure_history SET world_title = ?, play_mode = ? WHERE history_id = ?",
                (getattr(game_session.adventure, "metadata", {}).get("world_title") or "",
                 getattr(room, "play_mode", "coop"), history_id),
            )

            connection.execute(
                """
                DELETE FROM adventure_history_players
                WHERE history_id = ?
                """,
                (
                    history_id,
                ),
            )


            for (
                player_id,
                player,
            ) in room.players.items():

                saved_totals = (
                    getattr(
                        game_session,
                        "character_adventure_stats",
                        {},
                    )
                    or {}
                ).get(
                    player.character_id,
                    {}
                )


                checks_total = int(
                    saved_totals.get(
                        "checks_total",
                        0,
                    )
                    or 0
                )

                checks_succeeded = int(
                    saved_totals.get(
                        "checks_succeeded",
                        0,
                    )
                    or 0
                )

                critical_successes = int(
                    saved_totals.get(
                        "critical_successes",
                        0,
                    )
                    or 0
                )

                critical_failures = int(
                    saved_totals.get(
                        "critical_failures",
                        0,
                    )
                    or 0
                )


                # Backward compatibility for completed sessions/snapshots
                # created before character_adventure_stats existed.
                if not saved_totals:

                    for history_entry in (
                        game_session.director_history
                        or []
                    ):

                        for choice in history_entry.get(
                            "choices",
                            [],
                        ):

                            check = choice.get(
                                "check"
                            )


                            if not isinstance(
                                check,
                                dict,
                            ):

                                continue


                            if str(
                                check.get(
                                    "character_id",
                                    "",
                                )
                            ) != str(
                                player.character_id
                            ):

                                continue


                            checks_total += 1


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

                                checks_succeeded += 1


                            if outcome == "critical_success":

                                critical_successes += 1


                            elif outcome == "critical_failure":

                                critical_failures += 1


                intermission_wins = int(
                    (
                        getattr(
                            game_session,
                            "intermission_wins",
                            {},
                        )
                        or {}
                    ).get(
                        player_id,
                        0,
                    )
                    or 0
                )


                connection.execute(
                    """
                    INSERT INTO adventure_history_players (
                        history_id,
                        user_id,
                        character_id,
                        character_name,
                        is_host,
                        checks_total,
                        checks_succeeded,
                        critical_successes,
                        critical_failures,
                        intermission_wins
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        history_id,
                        player.user_id,
                        player.character_id,
                        player.name,
                        1
                        if player.is_host
                        else 0,
                        checks_total,
                        checks_succeeded,
                        critical_successes,
                        critical_failures,
                        intermission_wins,
                    ),
                )


            connection.commit()


    async def list_completed_adventures(
        self,
        *,
        user_id: str,
        character_id: str | None = None,
    ) -> list[dict]:

        return await asyncio.to_thread(
            self._list_completed_adventures_sync,
            user_id,
            character_id,
        )


    def _list_completed_adventures_sync(
        self,
        user_id: str,
        character_id: str | None,
    ) -> list[dict]:

        with self._connect() as connection:

            rows = connection.execute(
                """
                SELECT
                    history.history_id,
                    history.room_code,
                    history.adventure_id,
                    history.adventure_title,
                    history.ending_label,
                    history.turn_count,
                    history.final_scene_title,
                    history.final_resolution,
                    history.recap,
                    history.story_state_json,
                    history.director_usage_json,
                    history.completed_at,
                    history.world_title,
                    history.play_mode,
                    history.director_history_json
                FROM adventure_history AS history

                INNER JOIN adventure_history_players AS player
                    ON player.history_id
                    = history.history_id

                WHERE player.user_id = ?
                  AND (? IS NULL OR player.character_id = ?)

                ORDER BY history.completed_at DESC
                """,
                (
                    user_id,
                    character_id,
                    character_id,
                ),
            ).fetchall()


            stories = []


            for row in rows:

                player_rows = connection.execute(
                    """
                    SELECT
                        character_id,
                        character_name,
                        is_host
                    FROM adventure_history_players
                    WHERE history_id = ?
                    ORDER BY is_host DESC, character_name ASC
                    """,
                    (
                        row[
                            "history_id"
                        ],
                    ),
                ).fetchall()


                try:

                    story_state = json.loads(
                        row[
                            "story_state_json"
                        ]
                    )

                except (
                    json.JSONDecodeError,
                    TypeError,
                ):

                    story_state = {}


                try:

                    usage = json.loads(
                        row[
                            "director_usage_json"
                        ]
                    )

                except (
                    json.JSONDecodeError,
                    TypeError,
                ):

                    usage = {}


                try:
                    archive = json.loads(row["director_history_json"])
                except (ValueError, TypeError):
                    archive = []
                turn_history = [{"turn_number": turn.get("turn_number", 0),
                                 "scene_title": turn.get("source_scene_title") or turn.get("scene_title", ""),
                                 "resolution": turn.get("resolution", "")}
                                for turn in archive if isinstance(turn, dict)]
                stories.append({
                    "world_title": row["world_title"],
                    "play_mode": row["play_mode"],
                    "turn_history": turn_history,
                    "history_id":
                        row[
                            "history_id"
                        ],

                    "room_code":
                        row[
                            "room_code"
                        ],

                    "adventure_id":
                        row[
                            "adventure_id"
                        ],

                    "adventure_title":
                        row[
                            "adventure_title"
                        ],

                    "ending_label":
                        row[
                            "ending_label"
                        ],

                    "turn_count":
                        int(
                            row[
                                "turn_count"
                            ]
                        ),

                    "final_scene_title":
                        row[
                            "final_scene_title"
                        ],

                    "final_resolution":
                        row[
                            "final_resolution"
                        ],

                    "recap":
                        row[
                            "recap"
                        ],

                    "completed_at":
                        row[
                            "completed_at"
                        ],

                    "story_state": {
                        "resolved_threads":
                            list(
                                story_state.get(
                                    "resolved_threads",
                                    [],
                                )
                            ),

                        "closed_opportunities":
                            list(
                                story_state.get(
                                    "closed_opportunities",
                                    [],
                                )
                            ),
                    },

                    "director_usage": {
                        "requests":
                            int(
                                usage.get(
                                    "requests",
                                    0,
                                )
                                or 0
                            ),

                        "total_tokens":
                            int(
                                usage.get(
                                    "total_tokens",
                                    0,
                                )
                                or 0
                            ),
                    },

                    "players": [
                        {
                            "character_id":
                                player_row[
                                    "character_id"
                                ],

                            "character_name":
                                player_row[
                                    "character_name"
                                ],

                            "is_host":
                                bool(
                                    player_row[
                                        "is_host"
                                    ]
                                ),
                        }

                        for player_row
                        in player_rows
                    ],
                })


        return stories


    async def onboarding_dismissed(self, user_id: str) -> bool:
        return await asyncio.to_thread(self._onboarding_dismissed_sync, user_id)

    def _onboarding_dismissed_sync(self, user_id):
        with self._connect() as connection:
            row = connection.execute("SELECT dismissed FROM player_onboarding WHERE user_id = ?", (user_id,)).fetchone()
        return bool(row and row["dismissed"])

    async def dismiss_onboarding(self, user_id: str) -> None:
        await asyncio.to_thread(self._dismiss_onboarding_sync, user_id)

    def _dismiss_onboarding_sync(self, user_id):
        with self._connect() as connection:
            connection.execute("""
                INSERT INTO player_onboarding (user_id, dismissed) VALUES (?, 1)
                ON CONFLICT(user_id) DO UPDATE SET dismissed = 1
            """, (user_id,))
            connection.commit()

    async def archive_abandoned_adventure(self, room, session, *, operator_id=None) -> None:
        if session.completed:
            return
        # Archive before removing any live state. One private record per member.
        payload = {
            "room_code": room.code,
            "ended_by": "operator" if operator_id else "host",
            "adventure_id": session.adventure_id,
            "adventure_title": session.adventure.title,
            "turn_count": session.turn_number,
            "started": bool(getattr(session, "started", True)),
            "recap": session.last_resolution or "",
            "play_mode": room.play_mode,
            "world_title": getattr(session.adventure, "metadata", {}).get("world_title", ""),
            "players": [{"character_name": p.name, "character_id": p.character_id, "user_id": p.user_id}
                        for p in room.players.values()],
        }
        members = [p.user_id for p in room.players.values()]
        await asyncio.to_thread(self._archive_abandoned_sync, payload, members, operator_id)

    def _archive_abandoned_sync(self, payload, members, operator_id=None):
        with self._connect() as connection:
            for user_id in set(members):
                connection.execute("""
                    INSERT INTO abandoned_adventures (room_code, user_id, payload)
                    VALUES (?, ?, ?)
                    ON CONFLICT(room_code, user_id) DO NOTHING
                """, (payload["room_code"], user_id, json.dumps(payload)))
            if operator_id:
                from app.admin.operations import insert_action
                connection.execute("DELETE FROM room_snapshots WHERE room_code = ?", (payload["room_code"],))
                connection.execute("DELETE FROM chat_messages WHERE room_code = ?", (payload["room_code"],))
                insert_action(connection, operator_id, "room_terminate", payload["room_code"])
            connection.commit()

    async def list_player_library(self, user_id: str) -> dict:
        return await asyncio.to_thread(self._list_player_library_sync, user_id)

    def _list_player_library_sync(self, user_id: str) -> dict:
        active = []
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT payload, updated_at FROM room_snapshots ORDER BY updated_at DESC"
            ).fetchall()
            abandoned = connection.execute(
                "SELECT payload, updated_at FROM abandoned_adventures WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        for row in rows:
            try:
                payload = json.loads(row["payload"])
                room, game = payload["room"], payload["game"]
                members = [p for p in room["players"] if p["user_id"] == user_id]
                if not members or game.get("completed"):
                    continue
                for member in members:
                    active.append({
                        "room_code": room["code"], "character_id": member["character_id"],
                        "adventure_id": game["adventure_id"],
                        "adventure_title": game.get("adventure_title", ""),
                        "world_title": game.get("world_title", ""),
                        "turn_count": game.get("turn_number", 0),
                        "target_turns": game.get("director_target_turns"),
                        "updated_at": row["updated_at"], "play_mode": room.get("play_mode", "coop"),
                        "recap": game.get("last_resolution") or "",
                        "players": [{"character_name": p["name"], "character_id": p["character_id"]} for p in room["players"]],
                    })
            except (ValueError, TypeError, KeyError):
                continue
        completed = self._list_completed_adventures_sync(user_id, None)
        # Multiple Heroes from one account must not duplicate the same Chronicle.
        completed = list({story["history_id"]: story for story in completed}.values())
        archived = []
        for row in abandoned:
            entry = dict(json.loads(row["payload"]), updated_at=row["updated_at"])
            for player in entry["players"]:
                player.pop("user_id", None)
            archived.append(entry)
        return {"active": active, "completed": completed, "abandoned": archived}

    # =====================================================
    # DELETE ROOM
    # =====================================================

    async def delete_room(
        self,
        room_code: str,
    ) -> None:

        await asyncio.to_thread(
            self._delete_room_sync,
            room_code,
        )


    def _delete_room_sync(
        self,
        room_code: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                DELETE FROM room_snapshots
                WHERE room_code = ?
                """,
                (
                    room_code,
                ),
            )


            connection.execute(
                """
                DELETE FROM chat_messages
                WHERE room_code = ?
                """,
                (
                    room_code,
                ),
            )


            connection.commit()


    # =====================================================
    # CHAT
    # =====================================================

    async def save_chat_message(
        self,
        room_code: str,
        message,
    ) -> None:

        await asyncio.to_thread(
            self._save_chat_message_sync,
            room_code,
            message.to_dict(),
        )


    def _save_chat_message_sync(
        self,
        room_code: str,
        message: dict,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                INSERT OR IGNORE INTO chat_messages (
                    id,
                    room_code,
                    player_name,
                    message_text,
                    message_timestamp
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    message[
                        "id"
                    ],

                    room_code,

                    message[
                        "player_name"
                    ],

                    message[
                        "text"
                    ],

                    message[
                        "timestamp"
                    ],
                ),
            )


            connection.commit()


    async def load_chat_history(
        self,
        room_code: str,
        limit: int = 100,
    ) -> list[dict]:

        return await asyncio.to_thread(
            self._load_chat_history_sync,
            room_code,
            limit,
        )


    def _load_chat_history_sync(
        self,
        room_code: str,
        limit: int,
    ) -> list[dict]:

        with self._connect() as connection:

            rows = connection.execute(
                """
                SELECT
                    id,
                    player_name,
                    message_text,
                    message_timestamp
                FROM chat_messages
                WHERE room_code = ?
                ORDER BY message_timestamp DESC
                LIMIT ?
                """,
                (
                    room_code,
                    limit,
                ),
            ).fetchall()


        return [

            {
                "id":
                    row[
                        "id"
                    ],

                "player_name":
                    row[
                        "player_name"
                    ],

                "text":
                    row[
                        "message_text"
                    ],

                "timestamp":
                    row[
                        "message_timestamp"
                    ],
            }

            for row
            in reversed(
                rows
            )
        ]


    # =====================================================
    # CHARACTER LIFETIME STATS
    # =====================================================

    async def get_character_lifetime_stats(
        self,
        *,
        user_id: str,
        character_id: str,
    ) -> dict:

        return await asyncio.to_thread(
            self._get_character_lifetime_stats_sync,
            user_id,
            character_id,
        )


    def _get_character_lifetime_stats_sync(
        self,
        user_id: str,
        character_id: str,
    ) -> dict:

        from datetime import date


        with self._connect() as connection:

            aggregate = connection.execute(
                """
                SELECT
                    COUNT(*) AS adventures_completed,
                    COALESCE(SUM(player.checks_total), 0) AS checks_total,
                    COALESCE(SUM(player.checks_succeeded), 0) AS checks_succeeded,
                    COALESCE(SUM(player.critical_successes), 0) AS critical_successes,
                    COALESCE(SUM(player.critical_failures), 0) AS critical_failures,
                    COALESCE(SUM(player.intermission_wins), 0) AS intermission_wins
                FROM adventure_history_players AS player
                INNER JOIN adventure_history AS history
                    ON history.history_id = player.history_id
                WHERE player.user_id = ?
                  AND player.character_id = ?
                """,
                (
                    user_id,
                    character_id,
                ),
            ).fetchone()


            day_rows = connection.execute(
                """
                SELECT DISTINCT SUBSTR(history.completed_at, 1, 10) AS play_day
                FROM adventure_history_players AS player
                INNER JOIN adventure_history AS history
                    ON history.history_id = player.history_id
                WHERE player.user_id = ?
                  AND player.character_id = ?
                ORDER BY play_day ASC
                """,
                (
                    user_id,
                    character_id,
                ),
            ).fetchall()


        play_days = [
            row["play_day"]
            for row in day_rows
            if row["play_day"]
        ]


        longest_streak = 0
        current_streak = 0
        previous_day = None


        for raw_day in play_days:

            parsed_day = date.fromisoformat(
                raw_day
            )


            if previous_day is None:

                current_streak = 1

            elif (
                parsed_day
                - previous_day
            ).days == 1:

                current_streak += 1

            else:

                current_streak = 1


            longest_streak = max(
                longest_streak,
                current_streak,
            )

            previous_day = parsed_day


        stats = {
            "adventures_completed":
                int(aggregate["adventures_completed"] or 0),

            "checks_total":
                int(aggregate["checks_total"] or 0),

            "checks_succeeded":
                int(aggregate["checks_succeeded"] or 0),

            "critical_successes":
                int(aggregate["critical_successes"] or 0),

            "critical_failures":
                int(aggregate["critical_failures"] or 0),

            "intermission_wins":
                int(aggregate["intermission_wins"] or 0),

            "play_days":
                len(play_days),

            "longest_play_streak":
                longest_streak,
        }


        stats["achievements"] = [
            {
                "id": "second_date",
                "name": "SECOND DATE",
                "description": "Play together on two different days.",
                "unlocked": stats["play_days"] >= 2,
            },
            {
                "id": "lucky_bastard",
                "name": "LUCKY BASTARD",
                "description": "Roll a critical success on an adventure check.",
                "unlocked": stats["critical_successes"] >= 1,
            },
            {
                "id": "same_time_tomorrow",
                "name": "SAME TIME TOMORROW?",
                "description": "Complete adventures on consecutive days.",
                "unlocked": stats["longest_play_streak"] >= 2,
            },
        ]


        return stats


store = SQLiteStateStore()