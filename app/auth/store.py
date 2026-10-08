from __future__ import annotations

import asyncio
import hashlib
import json

from datetime import datetime
from pathlib import Path

from app.database import (
    DatabaseConnection,
    DatabaseRow,
    connect_database,
)

from app.auth.models import (
    AuthSession,
    StoredUser,
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


def _coerce_datetime(
    value: str | datetime,
) -> datetime:
    """Return a datetime from either SQLite text or a PostgreSQL datetime.

    SQLite stores the auth timestamps as ISO-8601 text. PostgreSQL/psycopg may
    return an already-decoded ``datetime`` for an equivalent timestamp column
    (including databases created by an earlier schema revision). The auth store
    must accept both representations so reads remain portable across engines.
    """

    if isinstance(value, datetime):
        return value

    return datetime.fromisoformat(
        str(value)
    )


# =========================================================
# AUTH STORE
# =========================================================

class SQLiteAuthStore:

    def __init__(
        self,
        database_path: Path = DATABASE_PATH,
    ) -> None:

        self.database_path = (
            database_path
        )

    # -----------------------------------------------------
    # CONNECTION
    # -----------------------------------------------------

    def _connect(
        self,
    ) -> DatabaseConnection:

        return connect_database(
            self.database_path
        )

    # -----------------------------------------------------
    # INITIALIZATION
    # -----------------------------------------------------

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
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,

                    email TEXT NOT NULL
                        COLLATE NOCASE
                        UNIQUE,

                    username TEXT NOT NULL
                        COLLATE NOCASE
                        UNIQUE,

                    password_hash TEXT NOT NULL,

                    created_at TEXT NOT NULL,

                    is_active INTEGER NOT NULL
                        DEFAULT 1
                )
                """
            )

            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS user_permissions (
                    user_id TEXT NOT NULL,
                    permission TEXT NOT NULL,
                    granted_at TEXT NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,

                    PRIMARY KEY (
                        user_id,
                        permission
                    ),

                    FOREIGN KEY (
                        user_id
                    )
                    REFERENCES users (
                        user_id
                    )
                    ON DELETE CASCADE
                )
                """
            )


            # Preserve access for users who already authored content before
            # permissions became first-class account data.
            author_table_exists = (
                connection.execute(
                    """
                    SELECT 1
                    FROM sqlite_master
                    WHERE type = 'table'
                      AND name = 'author_documents'
                    LIMIT 1
                    """
                )
                .fetchone()
                is not None
            )


            if author_table_exists:

                legacy_author_rows = (
                    connection.execute(
                        """
                        SELECT DISTINCT
                            author_documents.created_by_user_id
                        FROM author_documents
                        INNER JOIN users
                            ON users.user_id = author_documents.created_by_user_id
                        """
                    )
                    .fetchall()
                )


                for row in legacy_author_rows:

                    user_id = str(
                        row[
                            "created_by_user_id"
                        ]
                    )


                    connection.execute(
                        """
                        INSERT OR IGNORE
                        INTO user_permissions (
                            user_id,
                            permission
                        )
                        VALUES (?, 'author')
                        """,
                        (
                            user_id,
                        ),
                    )


                    connection.execute(
                        """
                        INSERT OR IGNORE
                        INTO user_permissions (
                            user_id,
                            permission
                        )
                        VALUES (?, 'publish')
                        """,
                        (
                            user_id,
                        ),
                    )


            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    session_id TEXT PRIMARY KEY,

                    user_id TEXT NOT NULL,

                    token_hash TEXT NOT NULL
                        UNIQUE,

                    created_at TEXT NOT NULL,

                    expires_at TEXT NOT NULL,

                    last_seen_at TEXT NOT NULL,

                    FOREIGN KEY (
                        user_id
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
                    idx_auth_sessions_user_id
                ON auth_sessions (
                    user_id
                )
                """
            )

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_auth_sessions_token_hash
                ON auth_sessions (
                    token_hash
                )
                """
            )

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_auth_sessions_expires_at
                ON auth_sessions (
                    expires_at
                )
                """
            )

            connection.commit()

    # =====================================================
    # USER — CREATE
    # =====================================================

    async def create_user(
        self,
        user: StoredUser,
    ) -> None:

        await asyncio.to_thread(
            self._create_user_sync,
            user,
        )

    def _create_user_sync(
        self,
        user: StoredUser,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                INSERT INTO users (
                    user_id,
                    email,
                    username,
                    password_hash,
                    created_at,
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user.user_id,
                    user.email,
                    user.username,
                    user.password_hash,
                    user.created_at.isoformat(),
                    1
                    if user.is_active
                    else 0,
                ),
            )

            connection.commit()

    # =====================================================
    # USER — LOOKUP
    # =====================================================

    async def get_user_by_id(
        self,
        user_id: str,
    ) -> StoredUser | None:

        return await asyncio.to_thread(
            self._get_user_by_id_sync,
            user_id,
        )

    def _get_user_by_id_sync(
        self,
        user_id: str,
    ) -> StoredUser | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active,
                    GROUP_CONCAT(
                        user_permissions.permission,
                        ','
                    ) AS permissions
                FROM users
                LEFT JOIN user_permissions
                    ON user_permissions.user_id
                    = users.user_id
                WHERE users.user_id = ?
                GROUP BY
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active
                LIMIT 1
                """,
                (
                    user_id,
                ),
            ).fetchone()

        return self._row_to_user(
            row
        )

    async def get_user_by_email(
        self,
        email: str,
    ) -> StoredUser | None:

        return await asyncio.to_thread(
            self._get_user_by_email_sync,
            email,
        )

    def _get_user_by_email_sync(
        self,
        email: str,
    ) -> StoredUser | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active,
                    GROUP_CONCAT(
                        user_permissions.permission,
                        ','
                    ) AS permissions
                FROM users
                LEFT JOIN user_permissions
                    ON user_permissions.user_id
                    = users.user_id
                WHERE users.email = ?
                COLLATE NOCASE
                GROUP BY
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active
                LIMIT 1
                """,
                (
                    email,
                ),
            ).fetchone()

        return self._row_to_user(
            row
        )

    async def get_user_by_username(
        self,
        username: str,
    ) -> StoredUser | None:

        return await asyncio.to_thread(
            self._get_user_by_username_sync,
            username,
        )

    def _get_user_by_username_sync(
        self,
        username: str,
    ) -> StoredUser | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active,
                    GROUP_CONCAT(
                        user_permissions.permission,
                        ','
                    ) AS permissions
                FROM users
                LEFT JOIN user_permissions
                    ON user_permissions.user_id
                    = users.user_id
                WHERE users.username = ?
                COLLATE NOCASE
                GROUP BY
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active
                LIMIT 1
                """,
                (
                    username,
                ),
            ).fetchone()

        return self._row_to_user(
            row
        )

    async def get_user_by_identifier(
        self,
        identifier: str,
    ) -> StoredUser | None:

        user = await self.get_user_by_email(
            identifier
        )

        if user is not None:
            return user

        return await self.get_user_by_username(
            identifier
        )

    # =====================================================
    # USER — PERMISSIONS
    # =====================================================

    async def get_user_permissions(
        self,
        user_id: str,
    ) -> tuple[str, ...]:

        return await asyncio.to_thread(
            self._get_user_permissions_sync,
            user_id,
        )


    def _get_user_permissions_sync(
        self,
        user_id: str,
    ) -> tuple[str, ...]:

        with self._connect() as connection:

            rows = connection.execute(
                """
                SELECT permission
                FROM user_permissions
                WHERE user_id = ?
                ORDER BY permission
                """,
                (
                    user_id,
                ),
            ).fetchall()


        return tuple(
            str(
                row[
                    "permission"
                ]
            )

            for row
            in rows
        )


    async def grant_permission(
        self,
        user_id: str,
        permission: str,
    ) -> None:

        await asyncio.to_thread(
            self._grant_permission_sync,
            user_id,
            permission,
        )


    def _grant_permission_sync(
        self,
        user_id: str,
        permission: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                INSERT OR IGNORE
                INTO user_permissions (
                    user_id,
                    permission
                )
                VALUES (?, ?)
                """,
                (
                    user_id,
                    str(
                        permission
                    ).strip(),
                ),
            )


            connection.commit()


    async def grant_permission_by_username(
        self,
        username: str,
        permission: str,
    ) -> bool:

        return await asyncio.to_thread(
            self._grant_permission_by_username_sync,
            username,
            permission,
        )


    def _grant_permission_by_username_sync(
        self,
        username: str,
        permission: str,
    ) -> bool:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT user_id
                FROM users
                WHERE username = ?
                COLLATE NOCASE
                LIMIT 1
                """,
                (
                    username,
                ),
            ).fetchone()


            if row is None:

                return False


            connection.execute(
                """
                INSERT OR IGNORE
                INTO user_permissions (
                    user_id,
                    permission
                )
                VALUES (?, ?)
                """,
                (
                    str(
                        row[
                            "user_id"
                        ]
                    ),
                    str(
                        permission
                    ).strip(),
                ),
            )


            connection.commit()


        return True


    async def revoke_permission(
        self,
        user_id: str,
        permission: str,
    ) -> None:

        await asyncio.to_thread(
            self._revoke_permission_sync,
            user_id,
            permission,
        )


    def _revoke_permission_sync(
        self,
        user_id: str,
        permission: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                DELETE FROM user_permissions
                WHERE user_id = ? AND permission = ?
                """,
                (
                    user_id,
                    str(permission).strip(),
                ),
            )

            connection.commit()


    async def list_users(
        self,
        search: str = "",
        limit: int = 200,
    ) -> list[StoredUser]:

        return await asyncio.to_thread(
            self._list_users_sync,
            search,
            limit,
        )


    def _list_users_sync(
        self,
        search: str = "",
        limit: int = 200,
    ) -> list[StoredUser]:

        search_text = str(search or "").strip()
        safe_limit = max(1, min(int(limit), 500))
        like_value = f"%{search_text}%"

        with self._connect() as connection:

            rows = connection.execute(
                """
                SELECT
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active,
                    GROUP_CONCAT(
                        user_permissions.permission,
                        ','
                    ) AS permissions
                FROM users
                LEFT JOIN user_permissions
                    ON user_permissions.user_id = users.user_id
                WHERE
                    ? = ''
                    OR LOWER(users.username) LIKE LOWER(?)
                    OR LOWER(users.email) LIKE LOWER(?)
                GROUP BY
                    users.user_id,
                    users.email,
                    users.username,
                    users.password_hash,
                    users.created_at,
                    users.is_active
                ORDER BY LOWER(users.username)
                LIMIT ?
                """,
                (
                    search_text,
                    like_value,
                    like_value,
                    safe_limit,
                ),
            ).fetchall()

        return [
            user
            for row in rows
            if (user := self._row_to_user(row)) is not None
        ]


    # =====================================================
    # USER — PROFILE UPDATE
    # =====================================================

    async def update_user_identity(
        self,
        user_id: str,
        email: str,
        username: str,
    ) -> None:

        await asyncio.to_thread(
            self._update_user_identity_sync,
            user_id,
            email,
            username,
        )

    def _update_user_identity_sync(
        self,
        user_id: str,
        email: str,
        username: str,
    ) -> None:

        with self._connect() as connection:
            connection.execute(
                """
                UPDATE users
                SET email = ?, username = ?
                WHERE user_id = ?
                """,
                (email, username, user_id),
            )

            connection.commit()

    # =====================================================
    # USER — ACCOUNT DELETE
    # =====================================================

    @staticmethod
    def _table_exists(
        connection: DatabaseConnection,
        table_name: str,
    ) -> bool:

        rows = connection.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()

        return bool(rows)

    async def delete_user_account(
        self,
        user_id: str,
    ) -> None:

        await asyncio.to_thread(
            self._delete_user_account_sync,
            user_id,
        )

    def _delete_user_account_sync(
        self,
        user_id: str,
    ) -> None:

        # Published author content and generated adventures may be shared by
        # other players. Preserve those artifacts while removing the account's
        # identity from their attribution metadata.
        tombstone = (
            "deleted:"
            + hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]
        )

        with self._connect() as connection:
            for table_name in (
                "author_documents",
                "author_versions",
                "generated_adventures",
            ):
                if not self._table_exists(connection, table_name):
                    continue

                connection.execute(
                    f"UPDATE {table_name} "
                    "SET created_by_user_id = ? "
                    "WHERE created_by_user_id = ?",
                    (tombstone, user_id),
                )

            if self._table_exists(connection, "adventure_history_players"):
                connection.execute(
                    "DELETE FROM adventure_history_players WHERE user_id = ?",
                    (user_id,),
                )

            # Active room snapshots are transient gameplay state and can contain
            # player names/Hero IDs. Remove any room that still references the
            # deleted account instead of leaving personal data in a JSON blob.
            if self._table_exists(connection, "room_snapshots"):
                rows = connection.execute(
                    "SELECT room_code, payload FROM room_snapshots"
                ).fetchall()

                room_codes_to_delete: list[str] = []

                for row in rows:
                    try:
                        payload = json.loads(str(row["payload"]))
                    except (TypeError, json.JSONDecodeError):
                        continue

                    players = (
                        payload.get("room", {}).get("players", [])
                        if isinstance(payload, dict)
                        else []
                    )

                    if any(
                        isinstance(player, dict)
                        and str(player.get("user_id", "")) == user_id
                        for player in players
                    ):
                        room_codes_to_delete.append(str(row["room_code"]))

                for room_code in room_codes_to_delete:
                    connection.execute(
                        "DELETE FROM room_snapshots WHERE room_code = ?",
                        (room_code,),
                    )

                    if self._table_exists(connection, "chat_messages"):
                        connection.execute(
                            "DELETE FROM chat_messages WHERE room_code = ?",
                            (room_code,),
                        )

            # FK cascades remove sessions, permissions, notification records,
            # phone verifications, push subscriptions and owned Heroes.
            connection.execute(
                "DELETE FROM users WHERE user_id = ?",
                (user_id,),
            )

            connection.commit()

    # =====================================================
    # USER — PASSWORD UPDATE
    # =====================================================

    async def update_password_hash(
        self,
        user_id: str,
        password_hash: str,
    ) -> None:

        await asyncio.to_thread(
            self._update_password_hash_sync,
            user_id,
            password_hash,
        )

    def _update_password_hash_sync(
        self,
        user_id: str,
        password_hash: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                UPDATE users
                SET password_hash = ?
                WHERE user_id = ?
                """,
                (
                    password_hash,
                    user_id,
                ),
            )

            connection.commit()

    # =====================================================
    # USER — ACTIVE STATE
    # =====================================================

    async def set_user_active(
        self,
        user_id: str,
        is_active: bool,
    ) -> None:

        await asyncio.to_thread(
            self._set_user_active_sync,
            user_id,
            is_active,
        )

    def _set_user_active_sync(
        self,
        user_id: str,
        is_active: bool,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                UPDATE users
                SET is_active = ?
                WHERE user_id = ?
                """,
                (
                    1
                    if is_active
                    else 0,
                    user_id,
                ),
            )

            connection.commit()

    # =====================================================
    # SESSION — CREATE
    # =====================================================

    async def create_session(
        self,
        session: AuthSession,
    ) -> None:

        await asyncio.to_thread(
            self._create_session_sync,
            session,
        )

    def _create_session_sync(
        self,
        session: AuthSession,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                INSERT INTO auth_sessions (
                    session_id,
                    user_id,
                    token_hash,
                    created_at,
                    expires_at,
                    last_seen_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session.session_id,
                    session.user_id,
                    session.token_hash,
                    session.created_at.isoformat(),
                    session.expires_at.isoformat(),
                    session.last_seen_at.isoformat(),
                ),
            )

            connection.commit()

    # =====================================================
    # SESSION — LOOKUP
    # =====================================================

    async def get_session_by_token_hash(
        self,
        token_hash: str,
    ) -> AuthSession | None:

        return await asyncio.to_thread(
            self._get_session_by_token_hash_sync,
            token_hash,
        )

    def _get_session_by_token_hash_sync(
        self,
        token_hash: str,
    ) -> AuthSession | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT
                    session_id,
                    user_id,
                    token_hash,
                    created_at,
                    expires_at,
                    last_seen_at
                FROM auth_sessions
                WHERE token_hash = ?
                LIMIT 1
                """,
                (
                    token_hash,
                ),
            ).fetchone()

        return self._row_to_session(
            row
        )

    async def get_session_by_id(
        self,
        session_id: str,
    ) -> AuthSession | None:

        return await asyncio.to_thread(
            self._get_session_by_id_sync,
            session_id,
        )

    def _get_session_by_id_sync(
        self,
        session_id: str,
    ) -> AuthSession | None:

        with self._connect() as connection:

            row = connection.execute(
                """
                SELECT
                    session_id,
                    user_id,
                    token_hash,
                    created_at,
                    expires_at,
                    last_seen_at
                FROM auth_sessions
                WHERE session_id = ?
                LIMIT 1
                """,
                (
                    session_id,
                ),
            ).fetchone()

        return self._row_to_session(
            row
        )

    # =====================================================
    # SESSION — TOUCH
    # =====================================================

    async def update_session_last_seen(
        self,
        session_id: str,
        last_seen_at: datetime,
    ) -> None:

        await asyncio.to_thread(
            self._update_session_last_seen_sync,
            session_id,
            last_seen_at,
        )

    def _update_session_last_seen_sync(
        self,
        session_id: str,
        last_seen_at: datetime,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                UPDATE auth_sessions
                SET last_seen_at = ?
                WHERE session_id = ?
                """,
                (
                    last_seen_at.isoformat(),
                    session_id,
                ),
            )

            connection.commit()

    # =====================================================
    # SESSION — DELETE
    # =====================================================

    async def delete_session(
        self,
        session_id: str,
    ) -> None:

        await asyncio.to_thread(
            self._delete_session_sync,
            session_id,
        )

    def _delete_session_sync(
        self,
        session_id: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                DELETE FROM auth_sessions
                WHERE session_id = ?
                """,
                (
                    session_id,
                ),
            )

            connection.commit()

    async def delete_session_by_token_hash(
        self,
        token_hash: str,
    ) -> None:

        await asyncio.to_thread(
            self._delete_session_by_token_hash_sync,
            token_hash,
        )

    def _delete_session_by_token_hash_sync(
        self,
        token_hash: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                DELETE FROM auth_sessions
                WHERE token_hash = ?
                """,
                (
                    token_hash,
                ),
            )

            connection.commit()

    async def delete_user_sessions(
        self,
        user_id: str,
    ) -> None:

        await asyncio.to_thread(
            self._delete_user_sessions_sync,
            user_id,
        )

    def _delete_user_sessions_sync(
        self,
        user_id: str,
    ) -> None:

        with self._connect() as connection:

            connection.execute(
                """
                DELETE FROM auth_sessions
                WHERE user_id = ?
                """,
                (
                    user_id,
                ),
            )

            connection.commit()

    async def list_user_sessions(
        self,
        user_id: str,
    ) -> list[AuthSession]:

        return await asyncio.to_thread(
            self._list_user_sessions_sync,
            user_id,
        )

    def _list_user_sessions_sync(
        self,
        user_id: str,
    ) -> list[AuthSession]:

        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    session_id, user_id, token_hash,
                    created_at, expires_at, last_seen_at
                FROM auth_sessions
                WHERE user_id = ?
                ORDER BY last_seen_at DESC
                """,
                (user_id,),
            ).fetchall()

        sessions: list[AuthSession] = []

        for row in rows:
            session = self._row_to_session(row)
            if session is not None:
                sessions.append(session)

        return sessions

    async def delete_user_sessions_except(
        self,
        user_id: str,
        session_id: str,
    ) -> int:

        return await asyncio.to_thread(
            self._delete_user_sessions_except_sync,
            user_id,
            session_id,
        )

    def _delete_user_sessions_except_sync(
        self,
        user_id: str,
        session_id: str,
    ) -> int:

        with self._connect() as connection:
            cursor = connection.execute(
                """
                DELETE FROM auth_sessions
                WHERE user_id = ?
                  AND session_id <> ?
                """,
                (user_id, session_id),
            )

            connection.commit()
            return int(getattr(cursor, "rowcount", 0) or 0)

    # =====================================================
    # SESSION — CLEANUP
    # =====================================================

    async def purge_expired_sessions(
        self,
        now: datetime,
    ) -> int:

        return await asyncio.to_thread(
            self._purge_expired_sessions_sync,
            now,
        )

    def _purge_expired_sessions_sync(
        self,
        now: datetime,
    ) -> int:

        with self._connect() as connection:

            cursor = connection.execute(
                """
                DELETE FROM auth_sessions
                WHERE expires_at <= ?
                """,
                (
                    now.isoformat(),
                ),
            )

            deleted_count = (
                cursor.rowcount
                if cursor.rowcount is not None
                else 0
            )

            connection.commit()

        return deleted_count

    # =====================================================
    # ROW CONVERSION
    # =====================================================

    @staticmethod
    def _row_to_user(
        row: DatabaseRow | None,
    ) -> StoredUser | None:

        if row is None:
            return None

        return StoredUser(
            user_id=str(
                row["user_id"]
            ),

            email=str(
                row["email"]
            ),

            username=str(
                row["username"]
            ),

            password_hash=str(
                row["password_hash"]
            ),

            created_at=_coerce_datetime(
                row["created_at"]
            ),

            is_active=bool(
                row["is_active"]
            ),

            permissions=tuple(
                permission

                for permission
                in str(
                    row[
                        "permissions"
                    ]
                    or ""
                ).split(",")

                if permission
            ),
        )

    @staticmethod
    def _row_to_session(
        row: DatabaseRow | None,
    ) -> AuthSession | None:

        if row is None:
            return None

        return AuthSession(
            session_id=str(
                row["session_id"]
            ),

            user_id=str(
                row["user_id"]
            ),

            token_hash=str(
                row["token_hash"]
            ),

            created_at=_coerce_datetime(
                row["created_at"]
            ),

            expires_at=_coerce_datetime(
                row["expires_at"]
            ),

            last_seen_at=_coerce_datetime(
                row["last_seen_at"]
            ),
        )


auth_store = SQLiteAuthStore()