#!/usr/bin/env python3
"""Pass 66.19: hash-guarded cleanup of confirmed, unmounted frontend modules.

Dry run by default; --apply removes only the three pinned versions listed below,
with restorable backups in root/_cleanup-backups/pass66_19/.
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

RETIRED = {
    "frontend/src/features/appearance/BookPageTurn.tsx": "aea8b9b322d19eea242d3015412227493ed4f6be792415718188cd0ac648d6b1",
    "frontend/src/features/appearance/bookPageTurn.css": "a6190cfc074d355c13a591ee692c1898db48181229bc5b10cdb90b700ec45d6e",
    "frontend/src/components/ui/StoryTimeConsentCopy.tsx": "64624a668ef782f4cd3a93180fb1018a12f1b74d32f52787319a9674f1a381ed",
}
SYMBOLS = ("BookPageTurn", "StoryTimeConsentCopy", "bookPageTurn.css", "p64-page-turn")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean(root: Path, apply: bool) -> int:
    root = root.resolve()
    if not (root / "frontend/src/main.tsx").is_file():
        print("ERROR: Not a Quillairo source checkout (frontend/src/main.tsx missing)", file=sys.stderr)
        return 2
    candidate_paths = {root / name for name in RETIRED}

    # Fail closed if anything active references this retired code, including CSS.
    for path in (root / "frontend/src").rglob("*"):
        if not path.is_file() or path in candidate_paths or path.suffix not in {".ts", ".tsx", ".css", ".js", ".jsx"}:
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        for symbol in SYMBOLS:
            if symbol in content:
                print(f"ERROR: Active source still references retired {symbol} in {path.relative_to(root)}", file=sys.stderr)
                return 2

    remaining = []
    for name, expected in RETIRED.items():
        path = root / name
        if path.is_symlink() or (path.exists() and not path.is_file()):
            print(f"ERROR: Unexpected file type: {name}", file=sys.stderr)
            return 2
        if not path.exists():
            print(f"SKIP: Already absent: {name}")
            continue
        if digest(path) != expected:
            print(f"ERROR: Refusing to remove modified file: {name}", file=sys.stderr)
            return 2
        remaining.append((name, path, expected))

    if not remaining:
        print("PASS: Retired source already clean; no changes")
        return 0
    if not apply:
        for name, _, _ in remaining:
            print(f"WOULD REMOVE (hash-verified): {name}")
        print("Dry run only. Pass --apply to back up and remove these files.")
        return 0

    backup_root = root / "_cleanup-backups/pass66_19"
    for name, path, expected in remaining:
        backup = backup_root / name
        if backup.exists():
            if not backup.is_file() or digest(backup) != expected:
                print(f"ERROR: Existing backup conflicts with {name}; no source files removed", file=sys.stderr)
                return 2
    # Complete all preflight checks before mutating the source tree.
    for name, path, expected in remaining:
        backup = backup_root / name
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(path, backup)
        if digest(backup) != expected:
            print(f"ERROR: Could not verify backup for {name}; stopping", file=sys.stderr)
            return 2
    for name, path, _ in remaining:
        path.unlink()
        print(f"REMOVED (backed up): {name}")
    print(f"PASS: Pruned {len(remaining)} confirmed retired files. Backup: {backup_root}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Back up and remove confirmed obsolete files")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    return clean(args.root, args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
