# Pass 66.25 — Quillairo's existing intermission, one visual language

This is a **presentation/refactor pass**, not a new turn or Arcade system.

## What changed

- `StoryTurnProgress` is extracted **inside the existing** `InkboundWaitingFolio.tsx` module, and reused in the existing live Arcade view. It displays only phases derived from `storyReady`; it does not predict how long generation will take.
- The **existing** `IntermissionRuntime.tsx` receives manuscript masthead, less terminal-heavy status copy when an `inkPaper` is active, and a scoped wrapper class. Its `ArcadeGame`, score submission, winner logic, skip action, countdown, and room sync remain intact. Classic mode still uses its established labels and layout.
- One stylesheet (`quillairoIntermissionPass6625.css`) styles *only the paper-themed container and controls*; the individual published Arcade games and feedback canvas styles are completely untouched. Its `--ia-*` palette and `--q24-gold` accent are inherited from the currently selected paper edition (including navy/midnight/phosphor).

## Invariants

1. `useTurnTheater.ts`, `TurnTheater.tsx`, `TurnResolutionTheater.tsx`, game registry, Director, sockets, and any persistence/roll paths **not changed**.
2. No new fabricated story events, dice, countdowns, effects or completion criteria.
3. Live Arcade never blocks the Director and its score is still the real server-submitted score.
4. Waiting manuscript reuses the same semantic progress indicator; retry and room re-sync stay wired.
5. Mobile intermission is scrollable and keeps the existing game area functional. Reduced-motion users retain static progress.
6. Source reference: latest full project snapshot `root-review-20261023-105414.zip` plus passes 66.18–66.24, not an old standalone file.

## Verification

- Run `python3 -m pytest -q tests/frontend/test_pass66_25_intermission_folio_reuse.py tests/frontend/test_pass66_3_intermission_waiting.py tests/frontend/test_pass66_24_chronicle_receipt.py`
- Then run normal `bash scripts/install-overlay.sh ../assets/AWS/pass66_25_quillairo_intermission_folio_reuse.zip && ./scripts/release-staging.sh` from `root`.
- Check active Arcade play, Skip, submitted-score waiting, Story Ready, slow-Director Re-sync, dice result, and chapter transition in ivory and navy on desktop and mobile.
