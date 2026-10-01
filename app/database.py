from __future__ import annotations

import os
import re
import sqlite3
import threading

from pathlib import Path
from typing import Any, Mapping, Sequence


DatabaseRow = Mapping[str, Any]


class DatabaseIntegrityError(Exception):
    """Portable integrity error raised by either supported database engine."""


class _EmptyCursor:
    rowcount = 0

    def fetchone(self):
        return None

    def fetchall(self):
        return []


def database_backend() -> str:
    explicit = (
        os.getenv("DB_BACKEND", "")
        .strip()
        .lower()
    )

    if explicit in {"postgres", "postgresql"}:
        return "postgres"

    if os.getenv("DB_HOST"):
        return "postgres"

    return "sqlite"


def using_postgres() -> bool:
    return database_backend() == "postgres"


_POSTGRES_BOOTSTRAP_LOCK = threading.Lock()
_POSTGRES_BOOTSTRAPPED = False


def _convert_qmark_placeholders(sql: str) -> str:
    """Convert qmark placeholders without touching quoted literals."""

    output: list[str] = []
    index = 0
    in_single = False
    in_double = False

    while index < len(sql):
        char = sql[index]

        if char == "'" and not in_double:
            output.append(char)

            if in_single and index + 1 < len(sql) and sql[index + 1] == "'":
                output.append("'")
                index += 2
                continue

            in_single = not in_single
            index += 1
            continue

        if char == '"' and not in_single:
            output.append(char)

            if in_double and index + 1 < len(sql) and sql[index + 1] == '"':
                output.append('"')
                index += 2
                continue

            in_double = not in_double
            index += 1
            continue

        if char == "?" and not in_single and not in_double:
            output.append("%s")
        else:
            output.append(char)

        index += 1

    return "".join(output)


