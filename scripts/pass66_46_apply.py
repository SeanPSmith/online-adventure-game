#!/usr/bin/env python3
"""Pass 66.46: safe Hero Creator/Hero Sheet code patch (repeat-safe, no full-file overwrite)."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / 'scripts/patches/pass66_46.patch'
TARGETS = ('frontend/src/pages/heroes/HeroCreatePage.tsx', 'frontend/src/pages/heroes/HeroSheetPage.tsx')
REQUIRED = ('frontend/src/pages/heroes/heroQuestionnaire.ts', 'frontend/src/pages/heroes/quillairoHeroQuizPass6646.css')

def check(*args):
    return subprocess.run(['git','apply',*args,str(PATCH)],cwd=ROOT,capture_output=True,text=True)

def main():
    if sys.argv[1:] != ['--apply']:
        raise SystemExit('Usage: python3 scripts/pass66_46_apply.py --apply')
    if any(not (ROOT / p).is_file() for p in REQUIRED):
        raise SystemExit('ERROR: Install overlay ZIP before applying patch.')
    if check('--reverse','--check').returncode == 0:
        print('PASS: Pass 66.46 code changes already installed.')
        return
    verification = check('--check')
    if verification.returncode:
        raise SystemExit('STOP: Hero Creator or Hero Sheet differs from audited baseline. No files modified.\n' + verification.stderr)
    backup=ROOT/'.quillairo_backups'/'pass66_46'
    for name in TARGETS:
        dest=backup/name
        dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists():
            shutil.copy2(ROOT/name,dest)
    result=check('--whitespace=nowarn')
    if result.returncode:
        for name in TARGETS:
            shutil.copy2(backup/name,ROOT/name)
        raise SystemExit('STOP: Patch failed; originals restored.\n'+result.stderr)
    assert check('--reverse','--check').returncode==0
    print('PASS: Installed guided Hero Creator and profile crop; originals backed up.')

if __name__ == '__main__': main()
