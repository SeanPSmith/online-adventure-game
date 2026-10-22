# Pass 66.10 — frame, scrollbars, controls and receipt exit

- Desktop started Inkbound adventure alone uses a fixed-height frame. Story and instruments scroll independently; Classic reader, dashboard, and phone layouts are unaffected.
- All six themes style large scrollbars, custom dropdowns, shared modal dialogs, and notices. Native browser permission prompts and browser chrome cannot be styled by CSS; no fake claims of changing those.
- Tan parchment/green phosphor logo tint is a masked overlay over the **original unmodified approved image**, never a rectangular bitmap or background.
- The normal three-second server-committed story-ready handoff remains; added `OPEN THE COMMITTED DICE RESULT` button as a fallback for any hanging Arcade. It can only appear in `storyReady` after the countdown, a state that is entered only after a final non-preliminary server receipt. It calls the existing score submission and completion callback, no dice rolling code added.
- Local tests cover source contracts, actual turn-state progression including countdown and refresh, and package integrity. Real two-player browser/audio testing remains necessary.
