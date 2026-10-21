# Pass 66.7.1 — Arcade recovery timer hotfix

## Failure addressed

`node --test scripts/tests/turn-flow.cjs` failed five turn-flow cases with
`ReferenceError: window is not defined` following Pass 66.7. The new
story-ready safety fallback had used `window.setTimeout`, but the deterministic
Node VM test harness deliberately has no DOM or `window` object.

## Repair

- `useTurnTheater.ts` uses a one-shot cancellable `setInterval` (900 ms) for
  the post-countdown rescue instead of `window.setTimeout`. The callback clears
  itself, and the React effect cleanup cancels it if the phase changes.
- The fallback is gated on `story-ready` and a non-preliminary committed receipt.
  It does not roll dice, expose preliminary results, or release the new chapter.
- The regression source contract now requires the platform-neutral guarded timer.
- Two Node tests cover (a) the Arcade never signaling completion and (b) late
  Director retry cancelling the rescue.

## Local verification

- `node --test scripts/tests/turn-flow.cjs`: 16/16 passed.
- `python -m pytest -q tests/frontend/test_pass66_7_live_turn_repair.py`: 5/5 passed in a reconstructed snapshot containing the corresponding CSS overlays.

The complete Vite build, full Python suite, and AWS deployment are left to the
existing `release-staging.sh` pipeline on the user's Mac.
