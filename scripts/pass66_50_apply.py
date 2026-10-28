#!/usr/bin/env python3
"""Pass 66.50 — scoped shared modal and route-fallback presentation only.

Run from project root after scripts/install-overlay.sh. Transactional preflight,
source backups, idempotency; no gameplay, socket, Director, or Arcade files.
"""
from __future__ import annotations
import argparse, hashlib, os, shutil, sys
from pathlib import Path

MODAL_OLD='/* All global dialogs are paper-bound, wide enough for real settings and longer text. */\n#modal-root .inkbound-global-dialog.modal-panel{\n  box-sizing:border-box;position:fixed;width:min(960px,calc(100vw - 32px));max-width:none;\n  max-height:calc(100dvh - 32px);margin:auto;padding:0;\n  border:1px solid var(--ib-line)!important;border-radius:1px!important;\n  background:var(--ib-paper)!important;color:var(--ib-text)!important;\n  box-shadow:0 24px 70px rgba(0,0,0,.28)!important;overflow:auto;\n}\n#modal-root .inkbound-global-dialog :is(.panel-heading,.modal-body,.modal-footer){background:transparent!important;border-color:var(--ib-line)!important;color:var(--ib-text)!important}\n#modal-root .inkbound-global-dialog :is(.panel-heading strong,.modal-body h1,.modal-body h2,.modal-body h3){color:var(--ib-text)!important;font-family:var(--ib-serif)}\n#modal-root .inkbound-global-dialog .panel-heading{padding:20px clamp(18px,4vw,44px)}\n#modal-root .inkbound-global-dialog .modal-body{padding:clamp(20px,3vw,42px)}\n#modal-root .inkbound-global-dialog .modal-footer{padding:18px clamp(18px,4vw,44px);flex-wrap:wrap}\n#modal-root .inkbound-global-dialog :is(p,label,span){color:var(--ib-copy)}\n#modal-root .inkbound-global-dialog :is(button,.button,a){color:var(--ib-text);background:transparent;border-color:var(--ib-line);box-shadow:none}\n#modal-root .inkbound-global-dialog :is(.button-primary,.button.button-primary){background:var(--ib-highlight)!important;color:var(--ib-button-ink)!important;border-color:var(--ib-highlight)!important}\n#modal-root .inkbound-global-dialog :is(input,textarea){background:transparent!important;color:var(--ib-text)!important;border:1px solid var(--ib-line)!important;max-width:100%}\n#modal-root .inkbound-global-dialog :is(a,button,input,textarea):focus-visible{outline:2px solid var(--ib-text);outline-offset:3px}\n'
MODAL_NEW='/* Shared Inkscape portal. A dialog is an editorial reading surface, not a\n   terminal window or a fake manuscript page. Scope to the global dialog only:\n   no Adventure theater, Arcade, dice, or other modal implementations. */\n#modal-root .inkbound-global-dialog.modal-panel{\n  box-sizing:border-box;position:fixed;width:min(760px,calc(100vw - 32px));max-width:none;\n  max-height:calc(100dvh - 32px);margin:auto;padding:0;\n  border:1px solid var(--ix-rule,var(--ib-line))!important;border-radius:0!important;\n  background:var(--ix-paper,var(--ib-paper))!important;color:var(--ix-ink,var(--ib-text))!important;\n  box-shadow:0 14px 44px rgba(0,0,0,.22)!important;\n  overflow:auto;overscroll-behavior:contain;\n}\n#modal-root .inkbound-global-dialog :is(.panel-heading,.modal-body,.modal-footer){\n  background:transparent!important;border-color:var(--ix-rule,var(--ib-line))!important;\n  color:var(--ix-copy,var(--ib-copy))!important;\n}\n#modal-root .inkbound-global-dialog .panel-heading{\n  display:flex;align-items:center;justify-content:space-between;gap:18px;\n  padding:clamp(20px,3vw,32px) clamp(20px,4vw,40px) 18px;\n  border-bottom:1px solid var(--ix-rule,var(--ib-line))!important;\n}\n#modal-root .inkbound-global-dialog .panel-heading strong{\n  font:400 clamp(24px,3vw,34px)/1.18 var(--ix-display-font,var(--ib-serif))!important;\n  color:var(--ix-ink,var(--ib-text))!important;\n  letter-spacing:-.025em!important;text-transform:none!important;text-wrap:balance;\n}\n#modal-root .inkbound-global-dialog .panel-heading .icon-button{\n  flex:0 0 44px;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;\n  display:grid;place-items:center;border:0!important;background:transparent!important;\n  color:var(--ix-ink,var(--ib-text))!important;font:400 28px/1 var(--ix-ui-font,var(--ib-serif))!important;\n}\n#modal-root .inkbound-global-dialog .panel-heading .icon-button:hover:not(:disabled){\n  background:var(--ix-wash,var(--ib-wash))!important;\n}\n#modal-root .inkbound-global-dialog .modal-body{\n  padding:clamp(22px,4vw,40px);overflow-wrap:anywhere;\n}\n#modal-root .inkbound-global-dialog .modal-body :is(p,li){\n  max-width:72ch;line-height:1.65;\n}\n#modal-root .inkbound-global-dialog :is(.modal-body,.modal-footer) :is(h1,h2,h3,strong){\n  color:var(--ix-ink,var(--ib-text))!important;\n}\n#modal-root .inkbound-global-dialog .modal-footer{\n  display:flex;justify-content:flex-end;flex-wrap:wrap;gap:12px;\n  padding:18px clamp(20px,4vw,40px);\n  border-top:1px solid var(--ix-rule,var(--ib-line))!important;\n}\n#modal-root .inkbound-global-dialog :is(.modal-footer,.modal-body) :is(button,.button){\n  min-height:44px;max-width:100%;font-family:var(--ix-ui-font,var(--ib-serif));\n  letter-spacing:.045em;box-shadow:none!important;\n}\n#modal-root .inkbound-global-dialog :is(p,label){color:var(--ix-copy,var(--ib-copy))}\n#modal-root .inkbound-global-dialog :is(button,.button,a){\n  color:var(--ix-ink,var(--ib-text));background:transparent;\n  border-color:var(--ix-rule,var(--ib-line));box-shadow:none;\n}\n#modal-root .inkbound-global-dialog :is(.button-primary,.button.button-primary){\n  background:var(--ix-action,var(--ib-highlight))!important;\n  color:var(--ix-action-ink,var(--ib-button-ink))!important;\n  border-color:var(--ix-gold,var(--ib-highlight))!important;\n}\n#modal-root .inkbound-global-dialog :is(input,textarea){\n  background:transparent!important;color:var(--ix-ink,var(--ib-text))!important;\n  border:1px solid var(--ix-rule,var(--ib-line))!important;max-width:100%;\n}\n#modal-root .inkbound-global-dialog :is(a,button,input,textarea):focus-visible{\n  outline:2px solid var(--ix-focus,var(--ib-text));outline-offset:3px;\n}\n'
FRAME_OLD="/* App modals are React/native-dialog, but entirely custom skinned.\n   Don't style the browser chrome or invent native window.alert theming. */\n#modal-root .inkbound-global-dialog.modal-panel {\n  width:min(1040px,calc(100vw - 28px))!important;\n  max-height:calc(100dvh - 28px)!important;\n  overflow-y:auto!important;\n}\n#modal-root .inkbound-global-dialog::backdrop {\n  background:rgba(0,0,0,.64);\n  backdrop-filter:blur(3px);\n}\n"
FRAME_NEW="/* Modal sizing lives in the shared Inkscape foundation; do not reintroduce\n   an oversized width or blur over the user's selected paper edition. */\n#modal-root .inkbound-global-dialog::backdrop {\n  background:rgba(0,0,0,.64);\n}\n"
FALLBACK_ANCHOR='/* Pass 53 QTE follow-through: the fictional consequence sits between the'
FALLBACK_BLOCK='/* Pass 66.50 — production fallback pages use the same Inkscape paper and ink.\n   These routes are outside the authenticated site shells, so paper tokens are\n   owned by the page instead of inheriting the retired terminal globals. */\n.not-found.inkscape-route-state {\n  --ix-page:#f7f3e9;--ix-ink:#28251f;--ix-copy:#514b40;\n  --ix-rule:rgba(48,40,30,.25);--ix-action:#322b21;\n  --ix-action-ink:#f7f3e9;--ix-gold:#986a34;\n  min-height:100dvh;width:100%;margin:0;\n  padding:clamp(36px,8vw,100px) 24px;\n  display:grid;place-content:center;justify-items:center;gap:0;\n  text-align:center;color:var(--ix-ink);\n  background:var(--ix-page);color-scheme:light;\n}\n.not-found.inkscape-route-state[data-ink-paper="cream"] {\n  --ix-page:#eee7d9;--ix-ink:#30291e;--ix-copy:#504433;--ix-gold:#91662f;\n}\n.not-found.inkscape-route-state[data-ink-paper="parchment"] {\n  --ix-page:#d9c6a4;--ix-ink:#33271a;--ix-copy:#413021;--ix-gold:#805621;\n}\n.not-found.inkscape-route-state[data-ink-paper="navy"] {\n  --ix-page:#0b1725;--ix-ink:#f4e9d6;--ix-copy:#ded2bd;\n  --ix-rule:rgba(244,233,214,.28);--ix-action:#f4e9d6;\n  --ix-action-ink:#0b1725;--ix-gold:#d8ae70;color-scheme:dark;\n}\n.not-found.inkscape-route-state[data-ink-paper="midnight"] {\n  --ix-page:#141516;--ix-ink:#f4e9d6;--ix-copy:#e3d8c5;\n  --ix-rule:rgba(244,233,214,.28);--ix-action:#f4e9d6;\n  --ix-action-ink:#141516;--ix-gold:#d8ae70;color-scheme:dark;\n}\n.not-found.inkscape-route-state[data-ink-paper="phosphor"] {\n  --ix-page:#06140c;--ix-ink:#c6f9b1;--ix-copy:#a9dfa1;\n  --ix-rule:rgba(198,249,177,.32);--ix-action:#c6f9b1;\n  --ix-action-ink:#06140c;--ix-gold:#b8d69a;color-scheme:dark;\n}\n.inkscape-route-state .eyebrow {\n  color:var(--ix-gold);font:500 12px/1.4 system-ui,sans-serif;\n  letter-spacing:.16em;text-transform:uppercase;\n}\n.inkscape-route-state h1 {\n  max-width:17ch;margin:20px auto 12px;\n  color:var(--ix-ink);font:400 clamp(36px,6vw,72px)/1.1\n    "Iowan Old Style","Baskerville",Georgia,serif;\n  letter-spacing:-.025em;text-wrap:balance;\n}\n.inkscape-route-state .muted-copy {\n  max-width:58ch;margin:14px auto 34px;color:var(--ix-copy);\n  font:400 clamp(16px,1.5vw,19px)/1.7 Georgia,serif;\n}\n.inkscape-route-state .route-error-actions {\n  gap:12px;justify-content:center;\n}\n.inkscape-route-state :is(.button,.button-primary) {\n  display:inline-flex;align-items:center;justify-content:center;\n  min-height:48px;padding:12px 23px;\n  border:1px solid var(--ix-rule);background:transparent;\n  color:var(--ix-ink);font:600 12px/1.4 system-ui,sans-serif;\n  letter-spacing:.08em;text-transform:uppercase;\n}\n.inkscape-route-state .button-primary {\n  background:var(--ix-action)!important;color:var(--ix-action-ink)!important;\n  border-color:var(--ix-gold)!important;\n}\n.inkscape-route-state :is(.button,a):focus-visible {\n  outline:3px solid var(--ix-gold);outline-offset:4px;\n}\n@media (max-width:520px) {\n  .inkscape-route-state .route-error-actions {width:100%;flex-direction:column;align-items:stretch}\n  .inkscape-route-state .route-error-actions > * {width:100%}\n}\n\n'
NOTFOUND_OLD='import { Link } from "react-router";\n\nexport function NotFoundPage() {\n  return (\n    <main className="not-found" role="main">\n      <span className="eyebrow">404 // UNCHARTED PATH</span>\n      <h1>THIS ROAD LEADS BEYOND THE MAP.</h1>\n      <p className="muted-copy">Even the oldest chronicles hold a few missing pages. The path you followed has vanished, but your adventure has not.</p>\n      <Link className="button button-primary" to="/">RETURN TO THE CROSSROADS</Link>\n    </main>\n  );\n}\n'
NOTFOUND_NEW='import { Link } from "react-router";\nimport { useAuth } from "../state/AuthContext";\nimport { useInkboundPaper } from "../features/appearance/inkboundPaper";\n\nexport function NotFoundPage() {\n  const { user } = useAuth();\n  const [paper] = useInkboundPaper(user?.user_id ?? "");\n  return (\n    <main className="not-found inkscape-route-state" data-ink-paper={paper} role="main">\n      <span className="eyebrow">404 // UNCHARTED PATH</span>\n      <h1>THIS ROAD LEADS BEYOND THE MAP.</h1>\n      <p className="muted-copy">Even the oldest chronicles hold a few missing pages. The path you followed has vanished, but your adventure has not.</p>\n      <Link className="button button-primary" to="/">RETURN TO THE CROSSROADS</Link>\n    </main>\n  );\n}\n'
ERROR_OLD='import { Link, isRouteErrorResponse, useRouteError } from "react-router";\n\nconst CHUNK_LOAD_FAILURE = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .+ failed|unable to preload css/i;\n\nexport function RouteErrorPage() {\n  const error = useRouteError();\n  const isAssetFailure = error instanceof Error && CHUNK_LOAD_FAILURE.test(error.message);\n  const isMissing = isRouteErrorResponse(error) && error.status === 404;\n  const detail = isAssetFailure\n    ? "The path changed while you were traveling, or your connection faltered. Reload to find the latest page. Your saved progress remains with your adventure."\n    : isMissing\n      ? "This part of the map has faded from the Chronicle. Return to the Adventure Hall to find a known path."\n      : "The Chronicle could not open this page. Try again; if the passage stays closed, return to the Adventure Hall.";\n\n  return (\n    <main className="not-found" role="alert">\n      <span className="eyebrow">THE CHRONICLE // A LOST PAGE</span>\n      <h1>THE INK HAS GONE ASTRAY.</h1>\n      <p className="muted-copy">{detail}</p>\n      <div className="route-error-actions">\n        <button className="button button-primary" type="button" onClick={() => window.location.reload()}>\n          TRY THIS PAGE AGAIN\n        </button>\n        <Link className="button" to="/game">\n          RETURN TO ADVENTURE HALL\n        </Link>\n      </div>\n    </main>\n  );\n}\n'
ERROR_NEW='import { Link, isRouteErrorResponse, useRouteError } from "react-router";\nimport { useAuth } from "../state/AuthContext";\nimport { useInkboundPaper } from "../features/appearance/inkboundPaper";\n\nconst CHUNK_LOAD_FAILURE = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .+ failed|unable to preload css/i;\n\nexport function RouteErrorPage() {\n  const error = useRouteError();\n  const { user } = useAuth();\n  const [paper] = useInkboundPaper(user?.user_id ?? "");\n  const isAssetFailure = error instanceof Error && CHUNK_LOAD_FAILURE.test(error.message);\n  const isMissing = isRouteErrorResponse(error) && error.status === 404;\n  const detail = isAssetFailure\n    ? "The path changed while you were traveling, or your connection faltered. Reload to find the latest page. Your saved progress remains with your adventure."\n    : isMissing\n      ? "This part of the map has faded from the Chronicle. Return to the Adventure Hall to find a known path."\n      : "The Chronicle could not open this page. Try again; if the passage stays closed, return to the Adventure Hall.";\n\n  return (\n    <main className="not-found inkscape-route-state" data-ink-paper={paper} role="alert">\n      <span className="eyebrow">THE CHRONICLE // A LOST PAGE</span>\n      <h1>THE INK HAS GONE ASTRAY.</h1>\n      <p className="muted-copy">{detail}</p>\n      <div className="route-error-actions">\n        <button className="button button-primary" type="button" onClick={() => window.location.reload()}>\n          TRY THIS PAGE AGAIN\n        </button>\n        <Link className="button" to="/game">\n          RETURN TO ADVENTURE HALL\n        </Link>\n      </div>\n    </main>\n  );\n}\n'
LEGACY_OLD='width:min(960px,calc(100vw - 32px))'
LEGACY_NEW='width:min(760px,calc(100vw - 32px))'
OPERATIONS = {
  'frontend/src/styles/inkboundSystemPass660.css': ((MODAL_OLD, MODAL_NEW),),
  'frontend/src/styles/inkboundFramePass6610.css': ((FRAME_OLD, FRAME_NEW),),
  'frontend/src/styles/components.css': ((FALLBACK_ANCHOR, FALLBACK_BLOCK + FALLBACK_ANCHOR),),
  'frontend/src/pages/NotFoundPage.tsx': ((NOTFOUND_OLD, NOTFOUND_NEW),),
  'frontend/src/pages/RouteErrorPage.tsx': ((ERROR_OLD, ERROR_NEW),),
  'tests/frontend/test_pass66_0_unified_inkbound.py': ((LEGACY_OLD, LEGACY_NEW),),
}


