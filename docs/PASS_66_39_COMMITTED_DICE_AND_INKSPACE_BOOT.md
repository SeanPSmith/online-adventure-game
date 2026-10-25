# Pass 66.39 — Committed turn event authority and early Inkspace shell

## Failure reproduced
The server sends `turn_resolved` **after** persistence of the generated scene. The browser nevertheless required a second `game_state` update before starting the dice. If the latter event was missed, a live Arcade remained open until a hard reload performed a full room resume.

## Small corrective change
* On a **non-preliminary** `turn_resolved` matching the current pending turn, the existing theater starts its three-second closure without waiting for a second socket message. Preliminary dice remain private; previously resolved turns cannot release later turns.
* `onTurnResolved` starts a watched room-state sync for the freshly committed scene; an unanswered request already escalates to the existing authenticated room restore. No new Director request, choice, roll, or HP/XP mutation.
* Once a receipt is acknowledged, a stale pending snapshot cannot reopen the Arcade. The manuscript remains sealed until the saved next scene is received.
* Rejoining the same room no longer clears a committed theater receipt mid-handoff. A completed resume with saved receipt replays dice immediately.
* The eagerly loaded Inkspace route gets stable parchment or dark-paper colors before the lazy Adventure reader mounts. The retired Pass-64 game header is not rendered during load; the shared `LOADING PAGE` toast also uses the new literary style. Classic/Book routes are untouched.

## Coverage
* `node --test scripts/tests/{turn-flow,adventure-recovery,adventure-socket-rejoin,route-loading}.cjs`
* `python -m pytest -q tests/frontend/test_pass66_34_committed_turn_and_inkspace.py tests/frontend/test_pass66_35_playability_baseline.py tests/frontend/test_pass66_36_room_rejoin_recovery.py tests/frontend/test_pass66_38_turn_visibility.py`
* Full production frontend build and authenticated staging/browser replay are required by `scripts/release-staging.sh` and operator. A source-level fix is NOT live verification.

## If staging still stalls
Use Chrome Console, filter `[Quillairo Turn]` and capture the final `turn_resolved`, `game_state`, and `theater` lines. Redact user/room/character identifiers before sharing. Distinguish no server commit from committed event with stale client state; do not reroll a saved turn.
