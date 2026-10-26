#!/usr/bin/env python3
"""Apply Pass 66.44 to the existing Quillairo source without replacing large files.

Usage after scripts/install-overlay.sh:
    python3 scripts/pass66_44_apply.py --apply

Only the seven exact pre-reviewed files are patched. Unexpected local changes are
rejected, and an independent local backup is made before applying anything.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "scripts/patches/pass66_44.patch"
TARGETS = (
    "frontend/src/layouts/GameLayout.tsx",
    "frontend/src/pages/game/GameHomePage.tsx",
    "frontend/src/pages/game/inkboundAuthenticatedDashboard.css",
    "frontend/src/styles/quillairoAdventureBoot.css",
    "tests/frontend/test_pass65_6_2_document_scroll.py",
    "tests/adventures/test_pass64_2b_scrapbook_contract.py",
    "tests/adventures/test_pass64_4_living_book.py",
)


def git_apply(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "apply", *args, str(PATCH)], cwd=ROOT,
                          capture_output=True, text=True, check=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply patch (otherwise preflight only)")
    args = parser.parse_args()
    if not PATCH.is_file():
        raise SystemExit("ERROR: Pass 66.44 patch is missing; install overlay ZIP first.")
    if git_apply("--reverse", "--check").returncode == 0:
        print("PASS: Pass 66.44 already installed; no additional changes made.")
        return
    outcome = git_apply("--check")
    if outcome.returncode:
        raise SystemExit("REFUSED: One or more source files differ from the reviewed baseline.\n"
                         "No application files were changed. Please package the latest project snapshot.\n"
                         + outcome.stderr)
    print("PASS: All seven reviewed source files match the guarded patch.")
    if not args.apply:
        print("Dry run only; use --apply to install the patch.")
        return
    backup = ROOT / ".quillairo-patch-backups" / (
        "pass66_44-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f"))
    for path in TARGETS:
        destination = backup / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / path, destination)
    applied = git_apply()
    if applied.returncode:
        for path in TARGETS:
            shutil.copy2(backup / path, ROOT / path)
        raise SystemExit("ERROR: Patch failed, source files restored. " + applied.stderr)
    assert git_apply("--reverse", "--check").returncode == 0, "Patch verification failed"
    print("PASS: Inkspace production shell separated from the old book preview.")
    print("Local backup:", backup)


if __name__ == "__main__":
    main()
