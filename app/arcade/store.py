from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.database import DatabaseConnection, connect_database

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
DATABASE_PATH = DATA_DIR / "game_state.sqlite3"

# Existing live cabinets keep their current behavior. New/experimental cabinets
# start in the lab until an administrator explicitly publishes them.
DEFAULT_ARCADE_PUBLICATION: dict[str, bool] = {
    "outlier": True,
    "pong": True,
    "missile_defense": True,
    "archery": False,
    "maze": True,
    "word_puzzle": True,
    "hangman": False,
    "road_racer": True,
    "brick_breaker": False,
    "data_snake": False,
    "light_cycles": False,
    "projectile_duel": False,
    "bowling": False,
    "golf": False,
    "beer_pong": False,
    "basketball": False,
    "blackjack": False,
    "war_cards": False,
    "battleship": False,
    "mahjong_match": False,
}

@dataclass(frozen=True)
class ArcadePublication:
    game_id: str
    is_live: bool
    updated_by: str = ""
    updated_at: str = ""

    def public_data(self) -> dict:
        # Publication is intentionally low-information: players only need to
        # know which cabinet IDs are available, not which administrator changed them.
        return {
            "game_id": self.game_id,
            "is_live": self.is_live,
        }


class ArcadePublicationStore:
    def __init__(self, database_path: Path = DATABASE_PATH) -> None:
        self.database_path = database_path

    def _connect(self) -> DatabaseConnection:
        return connect_database(self.database_path)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize_sync)

    def _initialize_sync(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS arcade_publication (
                    game_id TEXT PRIMARY KEY,
                    is_live INTEGER NOT NULL DEFAULT 0,
                    updated_by TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL
                )
                """
            )
            for game_id, is_live in DEFAULT_ARCADE_PUBLICATION.items():
                connection.execute(
                    """
                    INSERT OR IGNORE INTO arcade_publication (
                        game_id, is_live, updated_by, updated_at
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (game_id, int(is_live), "system-default", now),
                )
            connection.commit()

    async def list_publication(self) -> list[ArcadePublication]:
        return await asyncio.to_thread(self._list_publication_sync)

    def _list_publication_sync(self) -> list[ArcadePublication]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT game_id, is_live, updated_by, updated_at
                FROM arcade_publication
                ORDER BY game_id
                """
            ).fetchall()
        return [
            ArcadePublication(
                game_id=str(row["game_id"]),
                is_live=bool(row["is_live"]),
                updated_by=str(row["updated_by"] or ""),
                updated_at=str(row["updated_at"] or ""),
            )
            for row in rows
        ]

    async def set_live(self, game_id: str, is_live: bool, updated_by: str) -> ArcadePublication:
        if game_id not in DEFAULT_ARCADE_PUBLICATION:
            raise KeyError(game_id)
        return await asyncio.to_thread(self._set_live_sync, game_id, is_live, updated_by)

    def _set_live_sync(self, game_id: str, is_live: bool, updated_by: str) -> ArcadePublication:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO arcade_publication (game_id, is_live, updated_by, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(game_id) DO UPDATE SET
                    is_live = excluded.is_live,
                    updated_by = excluded.updated_by,
                    updated_at = excluded.updated_at
                """,
                (game_id, int(is_live), updated_by, now),
            )
            connection.commit()
        return ArcadePublication(game_id, is_live, updated_by, now)


arcade_publication_store = ArcadePublicationStore()
