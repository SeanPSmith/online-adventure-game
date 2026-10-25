#!/usr/bin/env python3
"""Pass 66.42: guarded, idempotent fix for post-Director NameError.

Run from any directory after installing the overlay:
    python3 scripts/pass66_42_fix_turn_finalize_clock.py --apply

Never replace main.py from a stale snapshot. Patch exactly the missing import,
keep a byte-for-byte local backup, and reject unexpected source shapes.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "app" / "main.py"
BACKUP = ROOT / ".pass66-42-backup" / "app" / "main.py"
IMPORT = b"from app.auth.sessions import utc_now\n"
ANCHOR = (b"from app.auth.service import (\n" b"    auth_service,\n" b")\n")
CLOCK_USE = b"character.rest_recovered_at = utc_now().isoformat()"


def verify(source: bytes) -> None:
    tree = ast.parse(source, filename=str(TARGET))
    import_ok = any(isinstance(node, ast.ImportFrom) and node.module == 'app.auth.sessions'
                    and any(alias.name == 'utc_now' for alias in node.names)
                    for node in tree.body)
    if not import_ok:
        raise RuntimeError('The utc_now import was not installed in app/main.py')
    if source.count(CLOCK_USE) != 1:
        raise RuntimeError('Expected exactly one active Hero rest-clock update')
    if b'[TURN FINALIZE ERROR]' not in source or b'await apply_turn_progression(' not in source:
        raise RuntimeError('Turn-finalization code did not match expected shape')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply the guarded one-import fix')
    parser.add_argument('--check', action='store_true', help='Confirm a valid import is already present')
    args = parser.parse_args()
    if not (args.apply or args.check) or (args.apply and args.check):
        parser.error('Specify exactly one of --apply or --check')
    if not TARGET.is_file():
        raise SystemExit(f'ERROR: missing source: {TARGET}')
    before = TARGET.read_bytes()
    if IMPORT in before:
        verify(before)
        print('PASS: Pass 66.42 already installed; valid utc_now import present (no changes)')
        return
    if args.check:
        raise SystemExit('ERROR: utc_now import missing; use --apply')
    if before.count(ANCHOR) != 1 or before.count(CLOCK_USE) != 1:
        raise SystemExit('ERROR: Unexpected app/main.py structure; no files were changed')
    if b'from app.auth.sessions import ' in before:
        raise SystemExit('ERROR: Existing sessions import differs; inspect manually before patching')
    after = before.replace(ANCHOR, ANCHOR + b'\n' + IMPORT, 1)
    verify(after)
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    if not BACKUP.exists():
        BACKUP.write_bytes(before)
    # Atomic replacement, maintaining the original file's permission bits.
    with tempfile.NamedTemporaryFile(dir=TARGET.parent, prefix='.pass66-42-', delete=False) as tmp:
        tmp.write(after)
        staged = Path(tmp.name)
    try:
        staged.chmod(TARGET.stat().st_mode & 0o777)
        os.replace(staged, TARGET)
    finally:
        staged.unlink(missing_ok=True)
    if TARGET.read_bytes() != after:
        raise SystemExit('ERROR: post-install source verification mismatch')
    print('PASS: Turn-finalization utc_now import installed safely')
    print(f'Backup: {BACKUP}')
    print(f'Main.py sha256: {hashlib.sha256(after).hexdigest()}')


if __name__ == '__main__':
    main()
