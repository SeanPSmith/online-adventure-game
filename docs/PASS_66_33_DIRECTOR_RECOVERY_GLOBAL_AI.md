# Pass 66.33 — Durable intermission recovery and global AI model controls

## Scope

Fixes a client-side condition that could leave the turn theater waiting after
an authoritative turn commit. The existing Director, story/recap generation,
Python dice, Arcade scoring, client receipt presentation, Hero persistence, and
scene-art systems are reused without replacements.

### Turn recovery

- The existing TurnTheater re-syncs its authenticated room snapshot every 12
  seconds while in an intermission/story-ready phase. Re-sync is read-only; it
  never advances a turn, requests another model response, or rolls another die.
- When the server has committed the next scene but the browser lost part of the
  intermission transition, a committed receipt is surfaced in the existing
  resolution stage, and the user must acknowledge it before the manuscript
  unseals.
- A Director timeout is exposed through the existing retryable-turn state in
  a synchronized room snapshot. The existing retry operation reuses frozen
  TurnFacts and must never reroll.

### Global AI model preferences

- On an **admin** account, visit Account > Preferences > AI Director.
- Choose Story Director and Recap/Repair/Rescue models independently; save.
- Saved values persist in `ai_global_models` via the game's portable
  SQLite/PostgreSQL database layer.
- Model IDs: `gpt-5.6-sol`, `gpt-6.1-sol`, `gpt-5.6-luna`, `gpt-6-luna`.
- Story prompts for economy-tier authored adventures still follow the existing
  economy-quality profile. Setting the fast model changes those requests too.
- Selections apply on the next generation, never mid-request. Concurrent turns
  use separate ContextVar snapshots; there is no mutable global model swapping.
- Model preference read errors fail open to environment-configured defaults;
  write access requires admin permissions and the existing admin CSRF header.
- This does NOT probe an OpenAI account's per-model entitlements: selecting a
  model not enabled on the service account may cause a provider error, which
  the existing Director retry path should expose. Start with an initial
  short adventure when testing a new model.

### Verification

- Python: `python -m pytest -q tests/frontend/test_pass66_33_director_recovery_and_models.py`
- Turn-theater simulator: `node --test scripts/tests/turn-flow.cjs`
- Full staging pipeline remains authoritative, including full pytest and
  `tsc -b && vite build` in the user's configured node environment.
- Check an interrupted turn in a live browser: after an intermission, the
  chapter must not unlock before the committed dice are acknowledged. Simulate
  reconnect and late story completion; inspect if the Director was still
  active, retry-required, or had already committed the receipt.
