# Pass 66.38 — Committed Dice Visibility and Live Turn Diagnostics

## Bug class

Socket rejoining can reset the local turn-theater state *after* a saved,
committed game state has already been processed. Without a second receipt
processing pass, the Arcade remains visible until a hard refresh even though
`last_turn_result` and the next chapter are already persisted.

## Fix

- Reconcile the persisted non-preliminary, matching-room receipt again on
  `resumeEpoch`, phase and saved snapshot transitions. Do not invent a roll.
- Preserve the established three-second intermission closure, server-authored
  dice, consequences and explicit Continue action.
- Keep the Arcade status/recovery strip always visible; display the server's
  actual current activity status and show a clear notice at the dice stage.
- Emit a compact `[Quillairo Turn]` console trace for sync attempts, snapshots,
  commit events, rejoin and dice presentation. No story text or tokens logged.

## Acceptance test (authenticated staging)

1. Open Chrome DevTools Console. Filter for `[Quillairo Turn]` (without the
   brackets if your console filter interprets regex syntax).
2. Lock a choice. Confirm the UI reports Director writing and the console
   reports the pending server snapshot.
3. Without refreshing, wait for a committed `game_state` or `turn_resolved`.
   The Arcade must close; the D20 result modal must open; then acknowledge
   consequences to reveal the next chapter. Repeat over several turns.
4. During a second turn, click **Check saved chapter**, then **Rejoin story**
   to confirm the saved receipt survives a rejoin. No new dice roll.
5. If a stall remains, copy ONLY `[Quillairo Turn]` console lines and the time
   displayed at the top of the Arcade (never tokens or cookies). Interpret:
   - `pending=true`, `directorActive=true`: server is still writing.
   - `pending=true`, `directorActive=false`: server generation needs retry.
   - `pending=false`, `savedReceiptTurn=N`: committed story exists;
     this is a client presentation/reconciliation defect if dice remain hidden.
   - no `game_state` after a sync: socket room binding is missing; client rejoin
     should run after the five-second watchdog.

## Scope and limits

This is an incremental reliability patch based on the full-source snapshot and
66.17–66.37 overlays. Full staging authentication and live browser acceptance
must still occur on the user's deployment. A passing offline test does not
prove that the AWS server's currently deployed workers are healthy.