def _translate_postgres_sql(sql: str) -> str:
    translated = str(sql)

    # Preserve SQLite NOCASE semantics. Columns declared NOCASE become CITEXT;
    # expression-level NOCASE becomes an explicit LOWER() comparison/order.
    translated = re.sub(
        r"\b([A-Za-z_][A-Za-z0-9_]*)\s+TEXT\s+NOT\s+NULL\s+COLLATE\s+NOCASE\b",
        r"\1 CITEXT NOT NULL",
        translated,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    translated = re.sub(
        r"\b([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*\?\s*COLLATE\s+NOCASE\b",
        r"LOWER(\1) = LOWER(?)",
        translated,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    translated = re.sub(
        r"\b([A-Za-z_][A-Za-z0-9_.]*)\s+COLLATE\s+NOCASE\b",
        r"LOWER(\1)",
        translated,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    translated = re.sub(
        r"\bCOLLATE\s+NOCASE\b",
        "",
        translated,
        flags=re.IGNORECASE,
    )

    translated = re.sub(
        r"GROUP_CONCAT\s*\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*,\s*('(?:[^']|'')*')\s*\)",
        r"STRING_AGG(\1, \2)",
        translated,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    # Current schemas intentionally persist timestamps as ISO-ish text.
    translated = re.sub(
        r"\bCURRENT_TIMESTAMP\b(?!\s*::)",
        "CURRENT_TIMESTAMP::text",
        translated,
        flags=re.IGNORECASE,
    )

    insert_or_ignore = bool(
        re.search(
            r"\bINSERT\s+OR\s+IGNORE\b",
            translated,
            flags=re.IGNORECASE,
        )
    )

    if insert_or_ignore:
        translated = re.sub(
            r"\bINSERT\s+OR\s+IGNORE\b",
            "INSERT",
            translated,
            count=1,
            flags=re.IGNORECASE,
        )
        translated = translated.rstrip()

        if translated.endswith(";"):
            translated = translated[:-1].rstrip()

        translated += "\nON CONFLICT DO NOTHING"

    return _convert_qmark_placeholders(translated)


def _split_sql_script(script: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    in_single = False
    in_double = False
    index = 0

    while index < len(script):
        char = script[index]

        if char == "'" and not in_double:
            buffer.append(char)

            if in_single and index + 1 < len(script) and script[index + 1] == "'":
                buffer.append("'")
                index += 2
                continue

            in_single = not in_single
            index += 1
            continue

        if char == '"' and not in_single:
            buffer.append(char)

            if in_double and index + 1 < len(script) and script[index + 1] == '"':
                buffer.append('"')
                index += 2
                continue

            in_double = not in_double
            index += 1
            continue

        if char == ";" and not in_single and not in_double:
            statement = "".join(buffer).strip()

            if statement:
                statements.append(statement)

            buffer.clear()
            index += 1
            continue

        buffer.append(char)
        index += 1

    trailing = "".join(buffer).strip()

    if trailing:
        statements.append(trailing)

    return statements


class DatabaseConnection:
    def __init__(
        self,
        engine: str,
        raw_connection,
        integrity_error_types: tuple[type[BaseException], ...],
    ) -> None:
        self.engine = engine
        self.raw_connection = raw_connection
        self.integrity_error_types = integrity_error_types

    def execute(
        self,
        sql: str,
        params: Sequence[Any] | None = None,
    ):
        parameters = tuple(params or ())

        if self.engine == "sqlite":
            try:
                return self.raw_connection.execute(sql, parameters)
            except self.integrity_error_types as error:
                raise DatabaseIntegrityError(str(error)) from error

        normalized = sql.strip()
        upper = normalized.upper()

        if upper.startswith("PRAGMA TABLE_INFO"):
            match = re.search(
                r"PRAGMA\s+TABLE_INFO\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)",
                normalized,
                flags=re.IGNORECASE,
            )

            if match is None:
                return _EmptyCursor()

            return self.raw_connection.execute(
                """
                SELECT column_name AS name
                FROM information_schema.columns
                WHERE
                    table_schema = current_schema()
                    AND table_name = %s
                ORDER BY ordinal_position
                """,
                (match.group(1),),
            )

        if upper.startswith("PRAGMA"):
            return _EmptyCursor()

        if "FROM SQLITE_MASTER" in upper:
            match = re.search(
                r"\bname\s*=\s*'([^']+)'",
                normalized,
                flags=re.IGNORECASE,
            )

            if match is None:
                return _EmptyCursor()

            return self.raw_connection.execute(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE
                    table_schema = current_schema()
                    AND table_name = %s
                LIMIT 1
                """,
                (match.group(1),),
            )

        translated = _translate_postgres_sql(sql)

        try:
            return self.raw_connection.execute(translated, parameters)
        except self.integrity_error_types as error:
            raise DatabaseIntegrityError(str(error)) from error

    def executescript(self, script: str) -> None:
        if self.engine == "sqlite":
            try:
                self.raw_connection.executescript(script)
                return
            except self.integrity_error_types as error:
                raise DatabaseIntegrityError(str(error)) from error

        for statement in _split_sql_script(script):
            self.execute(statement)

    def commit(self) -> None:
        self.raw_connection.commit()

    def rollback(self) -> None:
        self.raw_connection.rollback()

    def close(self) -> None:
        self.raw_connection.close()

    def __enter__(self) -> "DatabaseConnection":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        if exc_type is None:
            self.commit()
        else:
            self.rollback()

        return False


def _bootstrap_postgres(connection) -> None:
    global _POSTGRES_BOOTSTRAPPED

    if _POSTGRES_BOOTSTRAPPED:
        return

    with _POSTGRES_BOOTSTRAP_LOCK:
        if _POSTGRES_BOOTSTRAPPED:
            return

        connection.execute("CREATE EXTENSION IF NOT EXISTS citext")
        connection.commit()
        _POSTGRES_BOOTSTRAPPED = True


def connect_database(
    sqlite_path: Path,
    *,
    timeout: float = 10.0,
) -> DatabaseConnection:
    if not using_postgres():
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)

        raw_connection = sqlite3.connect(
            sqlite_path,
            timeout=timeout,
        )
        raw_connection.row_factory = sqlite3.Row
        raw_connection.execute("PRAGMA foreign_keys = ON")

        return DatabaseConnection(
            "sqlite",
            raw_connection,
            (sqlite3.IntegrityError,),
        )

    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as error:
        raise RuntimeError(
            "PostgreSQL was requested but psycopg is not installed. "
            "Install requirements-aws.txt for cloud/runtime deployments."
        ) from error

    host = os.getenv("DB_HOST", "").strip()
    database = os.getenv("DB_NAME", "adventure_platform").strip()
    username = os.getenv("DB_USER", "").strip()
    password = os.getenv("DB_PASSWORD", "")
    port = int(os.getenv("DB_PORT", "5432"))

    missing = [
        name
        for name, value in (
            ("DB_HOST", host),
            ("DB_USER", username),
            ("DB_PASSWORD", password),
        )
        if not value
    ]

    if missing:
        raise RuntimeError(
            "PostgreSQL configuration is incomplete: "
            + ", ".join(missing)
        )

    raw_connection = psycopg.connect(
        host=host,
        port=port,
        dbname=database,
        user=username,
        password=password,
        connect_timeout=max(1, int(timeout)),
        row_factory=dict_row,
    )

    _bootstrap_postgres(raw_connection)

    return DatabaseConnection(
        "postgres",
        raw_connection,
        (psycopg.IntegrityError,),
    )
