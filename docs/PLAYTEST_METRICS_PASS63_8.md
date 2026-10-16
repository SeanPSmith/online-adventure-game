# Pass 63.8 — Completed Adventure Playtest Diagnostics

This is **read-only instrumentation**, not a change to Story Director behavior, credits, AWS deployments, pricing configuration, or narration. Deploy through the usual staging release command.

## Operator workflow

1. Open **Admin → Control Room → PLAYTEST // COMPLETED ADVENTURES**.
2. Finish a solo or co-op adventure. Select **REFRESH PLAYTEST METRICS**; the report is not polled every few seconds.
3. Examine the last 20 completed runs (maximum 40 server-side). Compare low-progress chapter share, two-or-more consecutive low-progress scenes, provider call p50/p90, repairs/failures, and estimated AI dollars per completed adventure.
4. Run multiple short/medium/long adventures before changing the default Story Director model. Record subjective continuity, agency, ending quality, and real wall-clock playtime separately.

## What is actually measured

- `adventure_history` contains completed room, turn count, and `director_history_json` (committed turn archive). We count `narrative_progress.level` assessments from Pass 63.7. A story that predates this field is **unassessed**, not automatically labeled good or bad. This heuristic cannot replace human quality evaluation.
- `ai_usage_events` records API model, operation, status, input/cached/output tokens, estimated cost, and provider-call elapsed time. Room codes correlate recorded AI calls with the completed run. The room-scoped data excludes AWS GPU and image generation costs.
- GPT-6.1 Sol *same-tokens estimate* reprices **only successful GPT-5.6 Sol events with nonzero recorded tokens** using the configured GPT-6.1 Sol rate. Supporting-model costs and events lacking comparable counts remain unchanged. If no calls are comparable, we display **NO DATA** rather than fabricate a savings number.
- Per-adventure cost estimates are not provider invoices. Missing records, old adventures, and provider failures can create gaps. The dashboard labels missing data explicitly.
- p50 and p90 reflect the latency of successful `director_story` API calls **only**—not Story Ready wall time, narration startup, Arcade length, or total playtime. Session start and end timestamps are not currently collected as an authoritative duration series.

## Limitations and next controlled benchmark

The above is a **retrospective cost counterfactual**, not a live GPT-5.6 vs GPT-6.x A/B test. No additional OpenAI API calls occur. The model stays at the existing configured staging default.

A true A/B experiment should: pin approved Director seeds and Hero/party profiles, freeze server-provided mechanics, run the same *independent* branch conditions against both models with separate test rooms, record full latency distributions and billed tokens per model, score long-form continuity and objective movement blindly, and stop after a predefined dollar quota. Never run A/B on an active player's canonical adventure or silently replace the staging Director.

## Security and performance

The endpoint `GET /api/auth/admin/playtest-diagnostics?limit=20` inherits the admin-only auth dependency, exposes **no private story text or player profiles**, performs bounded read-only queries on existing SQLite/PostgreSQL tables, and creates no new database tables or indices. It is loaded separately from Playtest Operations and refreshed explicitly to avoid extra DB activity.
