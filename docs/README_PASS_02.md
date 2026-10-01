# Tales of Two — React Integration Pass 02

This pass consumes the CURRENT Python project contract without changing the Python game engine.

## Replace / add

Copy the contents of `frontend/` over the matching files in your existing React `frontend/`.
These are complete replacement files, not snippets.

No new npm dependencies are required.

Then:

```bash
cd frontend
npm run dev
```

Keep the Python server running in the other terminal:

```bash
python run.py
```

## What is real now

### Game homepage
- real authenticated Socket.IO connection
- real Adventure Catalog
- real persisted Adventure List
- real Hero selector
- real Create Room
- real Join Room
- automatic route into the room after `room_joined`

### Live Adventure
- real `resume_adventure`
- real `room_state`
- real `game_state`
- real scene title/body/ASCII art
- real server choices rendered read-only
- real Turn State
- real own-Hero REST record
- real Party Chat history + send
- real reconnect/resume
- real completed/finale detection
- real Start Solo when the server says it is allowed
- StrictMode-safe delayed `exit_adventure_view`

### Heroes
- real Hero list
- real Hero creation using server-supplied budgets/caps
- real Hero sheet
- real advancement allocation
- real completed-story history per Hero

### History
- real completed chronicles aggregated across owned Heroes

### Author
- Author nav is permission-aware
- Author route reads real `/api/author/me`
- Author route reads real Author documents
- editor remains on the old frontend until player UI parity

## Deliberately NOT connected in this pass

### Choice submission
Choice cards are intentionally disabled.

The next migration pass will move this whole interaction together:

1. select a choice locally
2. inspect choice details
3. explicit LOCK IN CHOICE
4. emit `submit_choice`
5. `choice_accepted`
6. server readiness
7. `turn_lock_countdown`
8. `story_advancing`
9. intermission / durable reconnect recovery
10. `turn_resolved`
11. dice + consequence presentation
12. Continue
13. reveal the already-authoritative next scene

Do not make a choice-card click directly authoritative.

### Destructive session controls
`leave_adventure` and `abandon_adventure` are not exposed yet.
Those should be introduced with proper confirmation modals.

### Hero deletion
The Python Hero delete endpoint exists, but this React pass intentionally does NOT expose it.
A Hero can currently be referenced by an active room; deletion needs an explicit backend membership guard first.

### Forgot password
Still scaffold-only. There is no Python password-reset endpoint yet.

## Smoke test

1. Log in.
2. `/game` should show `STORY NETWORK ONLINE`.
3. Existing journeys should appear.
4. Public Adventure definitions should appear.
5. Internal `old_chapel` and `windroad_lantern` test content should remain hidden, matching the existing client.
6. Existing Heroes should populate `ENTER AS`.
7. Create a new Hero from `/game/heroes/new`.
8. Open the new Hero sheet.
9. Open an existing journey from `/game`.
10. Confirm room resume, scene text, ASCII, choices, Turn State, Hero HUD, and chat.
11. Send chat.
12. Refresh the Adventure route. It should resume.
13. Restart Python while the Adventure route is open. Socket.IO should reconnect and resume.
14. Return to `/game`; the socket should detach from the active view after the route unmount.
15. If a new co-op room has only the host and the server reports `can_start_solo`, START SOLO should work.

## Known backend contract gaps for later UI work

- Character REST responses currently do not expose the Character model's active `effects`, `is_alive`, or `death_record`.
- The Hero API does not expose server-calculated XP-to-next-level in the Character response.
- Partner Hero mechanical summaries are not currently included in `game_state`.

Those are presentation-read gaps, not reasons to duplicate game math in React. Add read-only server fields later instead of reproducing the Python rules in TypeScript.
