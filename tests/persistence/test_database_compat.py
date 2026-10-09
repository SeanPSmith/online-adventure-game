import tempfile
import unittest

from pathlib import Path

from app.database import (
    _convert_qmark_placeholders,
    _split_sql_script,
    _translate_postgres_sql,
    connect_database,
)


class DatabaseCompatibilityTests(unittest.TestCase):
    def test_qmark_conversion_ignores_literals(self):
        sql = "SELECT '?' AS literal, value FROM sample WHERE id = ?"
        self.assertEqual(
            _convert_qmark_placeholders(sql),
            "SELECT '?' AS literal, value FROM sample WHERE id = %s",
        )

    def test_sqlite_upsert_compatibility_translation(self):
        sql = "INSERT OR IGNORE INTO permissions (user_id, permission) VALUES (?, ?)"
        translated = _translate_postgres_sql(sql)
        self.assertIn("INSERT INTO permissions", translated)
        self.assertIn("VALUES (%s, %s)", translated)
        self.assertIn("ON CONFLICT DO NOTHING", translated)

    def test_nocase_and_group_concat_translation(self):
        sql = """
            SELECT GROUP_CONCAT(p.permission, ',') AS permissions
            FROM users
            LEFT JOIN permissions p ON p.user_id = users.user_id
            WHERE users.email = ? COLLATE NOCASE
            ORDER BY users.username COLLATE NOCASE ASC
        """
        translated = _translate_postgres_sql(sql)
        self.assertIn("STRING_AGG(p.permission, ',')", translated)
        self.assertIn("LOWER(users.email) = LOWER(%s)", translated)
        self.assertIn("LOWER(users.username) ASC", translated)

    def test_nocase_column_becomes_citext(self):
        sql = "email TEXT NOT NULL COLLATE NOCASE UNIQUE"
        self.assertEqual(
            _translate_postgres_sql(sql),
            "email CITEXT NOT NULL UNIQUE",
        )

    def test_executescript_split_keeps_semicolon_inside_literal(self):
        script = "INSERT INTO x VALUES ('a;b'); CREATE TABLE y (id TEXT);"
        self.assertEqual(
            _split_sql_script(script),
            ["INSERT INTO x VALUES ('a;b')", "CREATE TABLE y (id TEXT)"],
        )

    def test_sqlite_mode_remains_default(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            database_path = Path(temp_dir) / "test.sqlite3"
            with connect_database(database_path) as connection:
                connection.execute("CREATE TABLE demo (id TEXT PRIMARY KEY, value TEXT)")
                connection.execute("INSERT INTO demo (id, value) VALUES (?, ?)", ("a", "b"))

            with connect_database(database_path) as connection:
                row = connection.execute("SELECT value FROM demo WHERE id = ?", ("a",)).fetchone()

            self.assertIsNotNone(row)
            self.assertEqual(row["value"], "b")


if __name__ == "__main__":
    unittest.main()
