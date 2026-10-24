# Pass 66.26 — Existing live instruments, one Quillairo folio

This is a **presentation-only** consolidation of the active `InkboundLiveRoom` drawer panels.

## Updated in place

- Hero: real current HP, XP, level, current turn, and existing `HeroEffectList` ledger.
- Party: actual connected room members, host status, and live presence.
- Journal: navigation to the existing Chronicle and field notes.
- Chronicle: real resolved turn choices, outcomes, and consequence text.
- Notes: same editable draft passed down from `AdventurePage`; visibly marked unsaved.
- Chat: same socket-backed messages and submit callback; usable empty/offline states.
- Menu: existing routes, Classic view action, and injected session utilities.

## Preserved

No socket connections, new modals, synthetic rolls, invented stats, new inventory/map subsystem,
Director/dice/progression/Arcade handlers, theme storage migrations, or changed API contracts.
Original focus-trap, Escape handling, and restore-focus behavior remain intact.

The new stylesheet is scoped to `.inkbound-live .ibl-drawer` and its child classes.
It inherits the currently selected paper edition from `--ia-*` and the restrained gold
accent from Pass 66.23 rather than hardcoding a light-only background.

## Release verification

1. Install overlay on a current repository checkout.
2. Run the complete regression suite and frontend build using `./scripts/release-staging.sh`.
3. In live gameplay, open each folio panel; check keyboard Escape/Tab, chat sending,
   offline state, notes editing, and History after a resolved turn.
4. Check desktop and phone breakpoints, plus ivory, parchment, navy, and midnight themes.
