#!/usr/bin/env python3
"""Guarded one-import insertion for Quillairo Pass 66.48.

No gameplay logic, server code, turn theater or handlers are changed.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import shutil

TARGET = Path("frontend/src/pages/game/InkboundLiveRoom.tsx")
CSS = Path("frontend/src/pages/game/quillairoInkscapeLivePass6648.css")
ANCHOR = 'import "./inkboundLiveRoom.css";'
INSERT = 'import "./quillairoInkscapeLivePass6648.css";'

def apply(root: Path) -> str:
    target = root / TARGET
    css = root / CSS
    if not target.is_file() or not css.is_file():
        raise RuntimeError("Missing InkboundLiveRoom.tsx or Pass 66.48 stylesheet; install overlay first.")
    original = target.read_text(encoding="utf-8")
    if original.count(INSERT) == 1:
        return "PASS: Pass 66.48 stylesheet already imported; source unchanged"
    if INSERT in original or original.count(ANCHOR) != 1:
        raise RuntimeError("Unexpected live-reader import structure; refusing to alter source")
    updated = original.replace(ANCHOR, ANCHOR + "\n" + INSERT, 1)
    backup = root / "backups" / "pass66_48" / TARGET
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        shutil.copy2(target, backup)
    target.write_text(updated, encoding="utf-8")
    # Confirm the edit is exactly one import line; no other source modifications.
    assert updated.replace(ANCHOR + "\n" + INSERT, ANCHOR, 1) == original
    return "PASS: Imported Pass 66.48 presentation stylesheet; gameplay source untouched"

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    if not args.apply:
        parser.error("Pass --apply to install the guarded stylesheet import")
    print(apply(Path(args.root).resolve()))
