from __future__ import annotations

import asyncio
import sqlite3
import tempfile
import unittest

from pathlib import Path

from app.auth.models import (
    StoredUser,
)

from app.auth.store import (
    SQLiteAuthStore,
)

from app.auth.sessions import (
    utc_now,
)


class AuthPermissionStoreTests(
    unittest.TestCase
):

    def run_async(
        self,
        coroutine,
    ):

        return asyncio.run(
            coroutine
        )


    def test_permission_survives_user_reload(
        self,
    ) -> None:

        with tempfile.TemporaryDirectory() as temp:

            db_path = (
                Path(temp)
                / "auth.sqlite3"
            )


            store = SQLiteAuthStore(
                db_path
            )


            self.run_async(
                store.initialize()
            )


            user = StoredUser(
                user_id=
                    "user-1",

                email=
                    "one@example.com",

                username=
                    "ONE",

                password_hash=
                    "hash",

                created_at=
                    utc_now(),

                is_active=
                    True,
            )


            self.run_async(
                store.create_user(
                    user
                )
            )


            self.run_async(
                store.grant_permission(
                    "user-1",
                    "author",
                )
            )


            loaded = self.run_async(
                store.get_user_by_id(
                    "user-1"
                )
            )


            self.assertIsNotNone(
                loaded
            )


            self.assertIn(
                "author",
                loaded.permissions,
            )


            self.assertTrue(
                loaded
                .to_user()
                .has_permission(
                    "author"
                )
            )


    def test_existing_author_document_bootstraps_author_permission(
        self,
    ) -> None:

        with tempfile.TemporaryDirectory() as temp:

            db_path = (
                Path(temp)
                / "auth.sqlite3"
            )


            store = SQLiteAuthStore(
                db_path
            )


            self.run_async(
                store.initialize()
            )


            user = StoredUser(
                user_id=
                    "legacy-author",

                email=
                    "author@example.com",

                username=
                    "AUTHOR",

                password_hash=
                    "hash",

                created_at=
                    utc_now(),

                is_active=
                    True,
            )


            self.run_async(
                store.create_user(
                    user
                )
            )


            with sqlite3.connect(
                db_path
            ) as connection:

                connection.execute(
                    """
                    CREATE TABLE author_documents (
                        document_id TEXT PRIMARY KEY,
                        slug TEXT NOT NULL UNIQUE,
                        title TEXT NOT NULL,
                        created_by_user_id TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )


                connection.execute(
                    """
                    INSERT INTO author_documents (
                        document_id,
                        slug,
                        title,
                        created_by_user_id,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "doc-1",
                        "legacy",
                        "Legacy",
                        "legacy-author",
                        utc_now().isoformat(),
                        utc_now().isoformat(),
                    ),
                )


                connection.commit()


            # Re-running initialize performs the compatibility migration.
            self.run_async(
                store.initialize()
            )


            loaded = self.run_async(
                store.get_user_by_id(
                    "legacy-author"
                )
            )


            self.assertIn(
                "author",
                loaded.permissions,
            )


            self.assertIn(
                "publish",
                loaded.permissions,
            )


if __name__ == "__main__":

    unittest.main()
