from __future__ import annotations

import asyncio
import json

from contextlib import contextmanager
from datetime import (
    datetime,
    timezone,
)

from pathlib import Path
from typing import Any
from uuid import uuid4

from app.database import (
    DatabaseConnection,
    DatabaseIntegrityError,
    DatabaseRow,
    connect_database,
)

from app.authoring.models import (
    AuthorDocumentSummary,
)

from app.authoring.service import (
    assess_document_strength,
    compile_source_document,
    default_source_document,
    normalize_document_kind,
    normalize_slug,
    normalize_source_document,
)


DEFAULT_DB_PATH = (
    Path(__file__)
    .resolve()
    .parents[2]
    / "data"
    / "game_state.sqlite3"
)


class AuthoringConflictError(
    RuntimeError
):
    pass


def _utc_now(
) -> datetime:

    return datetime.now(
        timezone.utc
    )


def _parse_datetime(
    value: str,
) -> datetime:

    return datetime.fromisoformat(
        value
    )


class AuthoringStore:

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


    async def user_has_authored_documents(
        self,
        user_id: str,
    ) -> bool:

        return await asyncio.to_thread(
            self._user_has_authored_documents_sync,
            str(
                user_id
            ),
        )


    def _user_has_authored_documents_sync(
        self,
        user_id: str,
    ) -> bool:

        with self._connection() as connection:

            row = connection.execute(
                """
                SELECT 1
                FROM author_documents
                WHERE created_by_user_id = ?
                LIMIT 1
                """,
                (
                    user_id,
                ),
            ).fetchone()


        return row is not None


    @staticmethod
    def _column_names(
        connection: DatabaseConnection,
        table_name: str,
    ) -> set[str]:

        rows = connection.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()


        return {
            str(
                row[
                    "name"
                ]
            )

            for row
            in rows
        }


    def _initialize_sync(
        self,
    ) -> None:

        with self._connection() as connection:

            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS author_documents (
                    document_id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    created_by_user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS author_versions (
                    version_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    version_number INTEGER NOT NULL,
                    status TEXT NOT NULL
                        CHECK (
                            status IN (
                                'draft',
                                'published',
                                'retired'
                            )
                        ),
                    source_json TEXT NOT NULL,
                    compiled_json TEXT NOT NULL,
                    strength_json TEXT NOT NULL,
                    created_by_user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    published_at TEXT,
                    FOREIGN KEY (
                        document_id
                    )
                    REFERENCES author_documents(
                        document_id
                    )
                    ON DELETE CASCADE,
                    UNIQUE (
                        document_id,
                        version_number
                    )
                );
                """
            )


            columns = (
                self._column_names(
                    connection,
                    "author_documents",
                )
            )


            if (
                "document_kind"
                not in columns
            ):

                connection.execute(
                    """
                    ALTER TABLE author_documents
                    ADD COLUMN document_kind TEXT
                    NOT NULL DEFAULT 'world'
                    """
                )


            if (
                "parent_document_id"
                not in columns
            ):

                connection.execute(
                    """
                    ALTER TABLE author_documents
                    ADD COLUMN parent_document_id TEXT
                    """
                )


            if (
                "is_archived"
                not in columns
            ):

                connection.execute(
                    """
                    ALTER TABLE author_documents
                    ADD COLUMN is_archived INTEGER
                    NOT NULL DEFAULT 0
                    """
                )


            connection.executescript(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_author_versions_document
                ON author_versions(
                    document_id,
                    version_number DESC
                );

                CREATE INDEX IF NOT EXISTS
                    idx_author_versions_status
                ON author_versions(
                    status
                );

                CREATE INDEX IF NOT EXISTS
                    idx_author_documents_kind
                ON author_documents(
                    document_kind
                );

                CREATE INDEX IF NOT EXISTS
                    idx_author_documents_parent
                ON author_documents(
                    parent_document_id
                );

                CREATE INDEX IF NOT EXISTS
                    idx_author_documents_archived
                ON author_documents(
                    is_archived
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
    def _version_from_row(
        cls,
        row: DatabaseRow,
    ) -> dict[str, Any]:
        keys = set(row.keys())
        document_kind = (
            row["document_kind"]
            if "document_kind" in keys
            else None
        )
        raw_source = cls._json_load(row["source_json"])
        source = normalize_source_document(
            raw_source,
            document_kind=document_kind,
        )

        # Old persisted v2 rows are projected into schema v3 at read time. The
        # database row is only rewritten when an author saves/creates a version,
        # keeping published historical rows immutable while making them usable in
        # the new editor and generation pipeline immediately.
        result = {
            "version_id": row["version_id"],
            "document_id": row["document_id"],
            "version_number": int(row["version_number"]),
            "status": row["status"],
            "source": source,
            "compiled": compile_source_document(source),
            "strength": assess_document_strength(source),
            "created_by_user_id": row["created_by_user_id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "published_at": row["published_at"],
        }

        for key in (
            "document_kind",
            "parent_document_id",
            "parent_title",
            "is_archived",
            "document_title",
            "document_slug",
        ):
            if key in keys:
                value = row[key]
                if key == "is_archived":
                    value = bool(value)
                result[key] = value

        return result


    def _version_select_sql(
        self,
    ) -> str:

        return """
            SELECT
                v.*,
                d.document_kind
                    AS document_kind,
                d.parent_document_id
                    AS parent_document_id,
                parent.title
                    AS parent_title,
                d.is_archived
                    AS is_archived,
                d.title
                    AS document_title,
                d.slug
                    AS document_slug
            FROM author_versions v
            JOIN author_documents d
                ON d.document_id =
                    v.document_id
            LEFT JOIN author_documents parent
                ON parent.document_id =
                    d.parent_document_id
        """


    async def list_documents(
        self,
        *,
        include_archived: bool = False,
    ) -> list[dict[str, Any]]:

        return await asyncio.to_thread(
            self._list_documents_sync,
            include_archived,
        )


    def _list_documents_sync(
        self,
        include_archived: bool,
    ) -> list[dict[str, Any]]:

        archived_clause = (
            ""
            if include_archived
            else
            "WHERE d.is_archived = 0"
        )


        query = f"""
            SELECT
                d.document_id,
                d.slug,
                d.title,
                d.document_kind,
                d.parent_document_id,
                parent.title
                    AS parent_title,
                d.is_archived,
                d.updated_at,
                v.version_number,
                v.status,
                v.strength_json,
                v.source_json,
                (
                    SELECT MAX(
                        published.version_number
                    )
                    FROM author_versions published
                    WHERE
                        published.document_id =
                            d.document_id
                        AND published.status =
                            'published'
                ) AS latest_published_version
            FROM author_documents d
            JOIN author_versions v
                ON v.document_id =
                    d.document_id
            LEFT JOIN author_documents parent
                ON parent.document_id =
                    d.parent_document_id
            {archived_clause}
            AND v.version_number = (
                SELECT MAX(
                    v2.version_number
                )
                FROM author_versions v2
                WHERE
                    v2.document_id =
                        d.document_id
            )
            ORDER BY
                d.updated_at DESC,
                d.title COLLATE NOCASE ASC
        """


        # When archived_clause is empty, the generated SQL would
        # begin with "AND". Give it a neutral WHERE.
        if not archived_clause:

            query = query.replace(
                "\n            AND v.version_number",
                "\n            WHERE v.version_number",
                1,
            )


        with self._connection() as connection:

            rows = connection.execute(
                query
            ).fetchall()


        results = []


        for row in rows:

            strength = assess_document_strength(
                normalize_source_document(
                    self._json_load(row["source_json"]),
                    document_kind=row["document_kind"],
                )
            )


            summary = (
                AuthorDocumentSummary(

                    document_id=
                        row[
                            "document_id"
                        ],

                    slug=
                        row[
                            "slug"
                        ],

                    title=
                        row[
                            "title"
                        ],

                    document_kind=
                        row[
                            "document_kind"
                        ],

                    parent_document_id=
                        row[
                            "parent_document_id"
                        ],

                    parent_title=
                        row[
                            "parent_title"
                        ],

                    latest_version=
                        int(
                            row[
                                "version_number"
                            ]
                        ),

                    latest_status=
                        row[
                            "status"
                        ],

                    latest_published_version=
                        (
                            int(
                                row[
                                    "latest_published_version"
                                ]
                            )
                            if row[
                                "latest_published_version"
                            ]
                            is not None
                            else None
                        ),

                    strength_score=
                        int(
                            strength[
                                "score"
                            ]
                        ),

                    strength_label=
                        strength[
                            "label"
                        ],

                    is_archived=
                        bool(
                            row[
                                "is_archived"
                            ]
                        ),

                    updated_at=
                        _parse_datetime(
                            row[
                                "updated_at"
                            ]
                        ),
                )
            )


            results.append(
                summary.public_data()
            )


        return results


    def _document_row_sync(
        self,
        document_id: str,
    ) -> DatabaseRow | None:

        with self._connection() as connection:

            return connection.execute(
                """
                SELECT
                    d.*,
                    parent.title
                        AS parent_title
                FROM author_documents d
                LEFT JOIN author_documents parent
                    ON parent.document_id =
                        d.parent_document_id
                WHERE
                    d.document_id = ?
                """,
                (
                    document_id,
                ),
            ).fetchone()


    async def create_document(
        self,
        *,
        title: str,
        slug: str,
        document_kind: str,
        parent_document_id: (
            str
            | None
        ),
        user_id: str,
    ) -> dict[str, Any]:

        return await asyncio.to_thread(
            self._create_document_sync,
            title,
            slug,
            document_kind,
            parent_document_id,
            user_id,
        )


    def _create_document_sync(
        self,
        title: str,
        slug: str,
        document_kind: str,
        parent_document_id: (
            str
            | None
        ),
        user_id: str,
    ) -> dict[str, Any]:

        title = str(
            title
        ).strip()


        if not title:

            raise ValueError(
                "Adventure title is required."
            )


        slug = normalize_slug(
            slug
        )


        document_kind = (
            normalize_document_kind(
                document_kind
            )
        )


        if (
            document_kind
            == "world"
        ):

            parent_document_id = (
                None
            )


        if (
            document_kind
            == "brief"
            and parent_document_id
        ):

            parent = (
                self._document_row_sync(
                    parent_document_id
                )
            )


            if parent is None:

                raise ValueError(
                    "Selected world does not exist."
                )


            if (
                parent[
                    "document_kind"
                ]
                != "world"
            ):

                raise ValueError(
                    "Adventure briefs can only be linked to worlds."
                )


        source = (
            default_source_document(
                title=
                    title,

                slug=
                    slug,

                document_kind=
                    document_kind,
            )
        )


        compiled = (
            compile_source_document(
                source
            )
        )


        strength = (
            assess_document_strength(
                source
            )
        )


        now = (
            _utc_now()
            .isoformat()
        )


        document_id = str(
            uuid4()
        )


        version_id = str(
            uuid4()
        )


        try:

            with self._connection() as connection:

                connection.execute(
                    """
                    INSERT INTO author_documents (
                        document_id,
                        slug,
                        title,
                        document_kind,
                        parent_document_id,
                        is_archived,
                        created_by_user_id,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, 0, ?, ?, ?
                    )
                    """,
                    (
                        document_id,
                        slug,
                        title,
                        document_kind,
                        parent_document_id,
                        user_id,
                        now,
                        now,
                    ),
                )


                connection.execute(
                    """
                    INSERT INTO author_versions (
                        version_id,
                        document_id,
                        version_number,
                        status,
                        source_json,
                        compiled_json,
                        strength_json,
                        created_by_user_id,
                        created_at,
                        updated_at,
                        published_at
                    )
                    VALUES (
                        ?, ?, 1, 'draft',
                        ?, ?, ?, ?, ?, ?, NULL
                    )
                    """,
                    (
                        version_id,
                        document_id,
                        self._json_dump(
                            source
                        ),
                        self._json_dump(
                            compiled
                        ),
                        self._json_dump(
                            strength
                        ),
                        user_id,
                        now,
                        now,
                    ),
                )

        except DatabaseIntegrityError as error:

            raise ValueError(
                "That adventure slug already exists."
            ) from error


        result = self._get_version_sync(
            document_id,
            1,
        )


        assert result is not None

        return result


    async def list_versions(
        self,
        document_id: str,
    ) -> list[dict[str, Any]]:

        return await asyncio.to_thread(
            self._list_versions_sync,
            document_id,
        )


    def _list_versions_sync(
        self,
        document_id: str,
    ) -> list[dict[str, Any]]:

        query = (
            self._version_select_sql()
            + """
            WHERE
                v.document_id = ?
            ORDER BY
                v.version_number DESC
            """
        )


        with self._connection() as connection:

            rows = connection.execute(
                query,
                (
                    document_id,
                ),
            ).fetchall()


        return [
            self._version_from_row(
                row
            )

            for row
            in rows
        ]


    async def get_version(
        self,
        document_id: str,
        version_number: int,
    ) -> dict[str, Any] | None:

        return await asyncio.to_thread(
            self._get_version_sync,
            document_id,
            version_number,
        )


    def _get_version_sync(
        self,
        document_id: str,
        version_number: int,
    ) -> dict[str, Any] | None:

        query = (
            self._version_select_sql()
            + """
            WHERE
                v.document_id = ?
                AND v.version_number = ?
            """
        )


        with self._connection() as connection:

            row = connection.execute(
                query,
                (
                    document_id,
                    version_number,
                ),
            ).fetchone()


        if row is None:

            return None


        return self._version_from_row(
            row
        )


    async def save_draft(
        self,
        *,
        document_id: str,
        version_number: int,
        source: dict[str, Any],
        expected_updated_at: (
            str
            | None
        ),
    ) -> dict[str, Any]:

        return await asyncio.to_thread(
            self._save_draft_sync,
            document_id,
            version_number,
            source,
            expected_updated_at,
        )


    def _save_draft_sync(
        self,
        document_id: str,
        version_number: int,
        source: dict[str, Any],
        expected_updated_at: (
            str
            | None
        ),
    ) -> dict[str, Any]:

        current = (
            self._get_version_sync(
                document_id,
                version_number,
            )
        )


        if current is None:

            raise LookupError(
                "Adventure version not found."
            )


        if (
            current[
                "status"
            ]
            != "draft"
        ):

            raise ValueError(
                "Published versions are immutable. "
                "Create a new draft version to edit."
            )


        document_kind = (
            normalize_document_kind(
                current.get(
                    "document_kind"
                )
                or "world"
            )
        )


        source = (
            normalize_source_document(
                source,
                document_kind=
                    document_kind,
            )
        )


        identity = (
            source[
                "identity"
            ]
        )


        title = str(
            identity.get(
                "title",
                "",
            )
        ).strip()


        if not title:

            raise ValueError(
                "Adventure title is required."
            )


        slug = normalize_slug(
            identity.get(
                "slug",
                "",
            )
        )


        identity[
            "title"
        ] = title

        identity[
            "slug"
        ] = slug

        identity[
            "document_kind"
        ] = document_kind


        compiled = (
            compile_source_document(
                source
            )
        )


        strength = (
            assess_document_strength(
                source
            )
        )


        now = (
            _utc_now()
            .isoformat()
        )


        compare_updated_at = (
            expected_updated_at
            or current[
                "updated_at"
            ]
        )


        try:

            with self._connection() as connection:

                cursor = (
                    connection.execute(
                        """
                        UPDATE author_versions
                        SET
                            source_json = ?,
                            compiled_json = ?,
                            strength_json = ?,
                            updated_at = ?
                        WHERE
                            document_id = ?
                            AND version_number = ?
                            AND status = 'draft'
                            AND updated_at = ?
                        """,
                        (
                            self._json_dump(
                                source
                            ),
                            self._json_dump(
                                compiled
                            ),
                            self._json_dump(
                                strength
                            ),
                            now,
                            document_id,
                            version_number,
                            compare_updated_at,
                        ),
                    )
                )


                if (
                    cursor.rowcount
                    != 1
                ):

                    raise (
                        AuthoringConflictError(
                            "This draft changed after you opened it. "
                            "Reload before saving so another author's "
                            "work is not overwritten."
                        )
                    )


                connection.execute(
                    """
                    UPDATE author_documents
                    SET
                        title = ?,
                        slug = ?,
                        updated_at = ?
                    WHERE document_id = ?
                    """,
                    (
                        title,
                        slug,
                        now,
                        document_id,
                    ),
                )

        except DatabaseIntegrityError as error:

            raise ValueError(
                "That adventure slug already exists."
            ) from error


        result = self._get_version_sync(
            document_id,
            version_number,
        )


        assert result is not None

        return result


    async def publish_version(
        self,
        *,
        document_id: str,
        version_number: int,
    ) -> dict[str, Any]:

        return await asyncio.to_thread(
            self._publish_version_sync,
            document_id,
            version_number,
        )


    def _publish_version_sync(
        self,
        document_id: str,
        version_number: int,
    ) -> dict[str, Any]:

        current = (
            self._get_version_sync(
                document_id,
                version_number,
            )
        )


        if current is None:

            raise LookupError(
                "Adventure version not found."
            )


        if (
            current[
                "status"
            ]
            != "draft"
        ):

            raise ValueError(
                "Only draft versions can be published."
            )


        now = (
            _utc_now()
            .isoformat()
        )


        with self._connection() as connection:

            connection.execute(
                """
                UPDATE author_versions
                SET
                    status = 'published',
                    published_at = ?,
                    updated_at = ?
                WHERE
                    document_id = ?
                    AND version_number = ?
                    AND status = 'draft'
                """,
                (
                    now,
                    now,
                    document_id,
                    version_number,
                ),
            )


            connection.execute(
                """
                UPDATE author_documents
                SET updated_at = ?
                WHERE document_id = ?
                """,
                (
                    now,
                    document_id,
                ),
            )


        result = self._get_version_sync(
            document_id,
            version_number,
        )


        assert result is not None

        return result


    async def create_new_version(
        self,
        *,
        document_id: str,
        user_id: str,
        base_version_number: (
            int
            | None
        ) = None,
    ) -> dict[str, Any]:

        return await asyncio.to_thread(
            self._create_new_version_sync,
            document_id,
            user_id,
            base_version_number,
        )


    def _create_new_version_sync(
        self,
        document_id: str,
        user_id: str,
        base_version_number: (
            int
            | None
        ),
    ) -> dict[str, Any]:

        with self._connection() as connection:

            existing_draft = (
                connection.execute(
                    """
                    SELECT *
                    FROM author_versions
                    WHERE
                        document_id = ?
                        AND status = 'draft'
                    ORDER BY
                        version_number DESC
                    LIMIT 1
                    """,
                    (
                        document_id,
                    ),
                )
                .fetchone()
            )


            if existing_draft is not None:

                raise ValueError(
                    "This source already has an editable draft."
                )


            latest_row = (
                connection.execute(
                    """
                    SELECT *
                    FROM author_versions
                    WHERE
                        document_id = ?
                    ORDER BY
                        version_number DESC
                    LIMIT 1
                    """,
                    (
                        document_id,
                    ),
                )
                .fetchone()
            )


            if latest_row is None:

                raise LookupError(
                    "Source document not found."
                )


            if (
                base_version_number
                is None
            ):

                base_row = latest_row

            else:

                base_row = (
                    connection.execute(
                        """
                        SELECT *
                        FROM author_versions
                        WHERE
                            document_id = ?
                            AND version_number = ?
                        """,
                        (
                            document_id,
                            base_version_number,
                        ),
                    )
                    .fetchone()
                )


                if base_row is None:

                    raise LookupError(
                        "Base source version not found."
                    )


            new_version_number = (
                int(
                    latest_row[
                        "version_number"
                    ]
                )
                + 1
            )


            document_row = (
                connection.execute(
                    """
                    SELECT document_kind
                    FROM author_documents
                    WHERE document_id = ?
                    """,
                    (document_id,),
                ).fetchone()
            )
            if document_row is None:
                raise LookupError("Source document not found.")

            # A new editable version is the migration boundary: legacy published
            # rows stay immutable, while the new draft is persisted immediately
            # in native schema v3 rather than carrying raw v2 JSON forward.
            migrated_source = normalize_source_document(
                self._json_load(base_row["source_json"]),
                document_kind=normalize_document_kind(
                    document_row["document_kind"]
                ),
            )
            migrated_compiled = compile_source_document(migrated_source)
            migrated_strength = assess_document_strength(migrated_source)


            now = (
                _utc_now()
                .isoformat()
            )


            version_id = str(
                uuid4()
            )


            connection.execute(
                """
                INSERT INTO author_versions (
                    version_id,
                    document_id,
                    version_number,
                    status,
                    source_json,
                    compiled_json,
                    strength_json,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    published_at
                )
                VALUES (
                    ?, ?, ?, 'draft',
                    ?, ?, ?, ?, ?, ?, NULL
                )
                """,
                (
                    version_id,
                    document_id,
                    new_version_number,
                    self._json_dump(migrated_source),
                    self._json_dump(migrated_compiled),
                    self._json_dump(migrated_strength),
                    user_id,
                    now,
                    now,
                ),
            )


            connection.execute(
                """
                UPDATE author_documents
                SET updated_at = ?
                WHERE document_id = ?
                """,
                (
                    now,
                    document_id,
                ),
            )


        result = self._get_version_sync(
            document_id,
            new_version_number,
        )


        assert result is not None

        return result


    async def archive_document(
        self,
        *,
        document_id: str,
        archived: bool,
    ) -> None:

        await asyncio.to_thread(
            self._archive_document_sync,
            document_id,
            archived,
        )


    def _archive_document_sync(
        self,
        document_id: str,
        archived: bool,
    ) -> None:

        now = (
            _utc_now()
            .isoformat()
        )


        with self._connection() as connection:

            cursor = connection.execute(
                """
                UPDATE author_documents
                SET
                    is_archived = ?,
                    updated_at = ?
                WHERE
                    document_id = ?
                """,
                (
                    1
                    if archived
                    else 0,
                    now,
                    document_id,
                ),
            )


            if (
                cursor.rowcount
                != 1
            ):

                raise LookupError(
                    "Source document not found."
                )


    async def duplicate_document(
        self,
        *,
        document_id: str,
        title: str,
        slug: str,
        user_id: str,
    ) -> dict[str, Any]:

        return await asyncio.to_thread(
            self._duplicate_document_sync,
            document_id,
            title,
            slug,
            user_id,
        )


    def _duplicate_document_sync(
        self,
        document_id: str,
        title: str,
        slug: str,
        user_id: str,
    ) -> dict[str, Any]:

        document = (
            self._document_row_sync(
                document_id
            )
        )


        if document is None:

            raise LookupError(
                "Source document not found."
            )


        latest_versions = (
            self._list_versions_sync(
                document_id
            )
        )


        if not latest_versions:

            raise LookupError(
                "Source document has no versions."
            )


        base = (
            latest_versions[
                0
            ]
        )


        title = str(
            title
        ).strip()


        if not title:

            raise ValueError(
                "Duplicate title is required."
            )


        slug = normalize_slug(
            slug
        )


        document_kind = (
            normalize_document_kind(
                document[
                    "document_kind"
                ]
            )
        )


        source = (
            normalize_source_document(
                base[
                    "source"
                ],
                document_kind=
                    document_kind,
            )
        )


        source[
            "identity"
        ][
            "title"
        ] = title

        source[
            "identity"
        ][
            "slug"
        ] = slug


        compiled = (
            compile_source_document(
                source
            )
        )


        strength = (
            assess_document_strength(
                source
            )
        )


        now = (
            _utc_now()
            .isoformat()
        )


        new_document_id = str(
            uuid4()
        )

        new_version_id = str(
            uuid4()
        )


        try:

            with self._connection() as connection:

                connection.execute(
                    """
                    INSERT INTO author_documents (
                        document_id,
                        slug,
                        title,
                        document_kind,
                        parent_document_id,
                        is_archived,
                        created_by_user_id,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, 0, ?, ?, ?
                    )
                    """,
                    (
                        new_document_id,
                        slug,
                        title,
                        document_kind,
                        document[
                            "parent_document_id"
                        ],
                        user_id,
                        now,
                        now,
                    ),
                )


                connection.execute(
                    """
                    INSERT INTO author_versions (
                        version_id,
                        document_id,
                        version_number,
                        status,
                        source_json,
                        compiled_json,
                        strength_json,
                        created_by_user_id,
                        created_at,
                        updated_at,
                        published_at
                    )
                    VALUES (
                        ?, ?, 1, 'draft',
                        ?, ?, ?, ?, ?, ?, NULL
                    )
                    """,
                    (
                        new_version_id,
                        new_document_id,
                        self._json_dump(
                            source
                        ),
                        self._json_dump(
                            compiled
                        ),
                        self._json_dump(
                            strength
                        ),
                        user_id,
                        now,
                        now,
                    ),
                )

        except DatabaseIntegrityError as error:

            raise ValueError(
                "That duplicate slug already exists."
            ) from error


        result = self._get_version_sync(
            new_document_id,
            1,
        )


        assert result is not None

        return result


authoring_store = (
    AuthoringStore()
)
