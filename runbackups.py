from __future__ import annotations

import shutil
import sqlite3
import subprocess
import sys

from datetime import (
    datetime,
)

from pathlib import (
    Path,
)


# =========================================================
# PATHS
# =========================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parent
)


BACKUP_ROOT = (
    PROJECT_ROOT
    / "backups"
)


TEST_RUNNER = (
    PROJECT_ROOT
    / "runtest.py"
)


# =========================================================
# BACKUP SETS
# =========================================================

IMPORTANT_FILES = [

    "app/main.py",

    "app/game/rooms.py",
    "app/game/session.py",
    "app/game/check_engine.py",
    "app/game/checks.py",
    "app/game/dice.py",
    "app/game/character.py",

    "app/adventures/__init__.py",
    "app/adventures/models.py",
    "app/adventures/registry.py",
    "app/adventures/bootstrap.py",
    "app/adventures/content/__init__.py",
    "app/adventures/content/old_chapel.py",

    "app/authoring/__init__.py",
    "app/authoring/models.py",
    "app/authoring/service.py",
    "app/authoring/schemas.py",
    "app/authoring/store.py",
    "app/authoring/routes.py",

    "app/generation/__init__.py",
    "app/generation/models.py",
    "app/generation/provider.py",
    "app/generation/mock_provider.py",
    "app/generation/runtime_adapter.py",
    "app/generation/service.py",
    "app/generation/schemas.py",
    "app/generation/store.py",
    "app/generation/routes.py",

    "app/persistence/store.py",
    "app/persistence/bootstrap.py",

    "app/auth/models.py",
    "app/auth/store.py",
    "app/auth/passwords.py",
    "app/auth/sessions.py",
    "app/auth/service.py",
    "app/auth/schemas.py",
    "app/auth/routes.py",
    "app/auth/socket_auth.py",
    "app/auth/providers/base.py",
    "app/auth/providers/local.py",

    "app/characters/models.py",
    "app/characters/store.py",
    "app/characters/service.py",
    "app/characters/schemas.py",
    "app/characters/routes.py",
    "app/characters/creation.py",

    "app/networking/chat.py",

    "app/web/index.html",
    "app/web/app.js",
    "app/web/style.css",
    "app/web/adventure_ui.js",
    "app/web/adventure_ui.css",
    "app/web/author/index.html",
    "app/web/author/author.js",
    "app/web/author/author.css",

    "tests/test_rooms.py",
    "tests/test_adventures.py",
    "tests/test_authoring.py",
    "tests/test_generation.py",

    "requirements.txt",
    "run.py",
    "runtest.py",
    "runbackups.py",
]


IMPORTANT_DIRECTORIES = [

    "app/adventures",
    "app/authoring",
    "app/generation",
    "app/web/author",
    "tests",
]


DATABASE_FILES = [

    "data/game_state.sqlite3",

]


# =========================================================
# SETTINGS
# =========================================================

KEEP_LATEST_BACKUPS = 20


# =========================================================
# HELPERS
# =========================================================

def timestamp() -> str:

    return datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )


def print_header(
    title: str,
) -> None:

    print()
    print(
        "=" * 60
    )

    print(
        title
    )

    print(
        "=" * 60
    )

    print()


def run_tests() -> bool:

    print_header(
        "RUNNING TEST SUITE BEFORE BACKUP"
    )


    if (
        not TEST_RUNNER.exists()
    ):

        print(
            "[FAIL] runtest.py was not found."
        )

        print(
            TEST_RUNNER
        )

        return False


    result = subprocess.run(

        [
            sys.executable,
            str(
                TEST_RUNNER
            ),
        ],

        cwd=
            PROJECT_ROOT,

        check=
            False,
    )


    if (
        result.returncode
        != 0
    ):

        print()
        print(
            "[FAIL] Tests failed."
        )

        print(
            "Backup was NOT created."
        )

        return False


    print()
    print(
        "[OK] Tests passed."
    )

    print(
        "Creating known-good backup..."
    )


    return True


def copy_file(
    source: Path,
    destination: Path,
) -> bool:

    if not source.exists():

        print(
            f"[SKIP] Missing file: "
            f"{source.relative_to(PROJECT_ROOT)}"
        )

        return False


    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )


    shutil.copy2(
        source,
        destination,
    )


    print(
        f"[OK] "
        f"{source.relative_to(PROJECT_ROOT)}"
    )


    return True


