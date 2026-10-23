# Pass 66.17 — Director story timeout recovery

Scope: runtime Director generation only. No change to authored scenes, dice, HP, XP, artwork, or turn presentation.

## Why

A successful main Story Director request keeps the same model and reasoning settings. Previously a 90-second SDK timeout was followed by a roughly 95-second room deadline, leaving no time for recovery on a slow turn. The player then had to retry manually (without rerolling).

## What changed

- Primary request default timeout: 75 seconds; remains configurable with `TOT_OPENAI_DIRECTOR_TIMEOUT_SECONDS` (15–300).
- On timeout errors only, make **one** rescue request on the already configured economy model with low-reasoning settings and identical instructions, JSON schema, context, and frozen turn facts. No alternate roll, no second scene commit.
- Rescue default timeout: 35 seconds, configurable with `TOT_OPENAI_DIRECTOR_RESCUE_TIMEOUT_SECONDS` (15–90). Optional kill switch: `TOT_OPENAI_DIRECTOR_RESCUE_ENABLED=0`.
- Both requests use SDK `max_retries=0`. The game controller deadline now includes the bounded rescue budget plus a small validation margin (default 130 seconds). Existing durable pending turn facts and manual retry are retained if recovery also fails.
- Logs: `[DIRECTOR STORY TIMEOUT]`, `[DIRECTOR STORY RESCUED]`, `[DIRECTOR STORY RESCUE FAILED]`, `[DIRECTOR PROVIDER RETURNED]`, `[DIRECTOR VALIDATION ERROR]`, `[DIRECTOR ERROR]`.

A rescue is an additional paid API request **only if the first call times out**. The first call's provider-side cost may still accrue even if the client times out; normal successful turns are unchanged.

## Acceptance checks

1. Let an ordinary short turn generate: only one Story Director request.
2. Emulate a primary timeout: one rescue with identical input and schema; the committed dice receipt remains unchanged.
3. Emulate both requests timing out: existing Retry Story Generation recovers the frozen turn (not a reroll).
4. Test at least one normal live turn and a delayed/high-stakes turn. Confirm Arcade -> stored dice -> after-action report -> next story.
5. Confirm image generation is still asynchronous, with no effect on the Director deadline.

Full network/provider timing and staging integration require the Mac/AWS release gate and a live turn. No external provider request was made in this patch's sandbox tests.

## r1 compatibility repair (October 23, 2026)

The initial Pass 66.17 overlay included a stale `app/main.py`. It accidentally
removed Quillairo's Pass 66.14 scene-art router and both fire-and-forget
post-commit art schedules, and reverted four branding strings. Restored all of
these without modifying the rescue behavior. The initial dynamic story usage
operation label was correct at runtime but did not meet the product's literal
usage-accounting source contract; rewrite the conditional so the primary
`operation="director_story"` literal remains visible, while timeout rescue stays
independently metered as `director_story_rescue`.

Also replaced the older fixed 105-second **opening chapter** deadline with
the same bounded primary-plus-rescue budget as regular turns; no optional
artwork generation is awaited. Added compatibility regressions.

This package supersedes Pass 66.17. It includes all changed files, so apply
**only** the r1 ZIP to a tree already updated with prior passes, then run the
existing installation and complete staging release verification.
