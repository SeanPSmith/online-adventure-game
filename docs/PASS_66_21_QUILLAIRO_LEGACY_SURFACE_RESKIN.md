# Pass 66.21 — Quillairo shared legacy-surface reskin

Scope: a **CSS-only presentation pass**, plus a stylesheet import and regression tests.
Built against the `root-review-20261023-105414.zip` snapshot with 66.18–66.20 R1 updates.

## Surfaces updated

- Account, author, admin and operations: document/panel headings, controls, tables, records, status cards and developer documentation.
- Arcade **directory** and cabinet information panels, **not the games or their internal controls**.
- Route-level 404 and error screens that render outside the normal branded shell.
- All user-selectable paper palettes: ivory, cream, parchment, navy, midnight, and intentionally retro phosphor.
- Keyboard-visible focus states, accessible native selects, responsive layout and reduced-motion behavior.

## Protected

No changes to Director, persistence, dice, hero mechanics, multiplayer, illustrations, TTS,
any story/lobby/manuscript reader rules, in-cabinet arcade visuals, original logo/artwork,
or compatibility classnames and persisted preference keys.

The older style files still exist where active components import them; deleting those requires
a separate migration audit. This pass **does not claim every visual route has been reskinned**.
The next visual passes should address active game-side secondary panels and authored content
studio after screenshot comparison against approved mockups.

## Validation

`python3 -m pytest -q tests/frontend/test_pass66_21_quillairo_shared_reskin.py`

Complete staging release script remains the authoritative integration test.
