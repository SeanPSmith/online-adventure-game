#!/usr/bin/env python3
"""Pass 66.43 — idempotent, guarded minimal patch. Never overwrite full source files."""
import argparse
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
PATCH = BASE / 'scripts/patches/pass66_43.patch'
TARGETS = [
    'app/generation/pacing.py',
    'app/generation/director.py',
    'app/main.py',
    'frontend/src/features/adventure/TurnResolutionTheater.tsx',
    'frontend/src/pages/game/AdventurePage.tsx',
    'frontend/src/pages/game/InkboundLiveRoom.tsx',
    'tests/director/test_pass66_28_act_pacing.py',
    'tests/frontend/test_pass66_28_finale_visible.py',
]

def check(*args):
    return subprocess.run(['git', 'apply', *args, str(PATCH)],cwd=BASE,capture_output=True,text=True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--apply',action='store_true',help='Apply after overlay installation')
    args=ap.parse_args()
    if not PATCH.is_file(): raise SystemExit('Pass 66.43 patch is missing; install overlay first.')
    if check('--reverse','--check').returncode == 0:
        print('PASS: Pass 66.43 is already installed (idempotent).')
        return
    validation=check('--check')
    if validation.returncode:
        raise SystemExit('REFUSED: current source differs from the reviewed baseline. Nothing changed.\n'+validation.stderr)
    print('PASS: all 8 guarded source files match current files.')
    if not args.apply:
        print('Dry run only. Use --apply to install.')
        return
    timestamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    backup=BASE/'.quillairo-patch-backups'/('pass66_43-'+timestamp)
    for name in TARGETS:
        dest=backup/name;dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(BASE/name,dest)
    result=check()
    if result.returncode:
        for name in TARGETS:shutil.copy2(backup/name,BASE/name)
        raise SystemExit('Patch failed; source files restored from backup: '+result.stderr)
    print('PASS: minimal Pass 66.43 source patch applied. Backup: '+str(backup))

if __name__=='__main__':main()
