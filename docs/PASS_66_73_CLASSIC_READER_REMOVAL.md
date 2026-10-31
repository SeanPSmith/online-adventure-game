# Pass 66.73 — Classic reader removed; Quillairo is the only reader

Owner decision: the terminal-style Classic reader is gone.

## What changed
- `AdventurePage.tsx`: the ~700-line Classic layout (`.adventure-layout`, ASCII scene art, command strip,
  history carousel, party-hero switcher, ASCII chat picker, choice inspector), the "USE CLASSIC READER"
  strip and every `?reader=` branch were deleted, along with the state, effects and handlers only they used.
  Retired `?reader=` values are simply ignored.
- **Loading / reconnecting / waiting-for-first-scene** previously showed the Classic layout by default (the
  old-UI flash). They now show a Quillairo restore panel (`.ink-restore`, `adventureRestorePass6673.css`):
  Reconnect, Dismiss message (when an error is present), My adventures, Return to the Adventure Hall. Completed
  rooms and the finale still render there when no scene exists.
- Removed the "Classic view" buttons from `InkboundLobby` and `InkboundLiveRoom`; `GameLayout` keeps the
  Quillairo shell for every adventure URL.
- Deleted `ChoiceInspector.tsx` and `adventureReaderSwitchPass6668.css`.
- Tests that asserted Classic-only markup were removed or re-pointed at the Quillairo equivalents
  (word reveal, finale, lobby begin/synopsis, invite/share, restore watchdog). New
  `test_pass66_73_classic_reader_removal.py`.

## Unchanged
Gameplay, dice, HP/XP, turn state machine, sockets, narration, persistence and recovery logic, finale and
completed-room recovery, resume watchdog (`useLiveAdventure`), wrap-up, solo start, invites.

## Features that existed only in Classic and are now gone
ASCII reaction picker in chat, choice dossier modal, read-only inspection of another party member's hero,
history paging buttons, narration diagnostics reset. (Narration controls, SFX, invite, solo, wrap-up, sync,
chat and the chronicle remain in the Quillairo menu.)

## Not done here
Classic-only selectors remain in the large shared stylesheets (`styles/components.css`, `styles/layout.css`).
They are inert now; pruning them safely needs a CSS-aware pass with before/after visual checks.
