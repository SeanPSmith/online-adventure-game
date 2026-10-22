# Pass 66.11 — QTE / reaction screen (real game)

The existing `QuickEventModal` is the source of truth for QTE rules and submit actions. This pass changes its Inkbound presentation only. With the normal adventure reader it uses the approved paper and ink palette; Classic retains the original QTE design.

## Player-facing acceptance

- Modal is a wide manuscript with narrative, remaining time, timer bar, options, stakes, resolution, and accessible continue.
- The server's `QuickEvent` provides title, text, options, timing, chosen answers, outcomes, and effects. The UI never invents odds or reveals the correct answer early.
- Existing 1/2/3 keyboard shortcuts, single-submission latch, timeout action, audio cues, and co-op waiting remain connected.
- A shared generic transparent landscape is displayed **only for explicitly fantasy-tagged adventures**. Do not misrepresent sci-fi or horror QTE events with fantasy art.
- Both 2- and 3-option layouts, desktop/phone sizes, and all six palettes require final live-session visual checks.

## Remaining player-facing queue (each page has its own parity gate)

1. **QTE (this pass):** client behavior retained; visual manuscript complete; live timeout and co-op verification outstanding.
2. **Hero death:** standalone wide folio; true server cause, consequence, and recovery actions.
3. **Arcade shell and individual games:** preserve timing/scoring, reskin board one at a time; verify intermission -> stored dice -> result -> next chapter without refresh.
4. **Full Hero sheet, equipment, companion and traits:** actual data, actions, portraits, state changes.
5. **Account/profile/login, Author Console, notification dialogs, admin, public catalog/world pages:** page-by-page mockup parity and six-theme contrast/scroll/focus gates.

## Production safety

No modification of the backend dice, QTE selection, Director writing, roll timing, Hero progression, scoring, or socket event handling. If the Arcade still hangs in a real room, capture server event order, room snapshot, receipt and intermission state; do not manufacture another client-side roll.
