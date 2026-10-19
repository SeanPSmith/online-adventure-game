# Pass 64.4J — Paginated manuscript reader & pull-out journal

**Route:** `/game/inkspace-reader` (authenticated / protected, isolated).

This is a functional React presentation prototype, **NOT** the live adventure room.
It reuses the approved stationary photographic desk/book/header and projects
real HTML onto the same source-aligned page-safe zones as Space Lab and Inkspace Story.

## Features
- Two-page spreads built from actual measured typography (canvas text width,
  page width, available height). Story can overflow to as many leaves as needed.
  Split long paragraphs by words without dropping story content.
- First leaf features manuscript rubric, heading, illustrated initial and literary text.
- Second leaf features **separate RGBA watercolor PNG with alpha**, with native paper
  visible around it; not a screenshot, boxed picture, or radial masked rectangle.
- Manual page-turn navigation with proper labels, page numbering, keyboard access,
  disabled boundary buttons, and protected cancellation while ink animates.
- 33-frame ink disappearance / reappearance only on the printed DOM layers.
  Decodes frames first, waits for React to commit the next spread before revealing,
  provides reduced-motion + failed preload immediate switches.
- Leather journal tabs: Character, Chat, Notes. Openable/closable, keyboard usable.
  Preview Chat adds messages locally only; Notes is temporary in memory; Hero is sample.
  All panels are explicitly labeled as demonstrations.
- Mobile renders individual scrolling paper leaves, then the tab row and sheet.

## Guardrails
- Does not touch AdventurePage, dice/HP/XP, Director, room websocket, authored
  world configuration, persistent chat, user inventory, or active game state.
- No client-side decisions about outcomes. Sample choices only highlight selection.
- The Live Game reader integration should **later** pass authoritative server data
  as props to a reusable page layout and connect choices to the existing game API.
- Props and cosmetic packs are not sold/unlocked as part of this pass.
- No external uploaded HTML/theme CSS allowed.

## Installation
`bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4j-paginated-reader-journal.zip`

Run `./scripts/check-project.sh` before staging deployment. Then, if green:
`./scripts/release-staging.sh "Pass 64.4J: Paginated Inkspace reader and pull-out journal"`

## Verification caveats
The source was reconstructed from the prior overlays; this environment lacks the
full project node_modules installation and the local Chromium is blocked from
opening local test HTML/HTTP. TypeScript syntax/static regression checks and a
Node execution of the standalone pagination algorithm were performed. **A full
TS/React build, actual interaction screenshot, and end-to-end QA on the user's
Mac/staging remain required**. Do not treat visual artwork concepts as browser proof.
