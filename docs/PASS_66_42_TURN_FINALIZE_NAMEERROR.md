# Pass 66.42 — post-Director turn-finalization NameError

## Confirmed live failure

The backend logs for turns 21 and 22 show successful `[DIRECTOR COMMIT]` followed immediately by `[TURN FINALIZE ERROR] type=NameError message=name 'utc_now' is not defined`. Story generation works; the missing import in `app/main.py` fails inside `apply_turn_progression`, before the finalized `last_turn_result`, `turn_resolved`, and `game_state` notifications are delivered.

## Repair

Run `python3 scripts/pass66_42_fix_turn_finalize_clock.py --apply` **after** the normal overlay installer and **before** `release-staging.sh`. This inserts exactly `from app.auth.sessions import utc_now` after the existing `app.auth.service` import. It compiles and checks the source first, creates a local backup and applies the change atomically. Repeating the command makes no further changes.

This overlay does not replace the current full `app/main.py` or modify the Director, dice, Arcade, Hero formulas, or frontend. Its regression test exercises the real `apply_turn_progression` function's clock and duplicate-XP event guard.

## Caveat for already-failed turns

Previously committed chapters may lack `last_turn_result` / finalized progression, because the old code failed between the Director commit and the receipt write. This fix prevents the exception on **future** turns; it does not reconstruct old receipts or retroactively apply lost progression. Investigate saved room histories separately before attempting any historical recovery, to avoid rerolls or duplicate awards.

## Release command

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_42_turn_finalize_clock_hotfix.zip \
  && python3 scripts/pass66_42_fix_turn_finalize_clock.py --apply \
  && ./scripts/release-staging.sh
```