def transform(path: str, original: str) -> tuple[str,bool]:
    updated=original
    for old,new in OPERATIONS[path]:
        old_count=updated.count(old)
        new_count=updated.count(new)
        if new_count==1 and (old_count==0 or old in new):
            # Insertion operations intentionally retain their old anchor.
            continue
        elif old_count==1 and new_count==0:
            updated=updated.replace(old,new,1)
        else:
            raise RuntimeError(f"{path}: unexpected baseline (old={old_count}, new={new_count}); no files changed")
    return updated, updated!=original


def main():
    ap=argparse.ArgumentParser()
    g=ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--check',action='store_true')
    g.add_argument('--apply',action='store_true')
    args=ap.parse_args()
    root=Path.cwd()
    planned=[]
    # Preflight ALL files before changing ANYTHING.
    try:
        for relative in OPERATIONS:
            target=root/relative
            if not target.is_file() or target.is_symlink():
                raise RuntimeError(f"Missing or unsafe target: {relative}")
            original=target.read_text(encoding='utf-8')
            revised,changed=transform(relative,original)
            planned.append((relative,target,original,revised,changed))
        # Guard that the prior foundation's theme tokens are in place.
        foundation=(root/'frontend/src/styles/inkboundSystemPass660.css').read_text(encoding='utf-8')
        if '/* PASS 66.47 / INKSCAPE FOUNDATION' not in foundation:
            raise RuntimeError('Pass 66.47 Inkscape foundation must be installed first')
    except (OSError,RuntimeError) as exc:
        print(f'REFUSED: {exc}',file=sys.stderr)
        return 2
    changes=sum(item[4] for item in planned)
    if args.check:
        print(f'PASS: 66.50 all six guarded file contracts; {changes} need changes')
        return 0
    if not changes:
        print('PASS: 66.50 already applied; no files changed')
        return 0
    backup_dir=root/'backups'/'pass66_50'
    backed=[]
    try:
        for relative,target,original,revised,changed in planned:
            if not changed: continue
            digest=hashlib.sha256(original.encode()).hexdigest()[:12]
            backup=backup_dir/relative
            backup=backup.with_name(backup.name+'.'+digest+'.bak')
            backup.parent.mkdir(parents=True,exist_ok=True)
            if not backup.exists(): shutil.copy2(target,backup)
            backed.append((target,backup))
        for relative,target,original,revised,changed in planned:
            if not changed: continue
            stage=target.with_name(target.name+'.pass6650.tmp')
            try:
                stage.write_text(revised,encoding='utf-8')
                stage.replace(target)
            finally: stage.unlink(missing_ok=True)
            print(f'PASS: {relative}')
    except Exception as exc:
        for target,backup in reversed(backed):
            shutil.copy2(backup,target)
        print(f'ERROR: change rolled back: {exc}',file=sys.stderr)
        return 2
    print('PASS: 66.50 shared Inkscape dialogs and fallback pages; gameplay source untouched')
    return 0

if __name__=='__main__': raise SystemExit(main())
