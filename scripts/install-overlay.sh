#!/usr/bin/env bash
set -euo pipefail

# Deterministic patch installer. Finder's Merge does not guarantee replacement.
# Usage from anywhere: bash /path/to/project/scripts/install-overlay.sh /path/to/pass.zip
# Rejects unsafe archive paths/symlinks, overwrites matching source files,
# preserves executable permissions, and verifies the installed bytes.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP_PATH="${1:?Usage: bash scripts/install-overlay.sh /path/to/overlay.zip}"
python3 - "$PROJECT_ROOT" "$ZIP_PATH" <<'PY'
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, BadZipFile
import hashlib
import os
import stat
import sys
import tempfile

root = Path(sys.argv[1]).resolve()
archive_path = Path(sys.argv[2]).expanduser().resolve()
if not archive_path.is_file():
    raise SystemExit(f"ERROR: Overlay ZIP not found: {archive_path}")

with ZipFile(archive_path) as archive:
    if archive.testzip():
        raise SystemExit("ERROR: ZIP checksum verification failed")
    staged = []
    seen = set()
    entries = [info for info in archive.infolist() if not info.is_dir()]
    if not entries:
        raise SystemExit("ERROR: Empty ZIP")

    # Complete preflight BEFORE replacing any files.
    for info in entries:
        name = info.filename
        rel = PurePosixPath(name)
        mode = (info.external_attr >> 16)
        if (not name or name.startswith('/') or '\\' in name
                or any(part in ('', '.', '..') for part in rel.parts)
                or rel.parts[0] == '.git'
                or stat.S_ISLNK(mode)
                or name in seen):
            raise SystemExit(f"ERROR: Unsafe or duplicate overlay entry: {name!r}")
        seen.add(name)
        destination = root.joinpath(*rel.parts)
        if not destination.resolve().is_relative_to(root) or destination.is_symlink():
            raise SystemExit(f"ERROR: Overlay path escapes project: {name}")

    # Stage every file on the same filesystem for atomic per-file replacement.
    try:
        for info in entries:
            rel = PurePosixPath(info.filename)
            destination = root.joinpath(*rel.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            contents = archive.read(info)
            with tempfile.NamedTemporaryFile(prefix='.overlay-', dir=destination.parent, delete=False) as temporary:
                temporary.write(contents)
                stage = Path(temporary.name)
            permissions = (info.external_attr >> 16) & 0o777
            if permissions:
                stage.chmod(permissions)
            staged.append((stage, destination, hashlib.sha256(contents).digest()))
        for stage, destination, digest in staged:
            os.replace(stage, destination)
        mismatches = [str(destination.relative_to(root)) for _, destination, digest in staged
                      if not destination.is_file() or hashlib.sha256(destination.read_bytes()).digest() != digest]
        if mismatches:
            raise SystemExit('ERROR: Post-install mismatch: ' + ', '.join(mismatches))
    finally:
        for stage, _, _ in staged:
            if stage.exists():
                stage.unlink()

print(f"PASS: Replaced and verified all {len(entries)} overlay files in {root}")
PY
