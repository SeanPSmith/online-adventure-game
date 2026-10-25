# Pass 66.41 — Settled-turn Arcade release and copyable diagnostics

## Evidence

A live browser showed `game_state turn=20 pending=true`, then a saved `game_state turn=21 pending=false`, while `useTurnTheater` remained in `intermission`. The server is no longer generating, so a permanent "WRITING" overlay is a frontend fault or a missing committed receipt.

## Reproduced client fault

A saved final receipt was **already acknowledged** in `sessionStorage`. A late `turn_pending` snapshot could reopen the Arcade. When the settled room state arrived, `useTurnTheater` returned early on `alreadyRead` without closing the stale overlay. The new executable test fails on the previous production source and passes after this fix.

## Changes

- When a current, saved, committed receipt matches an **already acknowledged** turn and the server is settled, clear the orphaned presentation and show the saved chapter. Do not reroll or replay the already-acknowledged D20.
- Keep the existing path for an **unacknowledged** committed receipt: close the Arcade, show the authoritative D20/results, require Continue, then reveal the saved chapter.
- `game_state` and theater console diagnostics now print complete, copyable single lines with receipt presence/turn, preliminary status and dice-check count; no story text, character IDs, room codes or auth data.
- A settled room missing a final receipt now says so explicitly rather than misleadingly claiming the Director is still writing. Recovery controls remain available. The client NEVER fabricates dice.

## Scope

Changes only the existing live state hook, the existing turn theater hook, and the existing Node turn-flow test suite. No Director calls, damage, XP, socket protocol, TTS, styling, or new turn machinery.

## Verification

- Reproduced stale acknowledged-turn trap (red before, green after).
- Turn 20 → 21 saved receipt, without `turn_resolved`: existing Arcade closes and D20 appears.
- Server settled with missing receipt: warns explicitly without fabricating dice.
- 37 turn/reconnect/route Node tests passed on reconstructed source.
- TypeScript parser checks passed; full Vite build must run on user's Mac.

## Required live acceptance

Do not declare the live game fixed until an actual non-refreshed turn shows the D20 and Continue action, then the next chapter. If stalled, copy the untruncated `[Quillairo Turn] game_state ...` and `theater ...` console lines. If `receipt=MISSING`, investigate backend saved receipt delivery instead of changing the Arcade further.