def copy_directory(
    source: Path,
    destination: Path,
) -> bool:

    if not source.exists():

        print(
            f"[SKIP] Missing directory: "
            f"{source.relative_to(PROJECT_ROOT)}"
        )

        return False


    shutil.copytree(
        source,
        destination,
        dirs_exist_ok=True,
        ignore=
            shutil.ignore_patterns(
                "__pycache__",
                "*.pyc",
                ".DS_Store",
            ),
    )


    print(
        f"[OK] "
        f"{source.relative_to(PROJECT_ROOT)}/"
    )


    return True


def backup_sqlite_database(
    source: Path,
    destination: Path,
) -> bool:

    if not source.exists():

        print(
            f"[SKIP] Missing database: "
            f"{source.relative_to(PROJECT_ROOT)}"
        )

        return False


    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )


    source_connection = (
        sqlite3.connect(
            source
        )
    )

    destination_connection = (
        sqlite3.connect(
            destination
        )
    )


    try:

        source_connection.backup(
            destination_connection
        )

        destination_connection.commit()

    finally:

        destination_connection.close()

        source_connection.close()


    print(
        f"[OK] "
        f"{source.relative_to(PROJECT_ROOT)} "
        f"(SQLite online backup)"
    )


    return True


def prune_old_backups() -> None:

    backup_directories = sorted(
        [
            path

            for path
            in BACKUP_ROOT.iterdir()

            if (
                path.is_dir()
                and path.name.startswith(
                    "snapshot_"
                )
            )
        ],
        key=
            lambda path:
                path.name,
        reverse=True,
    )


    old_backups = (
        backup_directories[
            KEEP_LATEST_BACKUPS:
        ]
    )


    for backup in old_backups:

        shutil.rmtree(
            backup
        )


        print(
            f"[PRUNE] "
            f"{backup.name}"
        )


# =========================================================
# MAIN BACKUP
# =========================================================

def run_backup() -> bool:

    if not run_tests():

        return False


    backup_stamp = (
        timestamp()
    )


    snapshot_directory = (
        BACKUP_ROOT
        / f"snapshot_{backup_stamp}"
    )


    snapshot_directory.mkdir(
        parents=True,
        exist_ok=False,
    )


    print_header(
        "TALES OF TWO — PROJECT BACKUP"
    )


    print(
        "Destination:"
    )

    print(
        snapshot_directory
    )

    print()


    copied_files = 0

    copied_directories = 0


    print(
        "[FILES]"
    )


    for relative_path in (
        IMPORTANT_FILES
    ):

        source = (
            PROJECT_ROOT
            / relative_path
        )


        destination = (
            snapshot_directory
            / relative_path
        )


        if copy_file(
            source,
            destination,
        ):

            copied_files += 1


    print()
    print(
        "[DIRECTORIES]"
    )


    for relative_path in (
        IMPORTANT_DIRECTORIES
    ):

        source = (
            PROJECT_ROOT
            / relative_path
        )


        destination = (
            snapshot_directory
            / relative_path
        )


        if copy_directory(
            source,
            destination,
        ):

            copied_directories += 1


    print()
    print(
        "[DATABASE]"
    )


    for relative_path in (
        DATABASE_FILES
    ):

        source = (
            PROJECT_ROOT
            / relative_path
        )


        destination = (
            snapshot_directory
            / relative_path
        )


        if backup_sqlite_database(
            source,
            destination,
        ):

            copied_files += 1


    manifest_path = (
        snapshot_directory
        / "BACKUP_INFO.txt"
    )


    manifest_path.write_text(
        (
            "TALES OF TWO BACKUP\n"
            "===================\n\n"
            f"Created: {backup_stamp}\n"
            f"Status: KNOWN GOOD\n"
            f"Tests: PASSED\n"
            f"Project root: {PROJECT_ROOT}\n"
            f"Python: {sys.executable}\n"
            f"Files copied: {copied_files}\n"
            f"Directories copied: "
            f"{copied_directories}\n"
        ),
        encoding=
            "utf-8",
    )


    print()
    print(
        "[RETENTION]"
    )


    prune_old_backups()


    print_header(
        "BACKUP COMPLETE — KNOWN GOOD"
    )


    print(
        f"Files copied: "
        f"{copied_files}"
    )

    print(
        f"Directories copied: "
        f"{copied_directories}"
    )

    print(
        "Saved to:"
    )

    print(
        snapshot_directory
    )

    print()


    return True


def main() -> int:

    success = (
        run_backup()
    )


    return (
        0
        if success
        else 1
    )


if __name__ == "__main__":

    raise SystemExit(
        main()
    )
