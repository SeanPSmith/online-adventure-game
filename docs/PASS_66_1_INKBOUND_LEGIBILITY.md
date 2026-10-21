# Pass 66.1 — Cross-surface Inkbound legibility

## Baseline
Built from the Pass 66.0 source snapshot in this conversation. Overlay intended for a tree that already has Pass 66.0 installed. Do not use on an older release without its dependencies.

## Changes
- Last-loaded, scoped reader/account/dialog/turn/intermission color-contract layer for six user-selected themes.
- Restores secondary copy/label/chat/notes contrast, focus indicators, highlighted dropdown entries, readable input placeholders, and contrast-safe action controls without replacing editorial page layouts.
- Corrects legacy source hardcoding in live chat, notes drawer, narrator picker and utility buttons.
- Preserves Arcade game boards' independent palettes, physics, score and state. Only the intermission shell is themed.
- Enlarges folio drawers and result/turn/quick-event dialogs; normal scrolling inside tall overlays.
- Reader drawers lock underlying page scroll, focus close initially and restore focus to the opener when dismissed.
- No changes to server rules, narration engine, choice lock, XP/HP, dice or Story Director requests.

## Test matrix / manual gates
For **each** of ivory, cream, parchment, navy, phosphor and midnight, inspect dashboard, account, Story Time settings, co-op lobby, live narration and choices, chat/note folio, choice lock, result dialog, Arcade intermission overlay, awaiting story, story ready/reconnect, level-up/death/QTE, global modal. Also test mobile at 390px and keyboard focus.

Verify live co-op story transitions and audio on staging separately. Static/fixture rendering does not validate actual backend/voice behavior. For every failure capture current theme, device width, component and a screenshot.
