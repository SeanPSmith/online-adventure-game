from __future__ import annotations

import tempfile
import unittest

from pathlib import Path

from app.authoring.service import (
    assess_document_strength,
    compile_source_document,
    default_source_document,
    normalize_slug,
    render_design_document,
)

from app.authoring.store import (
    AuthoringConflictError,
    AuthoringStore,
)


class AuthoringServiceTests(
    unittest.TestCase
):

    def test_blank_template_is_sparse(
        self,
    ) -> None:

        source = (
            default_source_document(
                title=
                    "Blank",

                slug=
                    "blank",
            )
        )


        strength = (
            assess_document_strength(
                source
            )
        )


        self.assertLess(
            strength[
                "score"
            ],
            40,
        )


    def test_rich_document_scores_higher(
        self,
    ) -> None:

        source = (
            default_source_document(
                title=
                    "The Old Chapel",

                slug=
                    "old_chapel",
            )
        )


        source[
            "identity"
        ][
            "one_sentence_pitch"
        ] = (
            "Two travelers investigate an abandoned "
            "chapel where the bell rings by itself."
        )


        source[
            "identity"
        ][
            "player_experience"
        ] = (
            "Curious first, threatened second, with "
            "room for humor and strange choices."
        )


        source[
            "premise"
        ] = (
            "The road ends beneath an old oak beside "
            "a chapel and weathered graveyard. "
            * 8
        )


        source[
            "world_truths"
        ] = [
            {
                "text":
                    f"Canon truth {index}",
            }

            for index
            in range(
                6
            )
        ]


        rich = (
            assess_document_strength(
                source
            )
        )


        blank = (
            assess_document_strength(
                default_source_document(
                    title=
                        "Blank",

                    slug=
                        "blank",
                )
            )
        )


        self.assertGreater(
            rich[
                "score"
            ],
            blank[
                "score"
            ],
        )


    def test_compile_separates_moments(
        self,
    ) -> None:

        source = (
            default_source_document(
                title=
                    "Test",

                slug=
                    "test",

                document_kind=
                    "brief",
            )
        )


        source[
            "moments"
        ] = [
            {
                "authority":
                    "required",

                "text":
                    "The bell rings.",
            },
            {
                "authority":
                    "preferred",

                "text":
                    "A candle goes out.",
            },
        ]


        compiled = (
            compile_source_document(
                source
            )
        )


        self.assertEqual(
            len(
                compiled[
                    "required_moments"
                ]
            ),
            1,
        )


        self.assertEqual(
            len(
                compiled[
                    "preferred_moments"
                ]
            ),
            1,
        )


    def test_slug_normalization(
        self,
    ) -> None:

        self.assertEqual(
            normalize_slug(
                "  The Old Chapel! "
            ),
            "the_old_chapel",
        )


    def test_design_document_is_human_readable(
        self,
    ) -> None:

        source = (
            default_source_document(
                title=
                    "The Old Chapel",

                slug=
                    "old_chapel",
            )
        )


        source[
            "premise"
        ] = (
            "An abandoned chapel waits at the end of the road."
        )


        rendered = (
            render_design_document(
                source
            )
        )


        self.assertIn(
            "# The Old Chapel",
            rendered,
        )


        self.assertIn(
            "## Setting & World Premise",
            rendered,
        )


