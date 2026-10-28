# Pass 66.47 — Inkscape foundation / non-gameplay surfaces

**Purpose:** Consolidate a small but foundational portion of the active Inkscape design *inside the existing shared CSS*, rather than introducing another parallel theme stylesheet. This is an incremental consolidation pass, not a declaration of pixel-perfect parity.

## Scope
- Adds semantic `--ix-*` presentation aliases mapped to the existing six `--ib-*` paper themes, including restrained antique-gold accents.
- Changes the shared non-gameplay header/button typography from inherited typewriter to an editorial serif UI font (phosphor intentionally keeps monospace).
- Aligns existing panel headings, form controls, focus indicators, notices, primary button trim, and shared modal headers.
- Does not touch global terminal tokens, active adventure reader, turn theater, Arcade graphics, Director, Socket.IO, Hero progression or storage/API contracts.
- Preserves the existing `--ib-*` and `--ia-*` names to avoid breaking older components.

## Install
From Quillairo `root`:

```sh
bash scripts/install-overlay.sh ../assets/AWS/pass66_47_inkscape_shared_foundation.zip \
&& python3 scripts/pass66_47_apply.py --apply \
&& ./scripts/release-staging.sh
```

The apply operation checks exact source anchors, makes a timestamp-safe hash-named backup, and is idempotent. It refuses unrecognized changes to the guarded source. The installer merely adds the script/tests/docs; application source is updated by the guarded apply step.

## Verify after deploy
Review Account/Profile/Preferences, Hero Hall, Adventure Hall, author entry, and shared dialogs on ivory/navy/mobile; confirm the new editorial font and gold focus/outline, and that all existing controls function. The arcade, dice theater, and active manuscript should look/behave exactly as before. This CSS-only pass does not verify visual match against every mockup; that requires logged-in browser screenshots.
