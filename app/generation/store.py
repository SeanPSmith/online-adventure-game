from __future__ import annotations

import asyncio
import json

from contextlib import (
    contextmanager,
)

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path
from typing import (
    Any,
)

from uuid import (
    uuid4,
)

from app.database import (
    DatabaseConnection,
    DatabaseRow,
    connect_database,
)

from app.generation.models import (
    GeneratedAdventure,
)


DEFAULT_DB_PATH = (
    Path(__file__)
    .resolve()
    .parents[2]
    / "data"
    / "game_state.sqlite3"
)


def _utc_now(
) -> datetime:

    return datetime.now(
        timezone.utc
    )


class GeneratedAdventureStore:

    def __init__(
        self,
        db_path: Path = DEFAULT_DB_PATH,
    ) -> None:

        self.db_path = Path(
            db_path
        )


    def _connect(
        self,
    ) -> DatabaseConnection:

        return connect_database(
            self.db_path,
            timeout=10.0,
        )


    @contextmanager
    def _connection(
        self,
    ):

        connection = (
            self._connect()
        )


        try:

            with connection:

                yield connection

        finally:

            connection.close()


    async def initialize(
        self,
    ) -> None:

        await asyncio.to_thread(
            self._initialize_sync
        )


    def _initialize_sync(
        self,
    ) -> None:

        with self._connection() as connection:

            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS generated_adventures (
                    generated_adventure_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL
                        CHECK (
                            status IN (
                                'generated',
                                'approved',
                                'rejected',
                                'retired'
                            )
                        ),
                    seed_json TEXT NOT NULL,
                    world_document_id TEXT NOT NULL,
                    world_version_number INTEGER NOT NULL,
                    brief_document_id TEXT NOT NULL,
                    brief_version_number INTEGER NOT NULL,
                    created_by_user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    approved_at TEXT
                );

                CREATE INDEX IF NOT EXISTS
                    idx_generated_adventures_status
                ON generated_adventures(
                    status
                );

                CREATE INDEX IF NOT EXISTS
                    idx_generated_adventures_sources
                ON generated_adventures(
                    world_document_id,
                    brief_document_id
                );
                """
            )


    @staticmethod
    def _json_dump(
        value: Any,
    ) -> str:

        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(
                ",",
                ":",
            ),
        )


    @staticmethod
    def _json_load(
        value: str,
    ) -> Any:

        return json.loads(
            value
        )


    @classmethod
    def _from_row(
        cls,
        row: DatabaseRow,
    ) -> GeneratedAdventure:

        return GeneratedAdventure(

            generated_adventure_id=
                row[
                    "generated_adventure_id"
                ],

            status=
                row[
                    "status"
                ],

            seed=
                cls._json_load(
                    row[
                        "seed_json"
                    ]
                ),

            world_document_id=
                row[
                    "world_document_id"
                ],

            world_version_number=
                int(
                    row[
                        "world_version_number"
                    ]
                ),

            brief_document_id=
                row[
                    "brief_document_id"
                ],

            brief_version_number=
                int(
                    row[
                        "brief_version_number"
                    ]
                ),

            created_by_user_id=
                row[
                    "created_by_user_id"
                ],

            created_at=
                row[
                    "created_at"
                ],

            updated_at=
                row[
                    "updated_at"
                ],

            approved_at=
                row[
                    "approved_at"
                ],
        )


    async def create(
        self,
        *,
        seed: dict[
            str,
            Any,
        ],
        world_document_id: str,
        world_version_number: int,
        brief_document_id: str,
        brief_version_number: int,
        created_by_user_id: str,
    ) -> dict[
        str,
        Any,
    ]:

        return (
            await asyncio.to_thread(
                self._create_sync,
                seed,
                world_document_id,
                world_version_number,
                brief_document_id,
                brief_version_number,
                created_by_user_id,
            )
        )


    def _create_sync(
        self,
        seed: dict[
            str,
            Any,
        ],
        world_document_id: str,
        world_version_number: int,
        brief_document_id: str,
        brief_version_number: int,
        created_by_user_id: str,
    ) -> dict[
        str,
        Any,
    ]:

        generated_id = str(
            uuid4()
        )


        now = (
            _utc_now()
            .isoformat()
        )


        with self._connection() as connection:

            connection.execute(
                """
                INSERT INTO generated_adventures (
                    generated_adventure_id,
                    status,
                    seed_json,
                    world_document_id,
                    world_version_number,
                    brief_document_id,
                    brief_version_number,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    approved_at
                )
                VALUES (
                    ?, 'generated', ?,
                    ?, ?, ?, ?, ?, ?, ?, NULL
                )
                """,
                (
                    generated_id,
                    self._json_dump(
                        seed
                    ),
                    world_document_id,
                    world_version_number,
                    brief_document_id,
                    brief_version_number,
                    created_by_user_id,
                    now,
                    now,
                ),
            )


        result = (
            self._get_sync(
                generated_id
            )
        )


        assert result is not None

        return result.public_data()


    async def get(
        self,
        generated_adventure_id: str,
    ) -> dict[
        str,
        Any,
    ] | None:

        result = (
            await asyncio.to_thread(
                self._get_sync,
                generated_adventure_id,
            )
        )


        return (
            result.public_data()
            if result
            else None
        )


    def _get_sync(
        self,
        generated_adventure_id: str,
    ) -> GeneratedAdventure | None:

        with self._connection() as connection:

            row = connection.execute(
                """
                SELECT *
                FROM generated_adventures
                WHERE
                    generated_adventure_id = ?
                """,
                (
                    generated_adventure_id,
                ),
            ).fetchone()


        if row is None:

            return None


        return self._from_row(
            row
        )


    async def list_all(
        self,
    ) -> list[
        dict[
            str,
            Any,
        ]
    ]:

        return await asyncio.to_thread(
            self._list_all_sync
        )


    def _list_all_sync(
        self,
    ) -> list[
        dict[
            str,
            Any,
        ]
    ]:

        with self._connection() as connection:

            rows = connection.execute(
                """
                SELECT *
                FROM generated_adventures
                ORDER BY
                    created_at DESC
                """
            ).fetchall()


        return [
            self._from_row(
                row
            ).public_data()

            for row
            in rows
        ]


    async def list_approved(
        self,
    ) -> list[
        dict[
            str,
            Any,
        ]
    ]:

        return await asyncio.to_thread(
            self._list_approved_sync
        )


    def _list_approved_sync(
        self,
    ) -> list[
        dict[
            str,
            Any,
        ]
    ]:

        with self._connection() as connection:

            rows = connection.execute(
                """
                SELECT *
                FROM generated_adventures
                WHERE
                    status = 'approved'
                ORDER BY
                    approved_at ASC,
                    created_at ASC
                """
            ).fetchall()


        return [
            self._from_row(
                row
            ).public_data()

            for row
            in rows
        ]


    async def set_status(
        self,
        *,
        generated_adventure_id: str,
        status: str,
    ) -> dict[
        str,
        Any,
    ]:

        return await asyncio.to_thread(
            self._set_status_sync,
            generated_adventure_id,
            status,
        )


    def _set_status_sync(
        self,
        generated_adventure_id: str,
        status: str,
    ) -> dict[
        str,
        Any,
    ]:

        if status not in {
            "generated",
            "approved",
            "rejected",
            "retired",
        }:

            raise ValueError(
                "Unknown generated adventure status."
            )


        current = (
            self._get_sync(
                generated_adventure_id
            )
        )


        if current is None:

            raise LookupError(
                "Generated adventure not found."
            )


        now = (
            _utc_now()
            .isoformat()
        )


        approved_at = (
            now
            if status
            == "approved"
            else current.approved_at
        )


        with self._connection() as connection:

            connection.execute(
                """
                UPDATE generated_adventures
                SET
                    status = ?,
                    updated_at = ?,
                    approved_at = ?
                WHERE
                    generated_adventure_id = ?
                """,
                (
                    status,
                    now,
                    approved_at,
                    generated_adventure_id,
                ),
            )


        result = (
            self._get_sync(
                generated_adventure_id
            )
        )


        assert result is not None

        return result.public_data()


generated_adventure_store = (
    GeneratedAdventureStore()
)
