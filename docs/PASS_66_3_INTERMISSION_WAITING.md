# Pass 66.3 — The actual Inkbound waiting page

The approved Quillairo intermission mockup is the composition reference. This is the **real** waiting layer used after a player locks a choice, when no Arcade cabinet is available, and after a player submits/skips an Arcade game. The game board stays playable until score submission or the server has finished the chapter. No backend or turn-state transitions are changed.

## Data contract
- `TurnTheater` continues to own the authoritative phases. No early receipt, dice result, or next chapter is exposed.
- `IntermissionRuntime` still handles game scoring, Arcade readiness, story-ready countdown, submit and dismissal. When in waiting mode it displays `InkboundWaitingFolio`.
- The central 00:MM readout counts **time elapsed writing**. It is not a predicted time-to-completion. Only the existing three-second `story-ready` countdown actually counts down to the result.
- The recent choice label is sourced from `choiceAccepted` or the current selected SceneChoice, and appears only after choice lock. Absence of that label leaves the design without fabricated story text.
- HP, XP progress, level and party size come from server room snapshots, if available. There are no client-generated roll values.
- Re-sync and retry actions invoke existing callbacks; resync never triggers a reroll.
- The existing Story Time narration and word reveal engine are not modified.

## Visual boundaries
- Full-height paper composition with centered passage writing, real stages, small status footer, and optional recent-choice line.
- Six palettes inherited through `data-ink-paper`, including CRT-inspired green and cream-on-navy. Real RGBA signpost and lantern artwork remains isolated and within alpha-safe canvas bounds.
- Wide desktop, phone and reduced-motion behavior. Text lives on the paper layer, without absolute annotations crossing it.
- Existing Arcade games are still rendered by their original game components.

## Manual acceptance
1. Join a solo/co-op game, lock a real choice, verify only the writing state (never early dice or new story text).
2. Play and skip an Arcade game, confirm the waiting page uses the submitted score state.
3. Observe the three-second story-ready timer, then the authoritative roll and new chapter.
4. Test retry, reconnection after delay, co-op score reporting and Story Time voice.
5. Check ivory, cream, parchment, navy, phosphor and midnight on desktop and phone.

Full TypeScript/Vite and live multiplayer/audio acceptance run in the user's release pipeline. These fixtures test the real React waiting component with representative data, not the entire game backend.
