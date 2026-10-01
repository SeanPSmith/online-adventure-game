from __future__ import annotations

import json
import sqlite3

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.database import connect_database


BUNDLE_FORMAT = "adventure-platform-author-content"
BUNDLE_SCHEMA_VERSION = 1

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DATABASE_PATH = (
    PROJECT_ROOT
    / "data"
    / "game_state.sqlite3"
)


class ContentImportError(ValueError):
    """Raised when a portable content bundle cannot be imported safely."""

    def __init__(
        self,
        message: str,
        *,
        missing_usernames: list[str] | None = None,
        conflicts: list[str] | None = None,
    ) -> None:
        super().__init__(message)
        self.missing_usernames = missing_usernames or []
        self.conflicts = conflicts or []


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_load(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (dict, list, int, float, bool)):
        return value

    text = str(value)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _json_dump(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    return (
        connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
            LIMIT 1
            """,
            (table_name,),
        ).fetchone()
        is not None
    )


def export_legacy_author_bundle(
    database_path: Path,
) -> dict[str, Any]:
    """Export authored worlds/briefs and generated stories from legacy SQLite.

    Password hashes, sessions, characters, room state, and other player data are
    intentionally excluded. User records are included only as identity metadata
    so ownership can be mapped to fresh cloud accounts by username.
    """

    database_path = Path(database_path)

    if not database_path.exists():
        raise FileNotFoundError(
            f"Legacy database not found: {database_path}"
        )

    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row

    try:
        required_tables = {
            "users",
            "author_documents",
            "author_versions",
            "generated_adventures",
        }

        missing_tables = sorted(
            table
            for table in required_tables
            if not _table_exists(connection, table)
        )

        if missing_tables:
            raise ValueError(
                "Legacy database is missing required author tables: "
                + ", ".join(missing_tables)
            )

        users = {
            str(row["user_id"]): {
                "legacy_user_id": str(row["user_id"]),
                "username": str(row["username"]),
                "email": str(row["email"]),
            }
            for row in connection.execute(
                """
                SELECT user_id, username, email
                FROM users
                ORDER BY username COLLATE NOCASE
                """
            ).fetchall()
        }

        documents: list[dict[str, Any]] = []
        relevant_user_ids: set[str] = set()

        for row in connection.execute(
            """
            SELECT
                document_id,
                slug,
                title,
                created_by_user_id,
                created_at,
                updated_at,
                document_kind,
                parent_document_id,
                is_archived
            FROM author_documents
            ORDER BY created_at, document_id
            """
        ).fetchall():
            legacy_user_id = str(row["created_by_user_id"])
            relevant_user_ids.add(legacy_user_id)
            identity = users.get(legacy_user_id, {})

            documents.append({
                "document_id": str(row["document_id"]),
                "slug": str(row["slug"]),
                "title": str(row["title"]),
                "created_by_username": identity.get("username"),
                "created_by_email": identity.get("email"),
                "legacy_created_by_user_id": legacy_user_id,
                "created_at": str(row["created_at"]),
                "updated_at": str(row["updated_at"]),
                "document_kind": str(row["document_kind"] or "world"),
                "parent_document_id": (
                    str(row["parent_document_id"])
                    if row["parent_document_id"] is not None
                    else None
                ),
                "is_archived": bool(row["is_archived"]),
            })

        versions: list[dict[str, Any]] = []

        for row in connection.execute(
            """
            SELECT
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
            FROM author_versions
            ORDER BY document_id, version_number
            """
        ).fetchall():
            legacy_user_id = str(row["created_by_user_id"])
            relevant_user_ids.add(legacy_user_id)
            identity = users.get(legacy_user_id, {})

            versions.append({
                "version_id": str(row["version_id"]),
                "document_id": str(row["document_id"]),
                "version_number": int(row["version_number"]),
                "status": str(row["status"]),
                "source": _json_load(row["source_json"]),
                "compiled": _json_load(row["compiled_json"]),
                "strength": _json_load(row["strength_json"]),
                "created_by_username": identity.get("username"),
                "created_by_email": identity.get("email"),
                "legacy_created_by_user_id": legacy_user_id,
                "created_at": str(row["created_at"]),
                "updated_at": str(row["updated_at"]),
                "published_at": (
                    str(row["published_at"])
                    if row["published_at"] is not None
                    else None
                ),
            })

        generated_adventures: list[dict[str, Any]] = []

        for row in connection.execute(
            """
            SELECT
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
            FROM generated_adventures
            ORDER BY created_at, generated_adventure_id
            """
        ).fetchall():
            legacy_user_id = str(row["created_by_user_id"])
            relevant_user_ids.add(legacy_user_id)
            identity = users.get(legacy_user_id, {})

            generated_adventures.append({
                "generated_adventure_id": str(row["generated_adventure_id"]),
                "status": str(row["status"]),
                "seed": _json_load(row["seed_json"]),
                "world_document_id": str(row["world_document_id"]),
                "world_version_number": int(row["world_version_number"]),
                "brief_document_id": str(row["brief_document_id"]),
                "brief_version_number": int(row["brief_version_number"]),
                "created_by_username": identity.get("username"),
                "created_by_email": identity.get("email"),
                "legacy_created_by_user_id": legacy_user_id,
                "created_at": str(row["created_at"]),
                "updated_at": str(row["updated_at"]),
                "approved_at": (
                    str(row["approved_at"])
                    if row["approved_at"] is not None
                    else None
                ),
            })

        authors = [
            users[user_id]
            for user_id in sorted(relevant_user_ids)
            if user_id in users
        ]

        return {
            "format": BUNDLE_FORMAT,
            "schema_version": BUNDLE_SCHEMA_VERSION,
            "exported_at": _utc_iso(),
            "source": {
                "database": database_path.name,
                "kind": "legacy-sqlite",
            },
            "authors": authors,
            "documents": documents,
            "versions": versions,
            "generated_adventures": generated_adventures,
        }
    finally:
        connection.close()


def _validate_bundle(bundle: Any) -> dict[str, Any]:
    if not isinstance(bundle, dict):
        raise ContentImportError("Content bundle must be a JSON object.")

    if bundle.get("format") != BUNDLE_FORMAT:
        raise ContentImportError(
            f"Unsupported content bundle format: {bundle.get('format')!r}."
        )

    if int(bundle.get("schema_version", 0)) != BUNDLE_SCHEMA_VERSION:
        raise ContentImportError(
            "Unsupported content bundle schema version."
        )

    for key in (
        "documents",
        "versions",
        "generated_adventures",
    ):
        if not isinstance(bundle.get(key), list):
            raise ContentImportError(
                f"Content bundle field '{key}' must be a list."
            )

    return bundle


def _legacy_usernames(bundle: dict[str, Any]) -> list[str]:
    values: set[str] = set()

    for collection_name in (
        "documents",
        "versions",
        "generated_adventures",
    ):
        for item in bundle.get(collection_name, []):
            username = str(item.get("created_by_username") or "").strip()

            if not username:
                raise ContentImportError(
                    f"An item in '{collection_name}' has no created_by_username."
                )

            values.add(username)

    return sorted(values, key=str.casefold)


def import_author_content_bundle(
    bundle: Any,
    *,
    importing_user_id: str,
    author_map: dict[str, str] | None = None,
    database_path: Path = DATABASE_PATH,
) -> dict[str, Any]:
    """Import a portable author-content bundle atomically.

    Ownership is resolved by username against accounts that already exist in the
    destination database. The import refuses to write anything if even one
    legacy author is missing; this prevents silently stealing a collaborator's
    WIP or assigning it to the wrong account.
    """

    bundle = _validate_bundle(bundle)
    legacy_usernames = _legacy_usernames(bundle)

    normalized_author_map = {
        str(source).strip().casefold(): str(destination).strip()
        for source, destination in (author_map or {}).items()
        if str(source).strip() and str(destination).strip()
    }

    def destination_username(legacy_username: str) -> str:
        return normalized_author_map.get(
            legacy_username.casefold(),
            legacy_username,
        )

    ownership_map = {
        legacy_username: destination_username(legacy_username)
        for legacy_username in legacy_usernames
    }

    required_usernames = sorted(
        set(ownership_map.values()),
        key=str.casefold,
    )

    with connect_database(Path(database_path)) as connection:
        rows = connection.execute(
            """
            SELECT user_id, username
            FROM users
            ORDER BY LOWER(username)
            """
        ).fetchall()

        username_to_user_id = {
            str(row["username"]).casefold(): str(row["user_id"])
            for row in rows
        }

        missing_usernames = [
            username
            for username in required_usernames
            if username.casefold() not in username_to_user_id
        ]

        if missing_usernames:
            raise ContentImportError(
                "Create the missing cloud account(s) before importing so "
                "document ownership can be preserved.",
                missing_usernames=missing_usernames,
            )

        documents = bundle["documents"]
        versions = bundle["versions"]
        generated = bundle["generated_adventures"]

        conflicts: list[str] = []

        for document in documents:
            document_id = str(document.get("document_id") or "").strip()
            slug = str(document.get("slug") or "").strip()

            if not document_id or not slug:
                conflicts.append("Document with missing document_id or slug.")
                continue

            by_id = connection.execute(
                """
                SELECT document_id, slug
                FROM author_documents
                WHERE document_id = ?
                LIMIT 1
                """,
                (document_id,),
            ).fetchone()

            by_slug = connection.execute(
                """
                SELECT document_id, slug
                FROM author_documents
                WHERE LOWER(slug) = LOWER(?)
                LIMIT 1
                """,
                (slug,),
            ).fetchone()

            if by_id is not None and str(by_id["slug"]) != slug:
                conflicts.append(
                    f"Document ID {document_id} already exists with another slug."
                )

            if by_slug is not None and str(by_slug["document_id"]) != document_id:
                conflicts.append(
                    f"Slug '{slug}' already belongs to another document."
                )

        if conflicts:
            raise ContentImportError(
                "Content import conflicts with existing destination data.",
                conflicts=conflicts,
            )

        inserted_documents = 0
        skipped_documents = 0
        inserted_versions = 0
        skipped_versions = 0
        inserted_generated = 0
        skipped_generated = 0

        for document in documents:
            document_id = str(document["document_id"])
            exists = connection.execute(
                """
                SELECT 1
                FROM author_documents
                WHERE document_id = ?
                LIMIT 1
                """,
                (document_id,),
            ).fetchone()

            if exists is not None:
                skipped_documents += 1
                continue

            legacy_username = str(document["created_by_username"])
            owner_id = username_to_user_id[
                destination_username(legacy_username).casefold()
            ]

            connection.execute(
                """
                INSERT INTO author_documents (
                    document_id,
                    slug,
                    title,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    document_kind,
                    parent_document_id,
                    is_archived
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    document_id,
                    str(document["slug"]),
                    str(document["title"]),
                    owner_id,
                    str(document["created_at"]),
                    str(document["updated_at"]),
                    str(document.get("document_kind") or "world"),
                    document.get("parent_document_id"),
                    1 if bool(document.get("is_archived")) else 0,
                ),
            )
            inserted_documents += 1

        for version in versions:
            version_id = str(version["version_id"])
            exists = connection.execute(
                """
                SELECT 1
                FROM author_versions
                WHERE version_id = ?
                LIMIT 1
                """,
                (version_id,),
            ).fetchone()

            if exists is not None:
                skipped_versions += 1
                continue

            legacy_username = str(version["created_by_username"])
            owner_id = username_to_user_id[
                destination_username(legacy_username).casefold()
            ]

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
                    version_id,
                    str(version["document_id"]),
                    int(version["version_number"]),
                    str(version["status"]),
                    _json_dump(version.get("source")),
                    _json_dump(version.get("compiled")),
                    _json_dump(version.get("strength")),
                    owner_id,
                    str(version["created_at"]),
                    str(version["updated_at"]),
                    version.get("published_at"),
                ),
            )
            inserted_versions += 1

        for adventure in generated:
            generated_id = str(adventure["generated_adventure_id"])
            exists = connection.execute(
                """
                SELECT 1
                FROM generated_adventures
                WHERE generated_adventure_id = ?
                LIMIT 1
                """,
                (generated_id,),
            ).fetchone()

            if exists is not None:
                skipped_generated += 1
                continue

            legacy_username = str(adventure["created_by_username"])
            owner_id = username_to_user_id[
                destination_username(legacy_username).casefold()
            ]

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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    generated_id,
                    str(adventure["status"]),
                    _json_dump(adventure.get("seed")),
                    str(adventure["world_document_id"]),
                    int(adventure["world_version_number"]),
                    str(adventure["brief_document_id"]),
                    int(adventure["brief_version_number"]),
                    owner_id,
                    str(adventure["created_at"]),
                    str(adventure["updated_at"]),
                    adventure.get("approved_at"),
                ),
            )
            inserted_generated += 1

        return {
            "ok": True,
            "imported_by_user_id": importing_user_id,
            "authors_resolved": required_usernames,
            "ownership_map": ownership_map,
            "restart_required": inserted_generated > 0,
            "documents": {
                "inserted": inserted_documents,
                "skipped": skipped_documents,
            },
            "versions": {
                "inserted": inserted_versions,
                "skipped": skipped_versions,
            },
            "generated_adventures": {
                "inserted": inserted_generated,
                "skipped": skipped_generated,
            },
        }
