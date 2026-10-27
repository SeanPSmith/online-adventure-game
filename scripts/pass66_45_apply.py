#!/usr/bin/env python3
"""Pass 66.45: guarded Inkspace Atlas/Lobby markup patch, no gameplay files."""
from __future__ import annotations
import argparse
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PATCH=ROOT/'scripts/patches/pass66_45.patch'
TARGETS=(
 'frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx',
 'frontend/src/pages/game/InkboundLobby.tsx',
)

def check(*args: str) -> subprocess.CompletedProcess[str]:
 return subprocess.run(['git','apply',*args,str(PATCH)],cwd=ROOT,capture_output=True,text=True)

def main() -> None:
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--apply',action='store_true',help='Apply only after successful guarded validation')
 args=ap.parse_args()
 if not PATCH.is_file():raise SystemExit('ERROR: install Pass 66.45 overlay before applying patch.')
 if check('--reverse','--check').returncode==0:
  print('PASS: Pass 66.45 source changes are already installed.')
  return
 chk=check('--check')
 if chk.returncode:
  raise SystemExit('REFUSED: project sources do not match Pass 66.44 baseline. No source changed.\n'+chk.stderr)
 for name in ('quillairoAtlasPass6645.css','quillairoLobbyPass6645.css'):
  if not (ROOT/'frontend/src/pages/game'/name).is_file():
   raise SystemExit('ERROR: missing stylesheet '+name)
 if not args.apply:
  print('PASS: Pass 66.45 guards match. Run --apply to install.')
  return
 backup=ROOT/'.quillairo-patch-backups'/('pass66_45-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
 for filename in TARGETS:
  dest=backup/filename;dest.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(ROOT/filename,dest)
 result=check()
 if result.returncode:
  for filename in TARGETS:shutil.copy2(backup/filename,ROOT/filename)
  raise SystemExit('ERROR: patch failed; original files restored: '+result.stderr)
 if check('--reverse','--check').returncode:
  raise SystemExit('ERROR: patch did not verify; inspect '+str(backup))
 print('PASS: Pass 66.45 Inkspace Atlas/Lobby layout installed; backup: '+str(backup))

if __name__=='__main__':main()
