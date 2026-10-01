#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys

from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.admin.content_portability import export_legacy_author_bundle


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Export legacy SQLite Author worlds, briefs, versions, and generated "
            "adventures into a portable JSON bundle."
        )
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=PROJECT_ROOT / "data" / "game_state.sqlite3",
        help="Legacy SQLite database path.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output JSON path. Defaults to backups/author_content_<timestamp>.json.",
    )
    args = parser.parse_args()

    output = args.output

    if output is None:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = PROJECT_ROOT / "backups" / f"author_content_{stamp}.json"

    output.parent.mkdir(parents=True, exist_ok=True)

    bundle = export_legacy_author_bundle(args.database)
    output.write_text(
        json.dumps(bundle, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Exported: {output}")
    print(f"Authors:  {len(bundle['authors'])}")
    print(f"Documents:{len(bundle['documents']):>4}")
    print(f"Versions: {len(bundle['versions']):>4}")
    print(f"Stories:  {len(bundle['generated_adventures']):>4}")
    print("No passwords, sessions, Heroes, or room state were exported.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
