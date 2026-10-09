from tests.support import PROJECT_ROOT
from pathlib import Path

ROOT = PROJECT_ROOT

STORE_FILES = [
    ROOT / "app" / "auth" / "store.py",
    ROOT / "app" / "authoring" / "store.py",
    ROOT / "app" / "characters" / "store.py",
    ROOT / "app" / "generation" / "store.py",
    ROOT / "app" / "persistence" / "store.py",
]


def test_database_compatibility_layer_exists():
    assert (ROOT / "app" / "database.py").is_file()


def test_all_persistent_stores_use_shared_database_boundary():
    for path in STORE_FILES:
        source = path.read_text(encoding="utf-8")
        assert "from app.database import" in source, path


def test_character_store_no_longer_opens_sqlite_directly():
    source = (ROOT / "app" / "characters" / "store.py").read_text(encoding="utf-8")
    assert "import sqlite3" not in source
    assert "sqlite3.connect(" not in source
    assert "connect_database(" in source
