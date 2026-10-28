#!/usr/bin/env python3
"""Pass 66.47: guarded, idempotent edit of existing Inkscape theme foundation.

Never replaces application source files wholesale. No gameplay or React state files touched.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import hashlib
import shutil
import sys

TARGET = Path("frontend/src/styles/inkboundSystemPass660.css")
BEGIN = "/* PASS 66.47 / INKSCAPE FOUNDATION"
END = "/* END PASS 66.47 / INKSCAPE FOUNDATION */"
ANCHOR = "/* Large author links are composition, not another boxed dashboard. */"
FONT_OLD = ".inkbound-system-shell :is(.brand small,.eyebrow,.header-nav a,.header-nav button){color:var(--ib-muted)!important;font-family:var(--ib-mono)}"
FONT_NEW = ".inkbound-system-shell :is(.brand small,.eyebrow,.header-nav a,.header-nav button){color:var(--ib-muted)!important;font-family:var(--ix-ui-font);letter-spacing:.09em}"
BUTTON_OLD = "font-family:var(--ib-mono);box-shadow:none!important;border-radius:0!important;"
BUTTON_NEW = "font-family:var(--ix-ui-font);letter-spacing:.055em;box-shadow:none!important;border-radius:0!important;"

BLOCK = '/* PASS 66.47 / INKSCAPE FOUNDATION\n   Canonical presentation tokens mapped to the six established paper themes.\n   Existing --ib-* variables remain supported for old UI while it migrates.\n   No turn theater, active adventure reader, Arcade board or author API selectors. */\n:where(.inkbound-system-shell,.inkbound-global-dialog) {\n  --ix-paper: var(--ib-paper);\n  --ix-ink: var(--ib-text);\n  --ix-copy: var(--ib-copy);\n  --ix-muted: var(--ib-muted);\n  --ix-rule: var(--ib-line);\n  --ix-wash: var(--ib-wash);\n  --ix-action: var(--ib-highlight);\n  --ix-action-ink: var(--ib-button-ink);\n  --ix-gold: #986a34;\n  --ix-ui-font: "Iowan Old Style", "Baskerville", Georgia, serif;\n  --ix-display-font: var(--ib-serif);\n  --ix-focus: var(--ix-gold);\n}\n:where(.inkbound-system-shell,.inkbound-global-dialog)[data-ink-paper="cream"] { --ix-gold:#91662f; }\n:where(.inkbound-system-shell,.inkbound-global-dialog)[data-ink-paper="parchment"] { --ix-gold:#805621; }\n:where(.inkbound-system-shell,.inkbound-global-dialog)[data-ink-paper="navy"] { --ix-gold:#d8ae70; }\n:where(.inkbound-system-shell,.inkbound-global-dialog)[data-ink-paper="midnight"] { --ix-gold:#d8ae70; }\n:where(.inkbound-system-shell,.inkbound-global-dialog)[data-ink-paper="phosphor"] {\n  --ix-gold:#b8d69a;\n  --ix-ui-font:var(--ib-mono);\n  --ix-display-font:var(--ib-serif);\n}\n\n/* These are SHARED production app controls, not simulated book furniture.\n   Excludes the live reader and the old book preview by design. */\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.page-title h1,.panel-heading strong,.account-section-title) {\n  font-family:var(--ix-display-font);\n  font-weight:400;\n  text-wrap:balance;\n}\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.panel-heading,.form-stack label,.eyebrow) {\n  letter-spacing:.09em;\n  border-color:var(--ix-rule);\n}\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.form-stack input,.form-stack textarea,.form-control,.account-input) {\n  color:var(--ix-ink);\n  background:transparent;\n  border:1px solid var(--ix-rule);\n  min-height:44px;\n  max-width:100%;\n}\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.form-stack input,.form-stack textarea,.form-control,.account-input):focus-visible {\n  outline:2px solid var(--ix-focus);\n  outline-offset:2px;\n}\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.button-primary,.button.button-primary) {\n  border-color:var(--ix-gold)!important;\n  background:var(--ix-action)!important;\n  color:var(--ix-action-ink)!important;\n}\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.button-primary,.button.button-primary):hover:not(:disabled) {\n  outline:1px solid var(--ix-gold);\n  outline-offset:2px;\n}\n.inkbound-system-shell:is(.inkbound-account-shell,.game-site-shell:not(.is-adventure-mode):not(.is-desk-home))\n  :is(.empty-state,.system-notice,.status-line) {\n  border-color:var(--ix-rule);\n  background:var(--ix-wash);\n  color:var(--ix-copy);\n}\n#modal-root .inkbound-global-dialog .panel-heading {\n  border-bottom:1px solid var(--ix-rule)!important;\n  font-family:var(--ix-display-font);\n  letter-spacing:.015em;\n}\n#modal-root .inkbound-global-dialog :is(.button-primary,.button.button-primary) {\n  border-color:var(--ix-gold)!important;\n}\n#modal-root .inkbound-global-dialog :is(a,button,input,textarea):focus-visible {\n  outline-color:var(--ix-focus)!important;\n}\n@media (prefers-reduced-motion:reduce) {\n  .inkbound-system-shell :is(.button,.icon-button),\n  #modal-root .inkbound-global-dialog :is(.button,.icon-button) {\n    transition:none!important;\n  }\n}\n/* END PASS 66.47 / INKSCAPE FOUNDATION */\n'


def update(original: str) -> str:
    if BEGIN in original:
        if END not in original or FONT_NEW not in original or BUTTON_NEW not in original:
            raise RuntimeError("Incomplete or modified Pass 66.47 installation; refusing to overwrite")
        return original
    expected = {ANCHOR:1, FONT_OLD:1, BUTTON_OLD:1}
    for needle, count in expected.items():
        found = original.count(needle)
        if found != count:
            raise RuntimeError(f"Unsafe source difference: expected {count} instance(s) of {needle[:65]!r}, found {found}. Export current full snapshot before modifying.")
    text = original.replace(FONT_OLD,FONT_NEW,1).replace(BUTTON_OLD,BUTTON_NEW,1)
    text = text.replace(ANCHOR, BLOCK+"\n"+ANCHOR,1)
    return text

def main() -> int:
    ap=argparse.ArgumentParser()
    group=ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--check',action='store_true')
    group.add_argument('--apply',action='store_true')
    args=ap.parse_args()
    path=Path.cwd()/TARGET
    if not path.is_file():
        print(f"ERROR: Run this from Quillairo root; missing {TARGET}",file=sys.stderr);return 2
    original=path.read_text(encoding='utf-8')
    try: updated=update(original)
    except RuntimeError as error: print(f"ERROR: {error}",file=sys.stderr);return 2
    if not args.apply:
        print("PASS: Inkscape foundation is compatible" if updated!=original else "PASS: Inkscape foundation is already installed")
        return 0
    if updated==original:
        print("PASS: Inkscape foundation already installed; no changes")
        return 0
    digest=hashlib.sha256(original.encode('utf-8')).hexdigest()[:12]
    backup_dir=Path.cwd()/'backups'/'pass66_47'
    backup_dir.mkdir(parents=True,exist_ok=True)
    backup=backup_dir/f'{TARGET.name}.{digest}.css'
    if not backup.exists(): shutil.copy2(path,backup)
    temp=path.with_name(path.name+'.pass6647.tmp')
    try:
        temp.write_text(updated,encoding='utf-8')
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    print(f"PASS: Applied Inkscape foundation to {TARGET}")
    print(f"Backup: {backup}")
    return 0

if __name__=='__main__':
    raise SystemExit(main())
