# Pass 66.43 — Cinematic Turn & Length-Bounded Endings

## Changes
- Reuses the current server-authored D20, receipt, consequences and chapter acknowledgment.
- Inkspace-only result theater displays *one full-screen stage at a time*: D20, consequences, next page. Crossfades use presentation-only timers. Classic reader stays unchanged.
- Short/medium/long/epic SOLO adventures now complete on their existing 16/26/40/52-turn cap, with an actual final resolved Hero choice and server-generated epilogue. Existing longer stories conclude on the next committed turn.
- Player-initiated wrap-up now completes on the next resolved turn; co-op consent remains unanimous. Finale control appears before choice cards.
- No mechanical rerolls, invented receipts or side effects; completion uses existing persistence and Hero advancement.

## Scope
- Eight existing files modified via guarded `git apply`, *not* older whole-file ZIP replacements.
- One additional scoped CSS file, one new regression module, script and release notes.
- Precondition: Pass 66.42 already installed, including the `utc_now` fix. Do not revert that patch.

## Apply
`bash scripts/install-overlay.sh ../assets/AWS/pass66_43_quillairo_cinematic_and_finales.zip && python3 scripts/pass66_43_apply.py --apply && ./scripts/release-staging.sh`

## Validation
Unit/regression checks are not a substitute for playing through the final decision. Test a solo short story and verify a completion screen at or before turn 16. Test two-player approval independently; test the D20 -> aftermath -> next page transition in light/dark modes and on mobile. Changes do not retroactively mark previously completed/abandoned room state as finished.
