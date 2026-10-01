from __future__ import annotations

import sqlite3

import pytest

from app.admin.content_portability import (
    ContentImportError,
    export_legacy_author_bundle,
    import_author_content_bundle,
)


def _create_legacy_db(path):
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE users (
            user_id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            username TEXT NOT NULL
        );
        CREATE TABLE author_documents (
            document_id TEXT PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            created_by_user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            document_kind TEXT NOT NULL DEFAULT 'world',
            parent_document_id TEXT,
            is_archived INTEGER NOT NULL DEFAULT 0
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
        CREATE TABLE generated_adventures (
            generated_adventure_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
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
        """
    )
    con.execute(
        "INSERT INTO users VALUES (?, ?, ?)",
        ("legacy-sean", "sean@example.com", "GaylordDeathfishIII"),
    )
    con.execute(
        "INSERT INTO users VALUES (?, ?, ?)",
        ("legacy-athena", "athena@example.com", "Princess_Athena"),
    )
    con.execute(
        "INSERT INTO author_documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "world-1", "weird-town", "Weird Town", "legacy-sean",
            "2026-01-01T00:00:00+00:00", "2026-01-01T00:00:00+00:00",
            "world", None, 0,
        ),
    )
    con.execute(
        "INSERT INTO author_documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "brief-1", "athenas-night", "Athena's Night", "legacy-athena",
            "2026-01-02T00:00:00+00:00", "2026-01-02T00:00:00+00:00",
            "brief", "world-1", 0,
        ),
    )
    con.execute(
        "INSERT INTO author_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "ver-world-1", "world-1", 1, "published", '{"identity":{"title":"Weird Town"}}',
            '{}', '{"score":50}', "legacy-sean",
            "2026-01-01T00:00:00+00:00", "2026-01-01T00:00:00+00:00",
            "2026-01-01T00:00:00+00:00",
        ),
    )
    con.execute(
        "INSERT INTO author_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "ver-brief-1", "brief-1", 1, "draft", '{"identity":{"title":"Athena Night"}}',
            '{}', '{"score":20}', "legacy-athena",
            "2026-01-02T00:00:00+00:00", "2026-01-02T00:00:00+00:00", None,
        ),
    )
    con.execute(
        "INSERT INTO generated_adventures VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "gen-1", "approved", '{"title":"Public Story"}', "world-1", 1,
            "brief-1", 1, "legacy-sean", "2026-01-03T00:00:00+00:00",
            "2026-01-03T00:00:00+00:00", "2026-01-03T00:00:00+00:00",
        ),
    )
    con.commit()
    con.close()


def _create_target_db(path, include_athena=True):
    con = sqlite3.connect(path)
    con.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (
            user_id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE author_documents (
            document_id TEXT PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            created_by_user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            document_kind TEXT NOT NULL DEFAULT 'world',
            parent_document_id TEXT,
            is_archived INTEGER NOT NULL DEFAULT 0
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
        CREATE TABLE generated_adventures (
            generated_adventure_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
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
        """
    )
    con.execute(
        "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)",
        ("cloud-sean", "sean@cloud.test", "SeanSteezy", "x", "now", 1),
    )
    if include_athena:
        con.execute(
            "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)",
            ("cloud-athena", "athena@cloud.test", "Princess_Athena", "x", "now", 1),
        )
    con.commit()
    con.close()


def test_export_and_import_preserves_ids_and_maps_ownership(tmp_path):
    legacy = tmp_path / "legacy.sqlite3"
    target = tmp_path / "target.sqlite3"
    _create_legacy_db(legacy)
    _create_target_db(target)

    bundle = export_legacy_author_bundle(legacy)
    assert {author["username"] for author in bundle["authors"]} == {
        "GaylordDeathfishIII",
        "Princess_Athena",
    }

    report = import_author_content_bundle(
        bundle,
        importing_user_id="cloud-sean",
        author_map={
            "GaylordDeathfishIII": "SeanSteezy",
        },
        database_path=target,
    )
    assert report["documents"]["inserted"] == 2
    assert report["versions"]["inserted"] == 2
    assert report["generated_adventures"]["inserted"] == 1

    con = sqlite3.connect(target)
    owner = con.execute(
        "SELECT created_by_user_id FROM author_documents WHERE document_id='brief-1'"
    ).fetchone()[0]
    con.close()
    assert owner == "cloud-athena"


def test_import_refuses_missing_legacy_author_without_partial_writes(tmp_path):
    legacy = tmp_path / "legacy.sqlite3"
    target = tmp_path / "target.sqlite3"
    _create_legacy_db(legacy)
    _create_target_db(target, include_athena=False)

    bundle = export_legacy_author_bundle(legacy)

    with pytest.raises(ContentImportError) as caught:
        import_author_content_bundle(
            bundle,
            importing_user_id="cloud-sean",
            author_map={
                "GaylordDeathfishIII": "SeanSteezy",
            },
            database_path=target,
        )

    assert caught.value.missing_usernames == ["Princess_Athena"]

    con = sqlite3.connect(target)
    count = con.execute("SELECT COUNT(*) FROM author_documents").fetchone()[0]
    con.close()
    assert count == 0
