# Pass 63.7 — Narrative momentum / playtest instrumentation

The full narrated playtest exposed a **macro-pacing** issue: a Hero can win a
server-authoritative check, yet a subsequent chapter can recreate the same
obstacle with lightly reworded choices. Pass 63.4 strengthened the Writer's
instructions; Pass 63.7 adds objective, bounded observations of committed
fictional *state* so the Director can recognize repeated stalls.

## Runtime behavior

- `app/generation/momentum.py` compares the old versus new **committed**
  `story_state`. Evidence of substantive progress includes changed objective,
  narrative phase, party location, newly resolved thread, closed route,
  discovered fact, or new advantage. A different title by itself counts as a
  *scene shift*, not proof of substantial objective progress.
- Persist `{ level, evidence }` in each Director turn's history/Chronicle
  archive (`narrative_progress`). No schema/table migration is required, as the
  fields already live in the existing JSON turn history.
- The next Director request receives compact `runtime.narrative_momentum`:
  count of *consecutive* low-progress scenes, server-authoritative counts of
  current-turn successful/failed checks, and a simple direction signal.
- After two consecutive low-progress scenes, the prompt explicitly requests a
  meaningful shift: resolve/change the obstacle, move time/location, discover
  something consequential, or close a route. A successful roll must remain
  meaningful; a failed roll should cause a changed cost or detour, not a reset.
- Logs `[DIRECTOR LOW PROGRESS]` when a completed generation appears stagnant.
  This message records only room/turn, warning streak, and outcome counts—not
  the player's prose or private Hero biography.

**Importantly, this is advisory.** A prolonged conversation or a contained
climax can legitimately use the same location and goal; the heuristic can
produce false positives. It therefore *never* rejects a playable chapter,
spends extra tokens on a repair, rewrites dice, modifies HP, changes the
world, or starts a retry. Empty/legacy histories are treated as unknown,
not stale. Even if the model ignores the direction, gameplay proceeds.

## Acceptance

Run one short solo and one medium co-op adventure. Check that strong success
retires or changes the obstacle, repeated setbacks introduce a different
route or irreversible tradeoff, and quiet scenes remain possible. Inspect
CloudWatch for repeated `[DIRECTOR LOW PROGRESS]` messages and correlate with
in-game chapters; these are quality signals, not definitive defect counts.

No model switch, narration stack changes, GPU inference changes, UI refresh,
credit economy change, paid billing, or database migration is included.
