# Tales of Two — Gameplay Stability Pass 06

This pass is deliberately focused on getting back to playing the game rather than broad UI redesign.

## What changed

### Director recovery
- Unexpected Director/provider/schema exceptions now preserve authoritative pending TurnFacts and emit a retryable game error instead of leaving the client trapped in an intermission.
- The existing server retry path still reuses the original locked choices and dice; no reroll is introduced.
- Added a second, always-visible retry control in the Adventure sidebar whenever the server reports `director_retry_required` or a retryable error. This is intentionally redundant with the Turn Theater recovery screen.

### Co-op authority
- A newly-created co-op room can no longer resolve turn one with only the host present.
- The host may choose/lock while waiting, but Python refuses turn resolution until the room reaches its required party size.
- Explicit SOLO mode still requires only one Hero.
- After a valid co-op party exists, only living Heroes are required for later turns, so a fallen Hero does not permanently deadlock the surviving Hero.
- START SOLO now asks for confirmation before permanently converting the room.

### XP on failed checks
- Failed checks no longer receive full risk XP.
- Failure XP is now derived from authoritative `check_total / DC` proximity with a bounded curve:
  - near misses receive meaningful partial credit,
  - weak failures receive substantially less,
  - critical failures are capped at 20%,
  - success / critical-success bonuses remain intact.
- The XP breakdown now records `check_total`, `check_difficulty`, and `check_proximity` for transparency and debugging.

### AI synopsis before entering
- Clicking a catalog adventure now opens a preflight synopsis instead of immediately creating the room.
- For generated adventures the modal reads `metadata.player_synopsis`, i.e. the seed's AI-generated player-facing synopsis.
- It also shows the selected Hero, tags, and makes the co-op/solo behavior explicit before room creation.

### Return to game
- React remembers the last meaningful `/game...` route in session storage.
- Account pages now return to that exact game route when possible.
- The legacy full Author Console reads the same route and its RETURN TO GAME button defaults to `/game` rather than the public homepage.

### Party chat ASCII picker
- The previously-disabled `:-)` control now opens a compact ASCII-face picker and inserts the selected face into the chat draft.

## Validation performed

- Python compilation passed for changed backend modules.
- 39 focused backend tests passed across progression, room mode, generation synopsis, rooms, micro-events, and Director runtime.
- TypeScript/TSX syntax transpilation passed for changed React files.
- `author.js` JavaScript syntax validation passed.

## Deployment

No CloudFormation/Data-stack changes are required.

After overlaying the patch and appending the changelog:

```bash
cd /Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root
source .venv/bin/activate

python -m pytest \
  tests/test_room_party_gate.py \
  tests/test_character_progression.py \
  tests/test_generation_synopsis.py \
  tests/test_rooms.py \
  tests/test_micro_events.py \
  tests/test_director_runtime.py \
  -q
```

Then rebuild/push/restart the backend:

```bash
./scripts/aws/package-backend.sh
./scripts/aws/upload-backend-source.sh
./scripts/aws/start-backend-build.sh
./scripts/aws/redeploy-backend-image.sh
```

Wait for CodeBuild `SUCCEEDED` and ECS steady state.

Then deploy the changed React assets:

```bash
./scripts/aws/deploy-frontend-assets.sh
./scripts/aws/frontend-smoke.sh
```

## Recommended live test

1. Open a generated public adventure and confirm the AI player synopsis appears before room creation.
2. Enter as host in co-op and lock a choice while alone. Confirm the Director does **not** start.
3. Join from the second account and resolve the turn normally.
4. Start a separate explicit solo room and confirm the warning appears before conversion.
5. Fail checks at different margins and inspect XP differences in the result theater/Hero progression.
6. If generation fails, use either RETRY STORY GENERATION control and verify the original roll is reused.
7. Visit Account or Author Console from an active adventure and verify RETURN TO GAME returns to that room.
8. Open `:-)` in chat and insert/send an ASCII face.
