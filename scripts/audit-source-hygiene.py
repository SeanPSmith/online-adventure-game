#!/usr/bin/env python3
"""Audit Quillairo's import paths, explicit art/brand URLs and duplicate assets.

This is a static-source safeguard, not proof an asset is unused: images may be
loaded from saved themes, runtime configuration, or remotely generated content.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from collections import defaultdict
from pathlib import Path

IMPORT_RE = re.compile(r'''(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["'](\.[^"'\n]+)["']''')
ASSET_RE = re.compile(r'''["'(](/(?:art|brand)/[a-zA-Z0-9_./-]+\.(?:png|webp|jpe?g|gif|svg|ico|json))(?=["')?#])''')
EXTENSIONS = ("", ".ts", ".tsx", ".js", ".jsx", ".css", ".json", "/index.ts", "/index.tsx")


def audit(root: Path) -> tuple[list[str], list[list[str]], int]:
    source = root / "frontend/src"
    public = root / "frontend/public"
    issues = []
    asset_refs: set[str] = set()
    source_files = [p for p in source.rglob('*') if p.suffix in ('.ts', '.tsx', '.js', '.jsx', '.css') and p.is_file()]
    for path in source_files:
        content = path.read_text(encoding='utf-8', errors='replace')
        for module in IMPORT_RE.findall(content):
            # Dynamic templates and glob patterns are not static-import paths.
            if '${' in module or '*' in module:
                continue
            base = (path.parent / module)
            if not any(Path(str(base) + extension).is_file() for extension in EXTENSIONS):
                issues.append(f"Missing relative module: {path.relative_to(root)} -> {module}")
        asset_refs.update(ASSET_RE.findall(content))
    for path in (root / "frontend/index.html", *public.rglob("*.html"), *public.rglob("*.json")):
        if path.is_file():
            asset_refs.update(ASSET_RE.findall(path.read_text(encoding='utf-8', errors='replace')))
    for uri in sorted(asset_refs):
        if not (public / uri.lstrip('/')).is_file():
            issues.append(f"Missing explicit asset: {uri}")
    by_digest = defaultdict(list)
    for path in public.rglob('*'):
        if path.is_file() and path.suffix.lower() in {'.png', '.webp', '.jpg', '.jpeg', '.svg', '.ico'}:
            by_digest[hashlib.sha256(path.read_bytes()).hexdigest()].append(str(path.relative_to(public)))
    duplicates = [sorted(group) for group in by_digest.values() if len(group) > 1]
    return issues, sorted(duplicates), len(asset_refs)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--strict', action='store_true', help='Return nonzero if a static path cannot be resolved')
    args = parser.parse_args()
    root = args.root.resolve()
    if not (root / 'frontend/src/main.tsx').is_file():
        parser.error('Not a Quillairo source checkout')
    issues, duplicates, paths = audit(root)
    print(f'Quillairo source audit: {paths} literal art/brand URLs checked; {len(issues)} missing references')
    for issue in issues:
        print('ISSUE:', issue)
    print(f'{len(duplicates)} byte-identical public asset groups (retained for URL compatibility):')
    for group in duplicates:
        print('  ', ' == '.join(group))
    print('Active legacy routes and /static web client are deliberately retained.')
    return 1 if issues and args.strict else 0


if __name__ == '__main__':
    raise SystemExit(main())