class AuthoringStoreTests(
    unittest.IsolatedAsyncioTestCase
):

    async def asyncSetUp(
        self,
    ) -> None:

        self.temp_dir = (
            tempfile.TemporaryDirectory()
        )


        self.store = (
            AuthoringStore(

                Path(
                    self.temp_dir.name
                )
                / "authoring.sqlite3"
            )
        )


        await self.store.initialize()


    async def asyncTearDown(
        self,
    ) -> None:

        self.temp_dir.cleanup()


    async def create_world(
        self,
        slug: str = "old_chapel",
    ) -> dict:

        return (
            await self.store
            .create_document(

                title=
                    "The Old Chapel",

                slug=
                    slug,

                document_kind=
                    "world",

                parent_document_id=
                    None,

                user_id=
                    "user-1",
            )
        )


    async def test_create_save_publish_version(
        self,
    ) -> None:

        created = (
            await self.create_world()
        )


        self.assertEqual(
            created[
                "document_kind"
            ],
            "world",
        )


        source = (
            created[
                "source"
            ]
        )


        source[
            "premise"
        ] = (
            "A chapel waits at the end of the road."
        )


        saved = (
            await self.store
            .save_draft(

                document_id=
                    created[
                        "document_id"
                    ],

                version_number=
                    1,

                source=
                    source,

                expected_updated_at=
                    created[
                        "updated_at"
                    ],
            )
        )


        self.assertEqual(
            saved[
                "source"
            ][
                "premise"
            ],
            (
                "A chapel waits at "
                "the end of the road."
            ),
        )


        published = (
            await self.store
            .publish_version(

                document_id=
                    created[
                        "document_id"
                    ],

                version_number=
                    1,
            )
        )


        self.assertEqual(
            published[
                "status"
            ],
            "published",
        )


        with self.assertRaises(
            ValueError
        ):

            await self.store.save_draft(

                document_id=
                    created[
                        "document_id"
                    ],

                version_number=
                    1,

                source=
                    source,

                expected_updated_at=
                    published[
                        "updated_at"
                    ],
            )


        draft_2 = (
            await self.store
            .create_new_version(

                document_id=
                    created[
                        "document_id"
                    ],

                user_id=
                    "user-1",
            )
        )


        self.assertEqual(
            draft_2[
                "version_number"
            ],
            2,
        )


    async def test_brief_can_link_to_world(
        self,
    ) -> None:

        world = (
            await self.create_world(
                "windroad"
            )
        )


        brief = (
            await self.store
            .create_document(

                title=
                    "Midnight Train",

                slug=
                    "midnight_train",

                document_kind=
                    "brief",

                parent_document_id=
                    world[
                        "document_id"
                    ],

                user_id=
                    "user-1",
            )
        )


        self.assertEqual(
            brief[
                "document_kind"
            ],
            "brief",
        )


        self.assertEqual(
            brief[
                "parent_document_id"
            ],
            world[
                "document_id"
            ],
        )


    async def test_duplicate_slug_is_rejected(
        self,
    ) -> None:

        await self.create_world(
            "same_slug"
        )


        with self.assertRaises(
            ValueError
        ):

            await self.store.create_document(

                title=
                    "Two",

                slug=
                    "same_slug",

                document_kind=
                    "world",

                parent_document_id=
                    None,

                user_id=
                    "user-2",
            )


    async def test_optimistic_conflict_protects_other_author(
        self,
    ) -> None:

        created = (
            await self.create_world(
                "conflict"
            )
        )


        first_source = (
            created[
                "source"
            ]
        )


        first_source[
            "premise"
        ] = "First author."


        first_save = (
            await self.store
            .save_draft(

                document_id=
                    created[
                        "document_id"
                    ],

                version_number=
                    1,

                source=
                    first_source,

                expected_updated_at=
                    created[
                        "updated_at"
                    ],
            )
        )


        stale_source = (
            created[
                "source"
            ]
        )


        stale_source[
            "premise"
        ] = "Stale author."


        with self.assertRaises(
            AuthoringConflictError
        ):

            await self.store.save_draft(

                document_id=
                    created[
                        "document_id"
                    ],

                version_number=
                    1,

                source=
                    stale_source,

                expected_updated_at=
                    created[
                        "updated_at"
                    ],
            )


        self.assertEqual(
            first_save[
                "source"
            ][
                "premise"
            ],
            "First author.",
        )


    async def test_duplicate_and_archive(
        self,
    ) -> None:

        created = (
            await self.create_world(
                "original"
            )
        )


        duplicate = (
            await self.store
            .duplicate_document(

                document_id=
                    created[
                        "document_id"
                    ],

                title=
                    "Old Chapel Variant",

                slug=
                    "old_chapel_variant",

                user_id=
                    "user-1",
            )
        )


        self.assertEqual(
            duplicate[
                "status"
            ],
            "draft",
        )


        await self.store.archive_document(

            document_id=
                duplicate[
                    "document_id"
                ],

            archived=
                True,
        )


        documents = (
            await self.store
            .list_documents(
                include_archived=
                    True
            )
        )


        archived = next(
            item
            for item
            in documents
            if item[
                "document_id"
            ]
            == duplicate[
                "document_id"
            ]
        )


        self.assertTrue(
            archived[
                "is_archived"
            ]
        )


    async def test_archived_is_hidden_by_default(
        self,
    ) -> None:

        created = (
            await self.create_world(
                "archived_hidden"
            )
        )


        await self.store.archive_document(

            document_id=
                created[
                    "document_id"
                ],

            archived=
                True,
        )


        visible = (
            await self.store
            .list_documents()
        )


        self.assertFalse(
            any(
                item[
                    "document_id"
                ]
                == created[
                    "document_id"
                ]

                for item
                in visible
            )
        )


class AuthoringMigrationTests(
    unittest.IsolatedAsyncioTestCase
):

    async def test_v1_database_migrates_to_world_document(
        self,
    ) -> None:

        import json
        import sqlite3

        with tempfile.TemporaryDirectory() as temp_dir:

            db_path = (
                Path(
                    temp_dir
                )
                / "legacy.sqlite3"
            )


            source = (
                default_source_document(
                    title=
                        "Legacy Source",

                    slug=
                        "legacy_source",
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


            connection = (
                sqlite3.connect(
                    db_path
                )
            )


            connection.executescript(
                """
                CREATE TABLE author_documents (
                    document_id TEXT PRIMARY KEY,
                    slug TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    created_by_user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE author_versions (
                    version_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    version_number INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    source_json TEXT NOT NULL,
                    compiled_json TEXT NOT NULL,
                    strength_json TEXT NOT NULL,
                    created_by_user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    published_at TEXT
                );
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
                VALUES (
                    'doc-1',
                    'legacy_source',
                    'Legacy Source',
                    'user-1',
                    '2026-01-01T00:00:00+00:00',
                    '2026-01-01T00:00:00+00:00'
                )
                """
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "version-1",
                    "doc-1",
                    1,
                    "published",
                    json.dumps(
                        source
                    ),
                    json.dumps(
                        compiled
                    ),
                    json.dumps(
                        strength
                    ),
                    "user-1",
                    "2026-01-01T00:00:00+00:00",
                    "2026-01-01T00:00:00+00:00",
                    "2026-01-01T00:00:00+00:00",
                ),
            )


            connection.commit()
            connection.close()


            store = (
                AuthoringStore(
                    db_path
                )
            )


            await store.initialize()


            documents = (
                await store
                .list_documents()
            )


            self.assertEqual(
                len(
                    documents
                ),
                1,
            )


            self.assertEqual(
                documents[
                    0
                ][
                    "document_kind"
                ],
                "world",
            )


            self.assertFalse(
                documents[
                    0
                ][
                    "is_archived"
                ]
            )


if __name__ == "__main__":

    unittest.main()
