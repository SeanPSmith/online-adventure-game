# Pass 65.8 — The First Page & Player Instruments

**Base:** Pass 65.7 Live Inkbound Adventure. Incremental overlay, not cumulative.

The live adventure lobby is now rendered by `InkboundLobby` when an Inkbound reader is requested/default, room restoration is ready, and the server says the game has **not** started. The earlier classic lobby remains accessible with `?reader=classic`.

The same adventure remains the only owner of `useLiveAdventure` and the server commands. `InkboundLobby` is stateless and consumes actual `RoomPlayer`/`ReadinessPlayer` data, available room invitations, audio preference callbacks, and the original `live.startAdventure` action. Chapter One is never fabricated before BEGIN ADVENTURE. The host button remains disabled when `can_begin_adventure` is false or chapter generation is in progress.

The default live reader exposes session commands suppressed by the prior presentation swap: SFX, voice selection, playback speed, read chapter, stop narration, invite a co-op player, convert to solo where permitted, final chapter request and progress, and share moment. All existing handlers remain in `AdventurePage`.

All six page themes style the lobby independently. The fantasy illustration is the existing true-alpha PNG, not a flattened screenshot or rectangular crop. Non-fantasy worlds do not inherit generic fantasy scene art; they use intentional blank editorial space until world artwork is supplied. The QTE, level-up and death sheets inherit the same paper treatment without changing event timing, HP, XP, QTE outcomes or authoritative turn logic.

**Validation:** Python regression suite and isolated Chromium responsive renders at six desktop/phone palettes. Browser harness uses representative state and does not assert backend/live multiplayer correctness. Full `npm run build`, backend tests, and AWS staging verification must pass in the user's `release-staging.sh` pipeline before live deployment.

**Next:** real-game manual testing with both player accounts; then art direction for the individual Arcade boards and remaining Hero/account dialogs.
