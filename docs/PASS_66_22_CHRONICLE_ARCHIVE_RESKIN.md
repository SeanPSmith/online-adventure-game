# Pass 66.22 — Live Chronicle archive reskin

Built from `root-review-20261023-105414.zip` with passes 66.18, 66.19,
66.20/66.20 R1 and 66.21 already applied.

## Scope

- `/game/adventures`: player library with saved active/completed/abandoned
  adventure filters, search, continue/recovery links, expandable histories,
  narrator and share controls.
- `/game/history`: completed-story archive using each Hero's saved histories.
- Dedicated, scoped `quillairoChronicleArchivePass6622.css`. Uses existing
  `--ib-*` paper tokens and Pass 66.21 `--qs-accent` accents, including ivory,
  cream, parchment, navy, midnight and the opt-in phosphor edition.
- No new artwork; the approved brand/art assets are retained untouched.

## Preservation contract

No change to backend, Director, rolls, advancement, SSE/socket flow, room
recovery, persistence, sharing, authentication, narrator APIs, history keys,
React data hooks or route definitions. Existing `history-card` / `history-meta`
classes are retained for compatibility. New rules are scoped beneath
`.q22-archive` to avoid altering the live manuscript, lobby, Arcade or admin.

## Verification

Run `python3 -m pytest -q tests/frontend/test_pass66_22_chronicle_archive_reskin.py`.
Full integration/regression/build verification happens in the repo's existing
`./scripts/release-staging.sh` on the user's configured Mac.
