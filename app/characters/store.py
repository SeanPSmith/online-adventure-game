from __future__ import annotations

import asyncio
import json

from pathlib import Path

from app.database import (
    DatabaseConnection,
    connect_database,
)

from app.characters.models import (
    Character,
)


# =========================================================
# DATABASE LOCATION
# =========================================================

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


CHARACTER_SCHEMA_VERSION = 2


# =========================================================
# CHARACTER STORE
# =========================================================

class SQLiteCharacterStore:

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
    # INITIALIZATION
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
                """
                CREATE TABLE IF NOT EXISTS characters (
                    character_id TEXT PRIMARY KEY,

                    owner_user_id TEXT NOT NULL,

                    name TEXT NOT NULL,

                    schema_version INTEGER NOT NULL,

                    payload TEXT NOT NULL,

                    created_at TEXT NOT NULL,

                    updated_at TEXT NOT NULL,

                    FOREIGN KEY (
                        owner_user_id
                    )
                    REFERENCES users (
                        user_id
                    )
                    ON DELETE CASCADE
                )
                """
            )


            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_characters_owner_user_id
                ON characters (
                    owner_user_id
                )
                """
            )


            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_characters_owner_name
                ON characters (
                    owner_user_id,
                    name
                )
                """
            )


            connection.commit()


    # =====================================================
    # CREATE / UPDATE
    # =====================================================

    async def save(
        self,
        character: Character,
    ) -> None:

        await asyncio.to_thread(
            self._save_sync,
            character,
        )


    def _save_sync(
        self,
        character: Character,
    ) -> None:

        payload = json.dumps(
            character.to_dict()
        )


        with self._connect() as connection:

            connection.execute(
                """
                INSERT INTO characters (
                    character_id,
                    owner_user_id,
                    name,
                    schema_version,
                    payload,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)

                ON CONFLICT(character_id)
                DO UPDATE SET
                    owner_user_id =
                        excluded.owner_user_id,

                    name =
                        excluded.name,

                    schema_version =
                        excluded.schema_version,

                    payload =
                        excluded.payload,

                    updated_at =
                        excluded.updated_at
                """,
                (
                    character.character_id,

                    character.owner_user_id,

                    character.name,

                    CHARACTER_SCHEMA_VERSION,

                    payload,

                    character.created_at.isoformat(),

                    character.updated_at.isoformat(),
                ),
            )


            connection.commit()


    # =====================================================
    # GET BY ID
    # =====================================================

    async def get_by_id(
        self,
        character_id: str,
    ) -> Character | None:

        return await asyncio.to_thread(
            self._get_by_id_sync,
            character_id,
        )


    def _get_by_id_sync(
        self,
        character_id: str,
    ) -> Character | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT payload
                FROM characters
                WHERE character_id = ?
                LIMIT 1
                """,
                (
                    character_id,
                ),
            ).fetchone()


        if row is None:

            return None


        return self._decode_character(
            row[
                "payload"
            ]
        )


    # =====================================================
    # GET USER CHARACTERS
    # =====================================================

    async def list_for_user(
        self,
        user_id: str,
    ) -> list[Character]:

        return await asyncio.to_thread(
            self._list_for_user_sync,
            user_id,
        )


    def _list_for_user_sync(
        self,
        user_id: str,
    ) -> list[Character]:

        with self._connect() as connection:

            rows = connection.execute(
                """
                SELECT payload
                FROM characters
                WHERE owner_user_id = ?
                ORDER BY created_at ASC
                """,
                (
                    user_id,
                ),
            ).fetchall()


        characters: list[
            Character
        ] = []


        for row in rows:

            character = (
                self._decode_character(
                    row[
                        "payload"
                    ]
                )
            )


            if character is not None:

                characters.append(
                    character
                )


        return characters


    # =====================================================
    # NAME LOOKUP
    # =====================================================

    async def get_by_name_for_user(
        self,
        user_id: str,
        name: str,
    ) -> Character | None:

        return await asyncio.to_thread(
            self._get_by_name_for_user_sync,
            user_id,
            name,
        )


    def _get_by_name_for_user_sync(
        self,
        user_id: str,
        name: str,
    ) -> Character | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT payload
                FROM characters
                WHERE
                    owner_user_id = ?
                    AND name = ?
                        COLLATE NOCASE
                LIMIT 1
                """,
                (
                    user_id,
                    name,
                ),
            ).fetchone()


        if row is None:

            return None


        return self._decode_character(
            row[
                "payload"
            ]
        )


    # =====================================================
    # DELETE
    # =====================================================

    async def delete(
        self,
        character_id: str,
        owner_user_id: str,
    ) -> bool:

        return await asyncio.to_thread(
            self._delete_sync,
            character_id,
            owner_user_id,
        )


    def _delete_sync(
        self,
        character_id: str,
        owner_user_id: str,
    ) -> bool:

        with self._connect() as connection:

            cursor = connection.execute(
                """
                DELETE FROM characters
                WHERE
                    character_id = ?
                    AND owner_user_id = ?
                """,
                (
                    character_id,
                    owner_user_id,
                ),
            )


            deleted = (
                cursor.rowcount
                > 0
            )


            connection.commit()


        return deleted


    # =====================================================
    # DECODING
    # =====================================================

    @staticmethod
    def _decode_character(
        payload: str,
    ) -> Character | None:

        try:

            data = json.loads(
                payload
            )


            if not isinstance(
                data,
                dict,
            ):

                return None


            return Character.from_dict(
                data
            )


        except (
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ):

            return None


character_store = SQLiteCharacterStore()