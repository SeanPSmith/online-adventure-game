from __future__ import annotations

import asyncio

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.database import connect_database
from app.game.rooms import rooms
from app.game.session import game_sessions


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_PATH = PROJECT_ROOT / "data" / "game_state.sqlite3"
RECENT_SESSION_WINDOW_MINUTES = 15


def _as_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return None
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


class AdminAnalyticsService:
    """Read-only operational analytics for the private superuser control room.

    This deliberately derives its first dashboard from data the game already owns:
    registered accounts, auth activity, completed adventure history, and the current
    in-memory room/session registry. It does not alter gameplay state and it does not
    add analytics calls to the hot turn-resolution path.
    """

    def __init__(self, database_path: Path = DATABASE_PATH) -> None:
        self.database_path = Path(database_path)

    def _live_snapshot(self) -> tuple[list[dict[str, Any]], set[str]]:
        live_rooms: list[dict[str, Any]] = []
        user_ids: set[str] = set()

        for room in rooms.all_rooms():
            session = game_sessions.get(room.code)

            players = []
            for player in room.players.values():
                user_ids.add(str(player.user_id))
                players.append({
                    "user_id": str(player.user_id),
                    "hero_name": str(player.name),
                    "is_host": bool(player.is_host),
                    "is_online": bool(player.is_online),
                })

            if session is None:
                adventure_id = ""
                adventure_title = "WAITING FOR ADVENTURE"
                turn_number = 0
                completed = False
                frozen_turn = False
                micro_event = False
            else:
                adventure_id = str(session.adventure_id)
                try:
                    adventure_title = str(session.adventure.title)
                except Exception:
                    adventure_title = adventure_id or "UNKNOWN ADVENTURE"
                turn_number = int(session.turn_number or 0)
                completed = bool(session.completed)
                frozen_turn = session.pending_turn_facts is not None
                micro_event = session.pending_micro_event is not None

            if completed:
                state = "COMPLETE"
            elif session is None or not getattr(session, "started", True):
                state = "LOBBY"
            elif room.online_count <= 0:
                state = "IDLE"
            elif frozen_turn:
                state = "DIRECTOR / FROZEN"
            elif micro_event:
                state = "MICRO EVENT"
            elif session is None:
                state = "LOBBY"
            else:
                state = "PLAYING"

            live_rooms.append({
                "room_code": room.code,
                "play_mode": room.play_mode,
                "player_count": room.player_count,
                "online_count": room.online_count,
                "adventure_id": adventure_id,
                "adventure_title": adventure_title,
                "turn_number": turn_number,
                "state": state,
                "players": players,
            })

        live_rooms.sort(
            key=lambda item: (
                -int(item["online_count"]),
                str(item["room_code"]),
            )
        )

        return live_rooms, user_ids

    def _database_snapshot_sync(
        self,
        live_user_ids: set[str],
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        recent_cutoff = now - timedelta(minutes=RECENT_SESSION_WINDOW_MINUTES)

        with connect_database(self.database_path) as connection:
            user_summary = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_users,
                    COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0)
                        AS active_accounts
                FROM users
                """
            ).fetchone()

            author_summary = connection.execute(
                """
                SELECT COUNT(DISTINCT user_id) AS authors
                FROM user_permissions
                WHERE permission = 'author'
                """
            ).fetchone()

            auth_rows = connection.execute(
                """
                SELECT user_id, last_seen_at, expires_at
                FROM auth_sessions
                """
            ).fetchall()

            recently_active_user_ids: set[str] = set()
            active_session_count = 0
            for row in auth_rows:
                expires_at = _as_datetime(row["expires_at"])
                last_seen_at = _as_datetime(row["last_seen_at"])
                if (
                    expires_at is None
                    or last_seen_at is None
                    or expires_at <= now
                    or last_seen_at < recent_cutoff
                ):
                    continue
                active_session_count += 1
                recently_active_user_ids.add(str(row["user_id"]))

            completed_summary = connection.execute(
                """
                SELECT
                    COUNT(*) AS adventures_completed,
                    COALESCE(SUM(turn_count), 0) AS turns_completed,
                    COALESCE(AVG(turn_count), 0) AS average_turns
                FROM adventure_history
                """
            ).fetchone()

            distinct_players = connection.execute(
                """
                SELECT COUNT(DISTINCT user_id) AS players_with_history
                FROM adventure_history_players
                """
            ).fetchone()

            popular_rows = connection.execute(
                """
                SELECT
                    adventure_id,
                    adventure_title,
                    COUNT(*) AS completions,
                    COALESCE(SUM(turn_count), 0) AS turns,
                    COALESCE(AVG(turn_count), 0) AS average_turns,
                    MAX(completed_at) AS last_completed_at
                FROM adventure_history
                GROUP BY adventure_id, adventure_title
                ORDER BY completions DESC, turns DESC, adventure_title
                LIMIT 12
                """
            ).fetchall()

            player_rows = connection.execute(
                """
                SELECT
                    player.user_id,
                    COALESCE(users.username, player.user_id) AS username,
                    COUNT(DISTINCT player.history_id) AS adventures_completed,
                    COALESCE(SUM(history.turn_count), 0) AS turns_played,
                    COALESCE(SUM(player.checks_total), 0) AS checks_total,
                    COALESCE(SUM(player.checks_succeeded), 0) AS checks_succeeded,
                    COALESCE(SUM(player.critical_successes), 0) AS critical_successes,
                    COALESCE(SUM(player.intermission_wins), 0) AS intermission_wins,
                    MAX(history.completed_at) AS last_completed_at
                FROM adventure_history_players AS player
                INNER JOIN adventure_history AS history
                    ON history.history_id = player.history_id
                LEFT JOIN users
                    ON users.user_id = player.user_id
                GROUP BY player.user_id, users.username
                ORDER BY turns_played DESC, adventures_completed DESC, username
                LIMIT 12
                """
            ).fetchall()

            recent_rows = connection.execute(
                """
                SELECT
                    history.history_id,
                    history.adventure_title,
                    history.ending_label,
                    history.turn_count,
                    history.completed_at,
                    GROUP_CONCAT(player.character_name, ', ') AS heroes
                FROM adventure_history AS history
                LEFT JOIN adventure_history_players AS player
                    ON player.history_id = history.history_id
                GROUP BY
                    history.history_id,
                    history.adventure_title,
                    history.ending_label,
                    history.turn_count,
                    history.completed_at
                ORDER BY history.completed_at DESC
                LIMIT 12
                """
            ).fetchall()

            daily_rows = connection.execute(
                """
                SELECT
                    SUBSTR(completed_at, 1, 10) AS play_day,
                    COUNT(*) AS adventures,
                    COALESCE(SUM(turn_count), 0) AS turns
                FROM adventure_history
                GROUP BY SUBSTR(completed_at, 1, 10)
                ORDER BY play_day DESC
                LIMIT 14
                """
            ).fetchall()

            generated_summary = connection.execute(
                """
                SELECT
                    COUNT(*) AS generated_total,
                    COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0)
                        AS generated_approved
                FROM generated_adventures
                """
            ).fetchone()

            username_map: dict[str, str] = {}
            if live_user_ids:
                placeholders = ", ".join("?" for _ in live_user_ids)
                rows = connection.execute(
                    f"""
                    SELECT user_id, username
                    FROM users
                    WHERE user_id IN ({placeholders})
                    """,
                    tuple(sorted(live_user_ids)),
                ).fetchall()
                username_map = {
                    str(row["user_id"]): str(row["username"])
                    for row in rows
                }

        return {
            "accounts": {
                "registered_users": int(user_summary["total_users"] or 0),
                "active_accounts": int(user_summary["active_accounts"] or 0),
                "authors": int(author_summary["authors"] or 0),
                "recently_active_users": len(recently_active_user_ids),
                "recent_auth_sessions": active_session_count,
                "recent_window_minutes": RECENT_SESSION_WINDOW_MINUTES,
                "players_with_completed_history": int(
                    distinct_players["players_with_history"] or 0
                ),
            },
            "totals": {
                "adventures_completed": int(
                    completed_summary["adventures_completed"] or 0
                ),
                "turns_completed": int(completed_summary["turns_completed"] or 0),
                "average_turns": round(float(completed_summary["average_turns"] or 0), 1),
                "generated_adventures": int(generated_summary["generated_total"] or 0),
                "approved_generated_adventures": int(
                    generated_summary["generated_approved"] or 0
                ),
            },
            "popular_adventures": [
                {
                    "adventure_id": str(row["adventure_id"]),
                    "adventure_title": str(row["adventure_title"]),
                    "completions": int(row["completions"] or 0),
                    "turns": int(row["turns"] or 0),
                    "average_turns": round(float(row["average_turns"] or 0), 1),
                    "last_completed_at": str(row["last_completed_at"] or ""),
                }
                for row in popular_rows
            ],
            "top_players": [
                {
                    "user_id": str(row["user_id"]),
                    "username": str(row["username"]),
                    "adventures_completed": int(row["adventures_completed"] or 0),
                    "turns_played": int(row["turns_played"] or 0),
                    "checks_total": int(row["checks_total"] or 0),
                    "checks_succeeded": int(row["checks_succeeded"] or 0),
                    "critical_successes": int(row["critical_successes"] or 0),
                    "intermission_wins": int(row["intermission_wins"] or 0),
                    "last_completed_at": str(row["last_completed_at"] or ""),
                }
                for row in player_rows
            ],
            "recent_completions": [
                {
                    "history_id": str(row["history_id"]),
                    "adventure_title": str(row["adventure_title"]),
                    "ending_label": str(row["ending_label"]),
                    "turn_count": int(row["turn_count"] or 0),
                    "completed_at": str(row["completed_at"] or ""),
                    "heroes": str(row["heroes"] or ""),
                }
                for row in recent_rows
            ],
            "daily_activity": list(reversed([
                {
                    "day": str(row["play_day"] or ""),
                    "adventures": int(row["adventures"] or 0),
                    "turns": int(row["turns"] or 0),
                }
                for row in daily_rows
            ])),
            "live_usernames": username_map,
        }

    async def snapshot(self) -> dict[str, Any]:
        live_rooms, live_user_ids = self._live_snapshot()
        persisted = await asyncio.to_thread(
            self._database_snapshot_sync,
            live_user_ids,
        )

        username_map = persisted.pop("live_usernames", {})
        for room in live_rooms:
            for player in room["players"]:
                player["username"] = username_map.get(
                    player["user_id"],
                    player["user_id"],
                )

        live_players = sum(int(room["online_count"]) for room in live_rooms)
        live_resolved_turns = sum(
            max(0, int(room["turn_number"]) - 1)
            for room in live_rooms
        )

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "live": {
                "rooms": len(live_rooms),
                "online_players": live_players,
                "resolved_turns_in_live_rooms": live_resolved_turns,
                "solo_rooms": sum(
                    1 for room in live_rooms if room["play_mode"] == "solo"
                ),
                "coop_rooms": sum(
                    1 for room in live_rooms if room["play_mode"] == "coop"
                ),
                "rooms_detail": live_rooms,
            },
            **persisted,
        }


admin_analytics_service = AdminAnalyticsService()
