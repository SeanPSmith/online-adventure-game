# Pass 66.40 — Director structured repair headroom

## Symptom

`Story Director returned malformed JSON after repair.`

This error occurs **after** a failed parse of a Story Director output and a subsequent JSON repair call. The previous code used one ambiguous message for both malformed repaired JSON and structurally valid JSON that failed Pydantic's gameplay/story validation.

## Repair

- Replace the truncated 3,200–4,200-output-token repair limit with a **bounded** 6,400–7,000-token limit, chosen from the current turn's normal output budget. A repair must re-emit the *entire* structured scene, including choice checks, continuity state, and optional QTE, not only the missing tail.
- Keep repair calls on the existing economy model and usage-metering operations. There is still **one** repair attempt per failure. It happens **only** if the initial output failed parsing/validation.
- Ask the model for concise JSON field contents so it can fit within its output limit without fabricating a different turn.
- Emit `[DIRECTOR REPAIR RESPONSE]` diagnostics: operation, model status, incomplete reason, output character/token counts, budget. Do not log credentials.
- Differentiate invalid JSON from valid JSON that fails story validation. Player-facing retry errors explicitly state that locked choices and server dice remain saved.
- Propagate `UsageLimitExceeded` unmodified.

## Verification and limitations

This patch is a targeted mitigation for repair truncation and confusing diagnostics. The exact live failure cannot be attributed to token exhaustion without the corresponding server logs (`[DIRECTOR JSON REPAIR INVALID]`, `[DIRECTOR REPAIR RESPONSE]`). A failed story still requires the existing safe retry and must never generate a new roll. No change was made to the live reader, intermission, server turn commit, OpenAI account model settings, or Arcade.

Run `pytest -q tests/director tests/adventures` and the full `./scripts/release-staging.sh` gate on the development Mac. After deployment, retry the same pending turn and inspect server logs if it fails again. All retries must reuse the frozen turn facts.
