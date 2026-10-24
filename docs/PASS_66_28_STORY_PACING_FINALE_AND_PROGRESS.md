# Pass 66.28 — Story pacing, finale recovery, and visible progression

## Problem observed
A long expedition abruptly ended with an unearned rescue at turn 40. The hard
maximum of LONG (40 turns) previously forced `completed=true` in the very next
Director response even if the fiction had not reached a climax. The illustrated
Inkbound reader did not render the existing Classic finale summary; a missing
socket event or archive failure could also prevent its appearance. The Hero
panel could make XP/HP progress hard to see even when the server had recorded it.

## Changes
- `narrative_beat_plan()` supplies deterministic three-act **narrative guidance**
  from the selected SHORT / MEDIUM / LONG / EPIC target. The plan is advisory:
  it NEVER manipulates dice, XP, HP, or committed choices.
- No forced completion at max turns. The old `maximum_turns` value remains in
  persisted sessions and client data for compatibility but now represents the
  outer planning horizon. Adventures stay playable until the party explicitly
  calls the final chapter using the **existing** `request_wrap_up` vote and
  three-turn convergence. The Director is forbidden to silently terminate a
  story when the horizon arrives. An emergency all-Hero death remains under
  the separate server-owned fatal-outcome logic.
- Act II and III direction explicitly prohibits disconnected last-minute
  rescues and makes routine rest/travel scene transitions, not whole turns of
  filler or reasons for sudden endings.
- The Classic finale summary is reused in the Inkbound reader's manuscript.
  There is one JSX summary, not two implementations. A prominent final-chapter
  request appears on the manuscript when Act III begins, and the final summary
  provides an explicit **End adventure here / Return to hall** action.
- Store the computed finale in `session.last_turn_result` alongside dice and
  Hero progression before notifying clients. Reconnects reconstruct the same
  finale from the durable receipt, even if `turn_resolved` was missed.
- An optional archive failure is logged but does not block the already-committed
  dice receipt and ending. The final resolution now uses the authored **epilogue
  scene body**, not just the previous turn's action recap.
- The Inkbound Hero folio shows the actual server roll, XP applied, HP change
  (including no change), and level after the last turn. The live hero display
  prioritizes the server's party snapshot over potentially stale fetch data.
- Server logs `[HERO TURN PROGRESSION]` with granted XP, health delta, and whether
  a check occurred; it never fabricates rewards or damage.

## What this does NOT do
- Does not reopen or modify a completed saved adventure.
- Does not change authoritative dice, XP reward calculations, HP scaling,
  check selection, intermission, Arcade, narration, or Story Time logic.
- Does not guarantee every action produces an HP change: if the story did not
  establish physical injury or healing, HP correctly remains unchanged.
- Does not invent a dice roll for a no-check action.

## Verification
- Scoped Python: 374 passing across Director, Heroes, Frontend, and Adventure
  UI tests. Five API endpoint tests could not run in this container because
  `python-socketio` is missing; Mac staging release must verify them.
- Node frontend/gameplay/audio: 95 passing.
- Four changed TS/TSX modules: TypeScript syntactic transpilation passed.
- New CSS: syntax parsed with no errors.
- Overlay archive verified and install smoke-tested.

## Live acceptance plan
1. Create SHORT and LONG adventures; observe Act I set-up, Act II development,
   Act III convergence. The story must not auto-end at numeric max.
2. When the central conflict is ready, press "Bring this adventure to a close".
   Confirm votes in co-op, three closing turns, then epilogue.
3. Complete the last turn with an actual check. Observe intermission → existing
   D20 theater → receipt showing XP/HP → new scene. Test no-check result too.
4. In Inkbound (not just Classic), see the complete chronicle, Hero stats,
   sharing and "End adventure here" action.
5. Refresh on the final turn to verify persisted receipt/finale recovery.
6. Confirm individual turn XP and HP in `[HERO TURN PROGRESSION]` logs if needed.
