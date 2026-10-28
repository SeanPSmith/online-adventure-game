#!/usr/bin/env python3
"""Guarded, idempotent Inkscape art-direction polish; no gameplay files touched.

Run from Quillairo root after install-overlay.sh, with --check or --apply.
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

REPLACEMENTS: dict[str, tuple[tuple[str, str], ...]] = {
    "frontend/src/pages/public/PublicHomePage.tsx": (
        ('A LIVING STORYBOOK · SOLO OR CO-OP', 'AI-POWERED ADVENTURES · SOLO OR CO-OP'),
        ('A living storybook,<br /><em>written with you.</em>', 'Living adventures,<br /><em>written as you play.</em>'),
        ('          <span className="qpub-hero-note">YOUR HERO. YOUR CHOICES. AN UNWRITTEN ROAD.</span>\n', ''),
    ),
    "frontend/src/styles/quillairoPublicPass6612.css": (
        ('letter-spacing:.27em!important;color:var(--q-sub)', 'letter-spacing:.16em!important;color:var(--q-sub)'),
        ('max-width:530px;font-size:clamp(16px,1.25vw,19px)', 'max-width:490px;font-size:clamp(16px,1.25vw,19px)'),
        ('z-index:1;right:-5.5%;top:50%;width:70%', 'z-index:1;right:-4%;top:50%;width:68%'),
        ('transition:background-color .18s ease,border-color .18s ease,transform .18s ease', 'transition:background-color .18s ease,border-color .18s ease'),
        ('.qpub-button:hover:not(:disabled){transform:translateY(-1px);border-color:var(--q-gold)!important}', '.qpub-button:hover:not(:disabled){border-color:var(--q-gold)!important}'),
        ('.qpub-world-card{min-width:0;border:1px solid var(--q-rule);padding:0 0 22px;background:var(--q-paper2)}', '.qpub-world-card{min-width:0;border:1px solid var(--q-rule);padding:0 0 22px;background:transparent}'),
        ('object-fit:cover;display:block;filter:grayscale(.55)', 'object-fit:cover;display:block'),
        ('.qpub-hero-note{margin-top:22px}\n', ''),
        ('letter-spacing:.21em!important}\n .qpub-cta-pair', 'letter-spacing:.16em!important}\n .qpub-cta-pair'),
    ),
    "frontend/src/pages/game/inkboundAuthenticatedDashboard.css": (
        ('--paper-type:"American Typewriter","Courier Prime","Courier New",monospace;', '--paper-type:"Iowan Old Style","Baskerville","Palatino Linotype",Georgia,serif;'),
        (" --paper-grain:url('/art/inkbound/paper-grain.png');\n", ''),
        ('.inkbound-home[data-ink-paper="phosphor"]{--paper:#06140c;--paper-text:#c6f9b1;--paper-copy:#a9dfa1;--paper-dim:#94bf8b;--paper-rule:rgba(201,255,184,.25);--paper-strong-rule:rgba(201,255,184,.43);color-scheme:dark}', '.inkbound-home[data-ink-paper="phosphor"]{--paper:#06140c;--paper-text:#c6f9b1;--paper-copy:#a9dfa1;--paper-dim:#94bf8b;--paper-rule:rgba(201,255,184,.25);--paper-strong-rule:rgba(201,255,184,.43);--paper-type:ui-monospace,SFMono-Regular,Menlo,monospace;color-scheme:dark}'),
        ('letter-spacing:.175em;text-transform:uppercase', 'letter-spacing:.125em;text-transform:uppercase'),
        ('min-height:53px;font:600 15px var(--paper-type)!important;letter-spacing:.015em', 'min-height:53px;font:500 15px var(--paper-type)!important;letter-spacing:.055em'),
        ('.i656-hero-meta{font:11px var(--paper-type)', '.i656-hero-meta{font:12px var(--paper-type)'),
        ('object-fit:cover;filter:grayscale(1);transition:transform .25s ease', 'object-fit:cover;transition:transform .25s ease'),
        ('.i656-world-cover:hover img{transform:scale(1.025)}', '.i656-world-cover:hover img{transform:none}'),
    ),
    "frontend/src/pages/game/quillairoAtlasPass6645.css": (
        ('--q45-surface:rgba(255,252,244,.38);', '--q45-surface:transparent;'),
        ('--q45-surface:rgba(255,248,231,.26);', '--q45-surface:transparent;'),
        ('--q45-surface:rgba(255,255,255,.035);', '--q45-surface:transparent;'),
        ('--q45-surface:rgba(169,204,129,.04);', '--q45-surface:transparent;'),
        ('.inkbound-home .i656-world:hover .i656-world-cover img{transform:translateY(-3px) scale(1.012)}', '.inkbound-home .i656-world:hover .i656-world-cover img{transform:none}'),
        ('.inkbound-home .i656-dialog:before{\n  content:"";\n  pointer-events:none;\n  position:absolute;\n  inset:8px;\n  border:1px solid var(--paper-rule);\n}\n', ''),
    ),
    "tests/frontend/test_public_shell.py": (
        ('assert "A living storybook" in home', 'assert "Living adventures" in home'),
        ('assert "A LIVING STORYBOOK" in home', 'assert "AI-POWERED ADVENTURES" in home'),
    ),
}


def transform(path: str, data: str) -> tuple[str, bool]:
    result = data
    changed = False
    for old, new in REPLACEMENTS[path]:
        count = result.count(old)
        if count == 1:
            result = result.replace(old, new, 1)
            changed = True
        elif count == 0 and (new == '' and old not in result or new and result.count(new) >= 1):
            # For deletions, look for a second reliable indicator below before accepting.
            if not new and path == 'frontend/src/pages/public/PublicHomePage.tsx' and 'Living adventures,' not in result:
                raise RuntimeError(f'{path}: deletion missing but prior revision not verified')
            if not new and path == 'frontend/src/pages/game/quillairoAtlasPass6645.css' and '--q45-surface:transparent;' not in result:
                raise RuntimeError(f'{path}: deletion missing but prior revision not verified')
            continue
        else:
            raise RuntimeError(f'{path}: expected one original or one updated occurrence of {old[:80]!r}; found {count}')
    if path == "frontend/src/pages/game/quillairoAtlasPass6645.css" and result.count("--q45-surface:transparent;") != 4:
        raise RuntimeError("Atlas has incomplete theme-surface conversion")
    return result, changed


def main() -> int:
    ap=argparse.ArgumentParser()
    action=ap.add_mutually_exclusive_group(required=True)
    action.add_argument('--check',action='store_true')
    action.add_argument('--apply',action='store_true')
    args=ap.parse_args()
    root=Path.cwd()
    staged=[]
    for relative in REPLACEMENTS:
        file=root/relative
        if not file.is_file():
            print(f'ERROR missing {relative}. Apply the relevant earlier passes first.',file=sys.stderr)
            return 2
        raw=file.read_text(encoding='utf-8')
        try:
            updated,changed=transform(relative,raw)
        except RuntimeError as exc:
            print(f'ERROR refusing unexpected source: {exc}',file=sys.stderr)
            return 2
        staged.append((file,relative,raw,updated,changed))
    if args.check:
        print(f'PASS: Inkscape art-direction compatibility; {sum(x[4] for x in staged)} source files need update')
        return 0
    backup_dir=root/'backups'/'pass66_49'
    backup_dir.mkdir(parents=True,exist_ok=True)
    for file,relative,raw,updated,changed in staged:
        if not changed: continue
        digest=hashlib.sha256(raw.encode()).hexdigest()[:12]
        backup=backup_dir/(file.name+'.'+digest+'.bak')
        if not backup.exists(): shutil.copy2(file,backup)
        tmp=file.with_name(file.name+'.pass6649.tmp')
        try:
            tmp.write_text(updated,encoding='utf-8')
            tmp.replace(file)
        finally:
            tmp.unlink(missing_ok=True)
        print(f'PASS: {relative} ({len(raw)-len(updated):+d} chars removed)')
    print('PASS: Inkscape 66.49 art-direction polish; gameplay files untouched')
    return 0

if __name__=='__main__': raise SystemExit(main())
