# Pass 66.29 — Completed adventure Hero release / legacy finale escape

## Problem
A completed adventure still retains its Hero in the in-memory room indexes until the user leaves. The production Inkbound Adventure Hall hid the existing leave action, and an older finished session without the new `finale` payload could strand the player in a no-choices manuscript screen. Creating or joining another room then failed with `That character is already in an active adventure.`

## Changes
- Reuse the existing authenticated `leave_adventure` socket operation from the actual production My Stories dashboard, with an explicit completed-room **Release Hero** control and confirmation. The player's Hero record is not retired or deleted.
- Keep a confirmed exit for unfinished sessions. Hosts use the existing abandon/archive flow; guests leave the room without ending others' gameplay.
- On `create_room` and `join_room`, automatically release the requesting user's Hero from an **already completed** room only. Unfinished memberships remain protected by the existing rejection.
- Before clearing a completed room, recover missing completed-history archive records if possible; on archive failure, retain the room and inform the player rather than silently discard the last snapshot. Existing archives are not overwritten.
- If an older completed room has no final `finale` payload, show a return-to-Hall / release action instead of the no-choices screen. The standard server-authoritative turn receipt and finale pipeline remain unchanged.
- Preserve the existing `chapterReleased` gate for active turns; only the legacy-completed recovery escapes it.

## Test and deployment
Focused regression and source tests run without the full application dependencies. The complete React production build, Python backend suite, and staging verification must run via `./scripts/release-staging.sh` on the user's Mac. Do not claim that missing `python-socketio` tests have passed.

### Install
`bash scripts/install-overlay.sh ../assets/AWS/pass66_29_completed_adventure_hero_release.zip && ./scripts/release-staging.sh`

After release, in **Adventure Hall → My stories**, select the finished adventure and **Release Hero**. You can then select the Hero for another adventure. If the prior room is marked completed server-side, starting a new adventure with that Hero can also release the stale membership automatically. If it is merely narratively ended but not server-marked completed, use the explicit unfinished-adventure exit confirmation.
