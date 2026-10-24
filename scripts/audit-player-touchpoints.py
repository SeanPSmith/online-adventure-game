#!/usr/bin/env python3
"""Inventory Quillairo React touchpoints without claiming browser-level validation.

Checks lazy route imports and writes a readable QA inventory. This is a source
integrity check, not an assertion that controls are usable or correctly styled.
Run from anywhere: python3 scripts/audit-player-touchpoints.py
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTER = ROOT / "frontend/src/router.tsx"
IMPORT = re.compile(r'await import\("(\.[^"\n]+)"\)')
PATH = re.compile(r'\bpath:\s*"([^"]+)"')


def audit_routes(router: Path = ROUTER):
    issues: list[str] = []
    entries: list[tuple[str, str, str]] = []
    game_section = False
    for raw in router.read_text(encoding="utf-8").splitlines():
        if 'path: "game",' in raw:
            game_section = True
        elif 'element: <AccountLayout />' in raw:
            game_section = False
        match = IMPORT.search(raw)
        if not match:
            continue
        module = match.group(1)
        candidates = [router.parent / (module + ext) for ext in (".tsx", ".ts", ".jsx", ".js")]
        if not any(candidate.is_file() for candidate in candidates):
            issues.append(f"Broken lazy route import: {module}")
        named = PATH.search(raw)
        label = named.group(1) if named else ("game" if game_section else "")
        if game_section and label != "game":
            label = f"game/{label}"
        tier = "development" if label.startswith("dev/") or label == "dev" else "production"
        entries.append((label, module, tier))
    return entries, issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Fail for a missing lazy-loaded page")
    args = parser.parse_args()
    entries, issues = audit_routes()
    print(f"Quillairo touchpoint audit: {len(entries)} lazy-loaded route entries")
    print("SOURCE PRESENT means the page exists; actual interaction and appearance need a browser playtest.")
    for label, module, tier in entries:
        print(f"  [{tier:11}] /{label.lstrip('/')} -> {module} [SOURCE PRESENT]")
    for issue in issues:
        print("ISSUE:", issue)
    print(f"Missing lazy route modules: {len(issues)}")
    return int(args.strict and bool(issues))


if __name__ == "__main__":
    raise SystemExit(main())
