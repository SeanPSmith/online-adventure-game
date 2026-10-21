# Pass 66.4 — Real Level Up Folio

## Implementation

- Converts the actual `LevelUpModal` invoked by `AdventurePage`, NOT a workshop sample.
- Passes the active six-palette `InkPaper` preference into the modal.
- Leaves Classic View's existing Level Up presentation unchanged.
- Uses a wide, responsive folio with title, approved independently transparent panorama, server-grounded progression ledger, conditional effect list, XP bar and Continue action.
- Modal restores keyboard focus, traps Tab, and supports Escape to acknowledge. No native confirmation dialogs.
- Desktop and narrow screens scroll within the modal rather than clip information.

## Important server contract

`HeroProgressionUpdate` supplies `level_before`, `level_after`, `xp_gained`, `experience`, `max_health`, `health_change`, `xp_progress_percent`, `xp_into_level`, `xp_level_span`, `xp_needed_for_next_level`, and `new_effects`. **It does not guarantee attribute-point bonuses or perk unlocks**. The reference mockup shows those rewards artistically, but the production modal MUST NOT fabricate them. Only real new effects from the receipt are listed.

## Where to check

In a started Inkbound adventure, earn enough XP to cross a level threshold. Check that the real server level and XP appear in the folio. Continue must dismiss only this turn's notification. Reopen a different turn to confirm the new advancement appears. Verify all six Account → Preferences palettes, and repeat at phone width. Confirm Classic View still uses the old layout.

## Scope

No backend, Story Director, dice, Arcade, word-animation, voice, or intermission logic was altered.
