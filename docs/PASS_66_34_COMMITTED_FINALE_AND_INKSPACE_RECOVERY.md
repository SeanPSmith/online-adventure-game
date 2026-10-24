# Pass 66.34 — Committed-turn recovery and stable Inkspace styling

## Baseline

Built from the Quillairo full review snapshot `root-review-20261023-105414.zip`, replaying the cumulative Pass 66.17 R1 through Pass 66.33 overlays in installation order. No backend, Director, dice-resolution, HP/XP, Socket.IO, or Arcade source is replaced in this pass.

## Root cause (confirmed)

`GameSession.commit_director_turn()` deliberately keeps `session.turn_number` equal to `resolved_turn` for a completed adventure. Ordinary turns advance to `resolved_turn + 1`. Previously the browser waited for `game.turn_number > resolvedTurnNumber(committed)` even on the completed turn, meaning the final authoritative receipt could be saved but never presented. `useTurnTheater` now accepts either a nonpending, advanced ordinary turn **or** a nonpending, `director_complete` finale whose turn number is unchanged. Preliminary receipts remain hidden.

## Presentation and recovery

- The animated dice still reveal only the server's committed D20 value. Initial animation frames no longer flash the known result early.
- Result progression no longer invokes nested React state updates from the functional state setter.
- If a dice animation remains incomplete after eight seconds, an accessible button can reveal the already-saved results and consequences. It never requests an extra roll, modifies progression, or skips the server's final receipt.
- An Inkspace-mode adventure keeps its selected paper in turn, quick-event, and level-up overlays even during a socket reconnect. Style selection is no longer derived from `live.status === 'ready'`.
- Removed the CRT scanline pseudo-element and terminal-overlay tint from the **Inkspace** receipt; the optional Classic and Phosphor modes remain supported.

## Regression coverage

`tests/frontend/test_pass66_34_committed_turn_and_inkspace.py` checks the actual server finale contract, client committed receipt condition, safety checks for preliminary receipts, dice recovery path, and CSS isolation. Three older source-contract tests were updated to recognize the persistent paper selector, rather than its old readiness-dependent expression.

## Release validation

- `python -m pytest -q tests/frontend tests/adventures tests/authoring tests/admin` in the build container: **531 passed, 1 skipped, 9 blocked** by missing `python-socketio` (no other failures).
- Relevant focused regression modules: **16 passed** before the theme adjustment, with **11 passing** targeted after the adjustment.
- All available `.cjs` frontend regression scripts passed.
- Changed TypeScript/TSX files transpile without syntax errors using TypeScript.
- `tinycss2` stylesheet parse: no errors.
- Full Vite production build unavailable in this sandbox: npm's offline cache is incomplete, and the container's Node 22.16 is below the project's required 22.22. The project's `release-staging.sh` must gate deployment with its normal full verification and build.

## Live acceptance — mandatory

1. Select the normal Inkspace reader; start a new solo story with a Hero. Commit a choice; observe intermission and the authored next scene. Confirm the server receipt is shown, the D20 animation finishes, and Continue reveals the next chapter.
2. Repeat with an actual Director-generated finale (and a final receipt) to verify the same-turn-number completion path, consequences, finale summary, and End Adventure Here action.
3. During another turn, disconnect/reconnect the browser while waiting. The selected paper theme should remain stable, and the 12-second saved-room re-sync should restore the outcome without rerolling.
4. Confirm HP and XP reflect authoritative progression; unchanged HP should be explicitly indicated rather than fabricated damage.
5. Exercise a Quick-Time Event and a level-up, including dark paper and mobile viewport. Confirm the normal modal callbacks remain accessible.

This pass does **not** claim all legacy styles throughout the entire application have been removed. The original terminal/physical-book readers remain opt-in for backward compatibility; their removal needs a separate audit against active dependencies. A live production/staging test is required to confirm the intermission issue is resolved end to end.
