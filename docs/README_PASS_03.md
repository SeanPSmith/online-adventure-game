# Tales of Two — React Integration Pass 03

This is the first React pass that lets a live turn actually progress.

It is intentionally split between:

- **Python**: authoritative game truth, persistence, dice, progression, Director state.
- **React**: selection, inspection, lock-in intent, transition theater, dice presentation, consequence presentation.

The old vanilla frontend remains untouched and usable as a parity reference.

---

## Install

This ZIP is laid out relative to the repository root.

Before replacing anything, make a quick backup or commit your current work.

Replace the included files/folders at their matching paths:

```text
app/main.py
app/game/session.py
app/persistence/store.py
app/characters/routes.py
app/characters/schemas.py
frontend/
```

The `frontend/` folder in this package is a complete replacement for the React frontend from Pass 02. It does **not** contain `node_modules`.

No new npm dependencies were added.

Run the backend:

```bash
python run.py
```

Run React in a second terminal:

```bash
cd frontend
npm run dev
```

Then append `PROJECT_CHANGELOG_APPEND.md` to your real `docs/PROJECT_CHANGELOG.md`.

---

## What is live now

### Choice interaction

- Choice cards can be selected without becoming authoritative.
- Selection may be changed until explicit lock-in.
- `[i]` opens a React choice dossier with description, risk, reward, approach, impact, check/DC, XP, tone, gains and costs.
- Odds are deliberately labeled `SERVER RESOLVED`; React does not reproduce the Python check/effect engine.
- `LOCK IN CHOICE` emits the existing Python `submit_choice` event.
- The UI only considers the choice locked after the existing `choice_accepted` acknowledgement / authoritative readiness state.
- Selected choice intent is kept in `sessionStorage` for refresh resilience, but it is presentation state only.

### Turn transition

The React theater now follows the existing server protocol:

```text
SELECT
  -> LOCK IN
  -> choice_accepted
  -> wait for required Heroes
  -> turn_lock_countdown
  -> story_advancing / durable turn_pending
  -> Director work
  -> STORY READY countdown
  -> authoritative dice/result presentation
  -> XP / HP / level / effect consequences
  -> CONTINUE
  -> reveal the server's already-committed next scene
```

The backend still starts resolution / Director work immediately. The countdown is presentation only.

### Dice/result theater

- Heroes resolve sequentially rather than all at once.
- The D20 uses the existing embedded-number ASCII treatment; the number is part of the same monospace glyph block.
- Rolling frames are cosmetic only. The final roll, modifiers, total, DC and outcome all come from Python.
- Critical results trigger a brief screen shake, disabled by `prefers-reduced-motion`.
- No-check choices get their own authoritative result card.
- Server `hero_progression` drives XP, HP, level-up, new-effect, expired-effect and death presentation.

### Director failure / retry

- Durable `turn_pending` state reconstructs the waiting/intermission screen after reconnect.
- `director_retry_required` / retryable `game_error` becomes a React retry screen.
- `RETRY STORY GENERATION` uses the existing `retry_pending_turn` event.
- Python reuses the original locked choices and dice; React never requests or creates a reroll.

### Durable turn receipt — small backend addition

Pass 03 adds one backward-compatible Python presentation field:

```text
GameSession.last_turn_result
```

The exact emitted `turn_resolved` payload is persisted and included in `game_state.last_turn_result`.

Purpose: if React refreshes or reconnects after the Director has already completed the turn, it can replay the authoritative dice / XP / HP / effects theater instead of losing the one-shot event.

This field does not resolve anything and does not alter gameplay. It is a durable receipt of what Python already resolved.

Old room snapshots without this field continue to load with `None`.

### Hero read contract — small backend addition

`CharacterResponse` now also returns existing server-owned data that was already on the Python Character model:

- `is_alive`
- `death_record`
- `effects`
- server-calculated XP progression fields, including `xp_needed_for_next_level` and `xp_progress_percent`

React uses those values for the live Hero HUD. It does not duplicate progression or effect math.

### Existing controls brought forward

- Start Solo remains server-controlled through `can_start_solo` / `start_solo`.
- Wrap-up voting is exposed through the existing `request_wrap_up` protocol.
- Once a Hero has voted, the button reads `YOUR VOW IS MARKED // WAITING FOR THE PARTY` until everyone acknowledges.

---

## Intentionally NOT in this pass

### Intermission mini-games

The real transition state is wired, but the old imperative mini-game implementation is **not** mounted inside React yet.

During Director generation React displays the waiting/intermission theater. We will port the actual mini-games as React components separately so we do not drag imperative DOM ownership back into the new presentation layer.

The Python intermission score infrastructure remains untouched.

### Destructive Adventure controls

`leave_adventure` and `abandon_adventure` still exist in Python but are not exposed in React yet. They need confirmation modals and clear host/member wording first.

### Hero deletion

Still intentionally withheld. The current delete REST endpoint does not itself guard against a Hero being referenced by an active room. We should add that backend guard before exposing deletion.

---

## Smoke test

Run these in order.

### A. Basic resume

1. Sign in.
2. Open `/game`.
3. Resume an existing adventure.
4. Confirm story, ASCII art, Turn State, Hero HUD and chat load.
5. Refresh the page and confirm the room resumes normally.

### B. Choice selection

1. Click one choice.
2. Confirm it highlights but Turn State does **not** say LOCKED yet.
3. Click another choice; selection should move.
4. Click `i`; inspect the dossier and close it.
5. Select your intended action.
6. Click `LOCK IN CHOICE`.
7. Confirm the UI changes to LOCKING, then LOCKED only after server acknowledgement.

### C. Co-op waiting

1. Lock P1 while P2 has not locked.
2. Confirm the story remains visible and P1 shows LOCKED while P2 remains CHOOSING.
3. Lock P2.
4. Confirm the three-second CHOICES LOCKED theater begins.

### D. Director / intermission

1. After countdown, confirm React shows the Director waiting screen.
2. Refresh during Director generation.
3. Confirm the waiting screen reconstructs from `game_state.turn_pending` / `pending_intermission`.

### E. Resolution

1. Let the Director finish.
2. Confirm STORY READY counts down.
3. Confirm P1 resolves fully, then P2.
4. Confirm final roll values exactly match the server turn receipt.
5. Confirm XP / HP / level / effects reflect `hero_progression`.
6. Click CONTINUE.
7. Confirm the new story scene and new choices are revealed.

### F. Receipt recovery

1. Complete another turn.
2. Refresh while the result theater is showing, before pressing CONTINUE.
3. The authoritative result theater should be recoverable from `game_state.last_turn_result`.
4. After pressing CONTINUE once, refresh again. The same receipt should not reopen in that browser tab/session.

### G. Director retry

If you can induce a Director timeout/error safely:

1. Confirm the retry theater states that choices/dice were preserved.
2. Click RETRY STORY GENERATION.
3. Confirm Python does not reroll the turn.

---

## Validation performed on the supplied project

Python syntax compilation passed for all five changed backend files.

The project test baseline **before** this patch was:

```text
82 passed
4 failed
```

The four failures are the existing `tests/test_director_schema.py` fixtures missing the newer required `effect_name` and `health_delta` consequence fields.

After this patch the test result remains exactly:

```text
82 passed
4 failed
```

No additional Python test failures were introduced.

A CharacterResponse smoke test passed for the new read-only Hero fields.

All React `.ts` / `.tsx` files passed TypeScript syntax transpilation. A full `npm run build` should be run on your machine where the project's npm dependencies are installed.
