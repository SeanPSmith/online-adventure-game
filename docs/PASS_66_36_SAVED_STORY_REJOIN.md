# Pass 66.36 — Live chapter handoff and saved-story rejoin

## Symptom
A player stayed in the Arcade with `WRITING` elapsed past 200 seconds, while
refreshing the page advanced to a saved chapter. This means the client was not
successfully reconciling the committed chapter. The report by itself does not
prove whether the originating problem was a lost event, lost server-side room
binding, or another transient failure.

## Repair
- Existing 12-second `sync_adventure_state` remains read-only.
- If no matching `game_state` reply returns within five seconds, the client
  uses the already existing authenticated `resume_adventure` handshake.
  It never submits a new choice, rolls dice, or generates story text.
- A successful `resume_success` increments `resumeEpoch` and reconstructs the
  existing turn-theater hook state. The saved room snapshot then supplies the
  authoritative turn receipt; this reproduces the recovery provided by refresh
  without destroying the current page.
- If a saved `last_turn_result` proves that the active Arcade turn has
  committed but the browser still displays Intermission, a 2.5-second guard
  re-runs the existing safe resume handshake. This also handles stale local
  theater state even when `sync_adventure_state` replies normally.
- After twenty seconds writing, visible `Check saved chapter` and `Rejoin
  story` controls remain accessible *above* a running Arcade. They do not
  replace its game board, score submission, or graphics.
- An answered sync cancels the escalation watchdog. An active request is never
  duplicated; timers are cleared on socket disconnect, identity change, and
  unmount.

## Live acceptance
Play at least three ordinary turns and a finale. For a stalled turn, verify
that the saved result appears after sync/rejoin and that the D20 and XP/HP
receipt are visible. Also verify server-side Director retry remains available
if the story truly hasn't committed. On a deliberately blackholed
`sync_adventure_state` reply, confirm that `resume_adventure` is emitted within
five seconds of the failed sync and the saved receipt appears.

The normal Mac staging release performs the full Python suite, all Node
regressions including the new socket-handshake tests, and the React production
build. A successful build alone does not constitute a live-play acceptance.
