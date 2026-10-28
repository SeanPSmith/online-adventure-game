#!/usr/bin/env python3
"""Pass 66.52r3: presentation-only Inkscape archive patch; no JSX rewriting.

The 66.52 and R1/R2 installers rejected valid JSX layouts or crashed while
probing TypeScript. R3 never inspects or rewrites JSX. Archive styles attach
to semantic `.history-grid` markup via CSS; only safe imports and inert copy
may change in these pages. All gameplay logic and callbacks remain untouched.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import re
import sys

CSS_FILE = 'frontend/src/pages/game/inkscapeArchivePass6652.css'
CSS_SHA = '1f398241202f5553b506b831283768fb2cd6e782492c651c4e07d311ffa97693'
JOURNEYS = 'frontend/src/pages/game/MyAdventuresPage.tsx'
CHRONICLES = 'frontend/src/pages/game/HistoryPage.tsx'
HERO = 'frontend/src/pages/heroes/HeroManagerPage.tsx'
HERO_CSS = 'frontend/src/pages/heroes/quillairoHeroArchivePass6615.css'
FILES = (JOURNEYS, CHRONICLES, HERO, HERO_CSS)

class SourceMismatch(Exception):
    pass


def required(source: str, names: tuple[str, ...], path: str) -> None:
    missing = [name for name in names if name not in source]
    if missing:
        raise SourceMismatch(f'{path}: expected live page contract missing: {missing}')


def ensure_style_import(source: str, path: str) -> str:
    marker = 'import "./inkscapeArchivePass6652.css";'
    if marker in source or "import './inkscapeArchivePass6652.css';" in source:
        return source
    first = re.search(r'^import\s[^;]*;\s*', source, flags=re.M)
    if not first:
        raise SourceMismatch(f'{path}: no top-level module import to attach archive stylesheet')
    return source[:first.end()] + '\n' + marker + '\n' + source[first.end():]


def patch_archive(source: str, path: str, scope: str, eyebrow: str, contracts: tuple[str, ...]) -> str:
    required(source, contracts, path)
    # Pages already expose semantic archive classes. Never rewrite JSX merely
    # for CSS scoping: the stylesheet uses `.game-main:has(.history-grid)` instead.
    source = ensure_style_import(source, path)
    for old, new in (
        ('title="MY ADVENTURES"', 'title="My adventures"'),
        ('<Panel title="YOUR JOURNEYS">', '<Panel title="Your journeys">'),
        ('OPENING YOUR LIBRARY_', 'Opening your adventure archive…'),
        ('title="SEALED CHRONICLES"', 'title="Sealed Chronicles"'),
        ('<Panel title="COMPLETED JOURNEYS">', '<Panel title="Completed journeys">'),
        ('DUSTING OFF THE ARCHIVE_', 'Gathering your completed Chronicles…'),
        ('NO TALES TO TELL. YET.', 'No completed stories yet.'),
    ):
        if old in source:
            source = source.replace(old, new)
    return source


def patch_hero(source: str) -> str:
    required(source, ('getHeroPortraits(', 'setHeroDisposition(', 'deleteCharacter('), HERO)
    return source.replace('AN OPEN BOOK OF LIVES', 'THE HERO REGISTER')


def patch_hero_css(source: str) -> str:
    required(source, ('.qh15-card-image', '.qh15-filter-tabs button', '.qh15-card-actions>button'), HERO_CSS)
    pairs = (
        ('--qh15-mono:var(--ib-mono,"American Typewriter","Courier New",monospace);',
         '--qh15-mono:var(--ix-ui-font,var(--ib-serif,Georgia,serif));'),
        ('/* The approved six papers share layout, with contrast inherited from their theme tokens. */\n'
         '[data-ink-paper="navy"] .qh15-sheet-portrait-frame>img,[data-ink-paper="midnight"] .qh15-sheet-portrait-frame>img,[data-ink-paper="navy"] .qh15-card-image>img:not(.qh15-card-emblem),[data-ink-paper="midnight"] .qh15-card-image>img:not(.qh15-card-emblem){filter:invert(1) grayscale(1)}\n'
         '[data-ink-paper="phosphor"] .qh15-sheet-portrait-frame>img,[data-ink-paper="phosphor"] .qh15-card-image>img:not(.qh15-card-emblem){filter:invert(1) grayscale(1) sepia(1) hue-rotate(53deg)}',
         '/* Keep privately selected character art unfiltered across every paper theme.\n'
         '   Only the decorative fallback monogram receives optional contrast treatment. */'),
        ('.qh15-filter-tabs button{border:1px solid transparent;background:transparent;padding:9px 12px;color:var(--qh15-muted)!important;font:12px var(--qh15-mono);text-transform:capitalize;cursor:pointer}',
         '.qh15-filter-tabs button{border:1px solid transparent;background:transparent;padding:11px 12px;min-height:44px;color:var(--qh15-muted)!important;font:600 13px/1.45 var(--qh15-mono);text-transform:capitalize;cursor:pointer}'),
        ('.qh15-card-actions>button{border:0;background:transparent;color:var(--qh15-muted)!important;font:12px var(--qh15-mono);cursor:pointer;padding:7px 0}',
         '.qh15-card-actions>button{border:0;background:transparent;color:var(--qh15-muted)!important;font:500 13px/1.5 var(--qh15-mono);cursor:pointer;padding:12px 0;min-height:44px}'),
    )
    for old, new in pairs:
        if old in source:
            source = source.replace(old, new)
    return source


def update(path: str, original: str) -> str:
    if path == JOURNEYS:
        return patch_archive(original, path, 'ix52-journeys', '"YOUR STORY LIBRARY"',
                             ('apiFetch<Library>', 'PageTitle', 'Panel', 'history-card', 'ShareMomentButton', 'ArchivedChronicleAudio', 'row.director_retry_required'))
    if path == CHRONICLES:
        return patch_archive(original, path, 'ix52-chronicles', '"ARCHIVE"',
                             ('listCharacterStories(', 'PageTitle', 'Panel', 'history-card', 'ShareMomentButton', 'ArchivedChronicleAudio'))
    if path == HERO:
        return patch_hero(original)
    if path == HERO_CSS:
        return patch_hero_css(original)
    raise SourceMismatch(f'Unexpected path: {path}')


def main() -> int:
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    root = Path.cwd()
    css = root / CSS_FILE
    if not css.is_file() or hashlib.sha256(css.read_bytes()).hexdigest() != CSS_SHA:
        print('REFUSED: the 66.52 stylesheet is missing or changed', file=sys.stderr)
        return 2
    staged = []
    try:
        for relative in FILES:
            target = root / relative
            original = target.read_text(encoding='utf-8')
            changed = update(relative, original)
            if changed != original:
                staged.append((relative, target, original, changed))
    except (OSError, SourceMismatch) as error:
        print(f'REFUSED: {error}', file=sys.stderr)
        return 2
    if args.check:
        print(f'PASS: 66.52r3 source preflight ({len(staged)}/{len(FILES)} presentation files to patch)')
        return 0
    backup = root / 'backups' / 'pass66_52'
    backup.mkdir(parents=True, exist_ok=True)
    for relative, _target, original, _changed in staged:
        name = relative.replace('/', '__') + '.' + hashlib.sha256(original.encode()).hexdigest()[:12] + '.bak'
        if not (backup / name).exists():
            (backup / name).write_text(original, encoding='utf-8')
    temporary = []
    replaced = []
    try:
        for relative, target, original, changed in staged:
            temp = target.with_name('.' + target.name + '.pass6652r3.tmp')
            temp.write_text(changed, encoding='utf-8')
            temporary.append(temp)
            temp.replace(target)
            replaced.append((target, original))
    except OSError as error:
        for target, original in reversed(replaced):
            target.write_text(original, encoding='utf-8')
        print(f'REFUSED: patch write failed and restored original source: {error}', file=sys.stderr)
        return 3
    finally:
        for temp in temporary:
            if temp.exists():
                temp.unlink()
    print(f'PASS: 66.52r3 updated {len(staged)} presentation files; no gameplay files modified.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
