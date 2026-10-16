# Pass 63.12 — Outcome stakes, earned wins and recoverable failure

## Purpose

A check is not just an animation or an XP adjustment. The stakes offered before
players choose an action now bind what a successful or failed roll means.

- On **success**, the Director must deliver at least one specific offered gain:
  a usable clue, leverage, ally, opened route, secured objective or justified
  resource. An exceptional result on a **high / severe / extreme** risk may
  deliver a second *distinct* offered gain where the choice offered one.
- On **failure**, the offered cost must happen. A loss changes the story and
  cannot be silently erased. Critical failure may realize a second stated cost
  for high-risk actions, but never automatically means death, HP loss, or the
  party becoming trapped forever.
- **Next chapter**, offer a distinct recovery approach: contain the damage,
  negotiate, find a different route or salvage the objective. This is a new
  decision, often with risk or sacrifice; it is **not** an automatic reversal
  or a cost-free reroll. A player may choose to walk away.

## Technical contract

`GameSessionManager.resolve_turn` snapshots `possible_gains`, `possible_costs`,
`choice_reward_level` and `choice_impact_level` with authoritative check facts.
`app/game/outcome_stakes.py` derives per-player contracts solely from those
frozen facts. No new rolls are performed. `OpenAIRuntimeDirector.advance` gets
these contracts in `runtime.outcome_stakes` and receives guidance to reflect
both payoff and consequence in scene prose, choice options, and structured state.

During commit, `bank_outcome_stakes` preserves the due fictional stakes in
`active_advantages`, `recent_consequences` and `unresolved_threads` when the
Director omits them. Only narrative state is affected: no item transfer,
physical inventory, currency, HP, XP or stats are awarded by this fallback.
This is idempotent and separate for each player. Completed adventures record
setbacks but do not open an unplayable future recovery thread.

Pass 63.7 momentum telemetry compares **raw generated** state, before the
fallback, to avoid manufacturing evidence of genuine scene progression.

## Playtest expectations

1. Select a meaningful HIGH-risk option offering two rewards; make a strong
   success and verify a concrete primary reward and, if exceptional, a second.
2. Fail a different meaningful choice; verify a real cost is visible and the
   next chapter offers at least one playable *alternative* route to recover.
3. Choose not to recover; the story must continue without railroading.
4. Repeat in co-op and verify both Heroes receive distinct outcomes.
5. Confirm roll odds, health damage, currency, and Hero inventory remain under
   existing authoritative mechanics.

**Known limitation:** deterministic story-state safeguards cannot prove that
model-written prose is vivid or that a proposed recovery choice is genuinely
feasible. These are instructions and testable playtest requirements, not a
second costly inference or hard rejection gate. If the Director omits the
comeback option, it remains an actionable gameplay defect.
