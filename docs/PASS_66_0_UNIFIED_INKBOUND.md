# Pass 66.0 — Unified Inkbound System

## Goal
Bring paper and ink themes onto the real supporting game pages while preserving the working backend, Author Console, Story Time, and server-controlled turn sequence. This is a **foundation pass**, not full conversion of individual Arcade boards or the complete admin console.

## What changed
- Six editions: Ivory, Cream, Parchment (tan), darker midnight navy with cream text, CRT-style forest phosphor with monospaced chrome and restrained glow, and midnight black.
- Old `chalk` (retired white edition) browser preference maps to Ivory. The new Parchment is a distinct option. Preference remains browser/user scoped.
- Shared Account and authenticated secondary-route shell styles, broad readable typography, labels, inputs, buttons, and focus states. The real authenticated dashboard and adventure retain their custom editorial layouts.
- Author home lives at `/account/author`, under the main Account layout. Existing Python `/author-console` remains the editing engine. We changed its visual palette (saved by user ID) but **not its autosave, proposal review, publish, or versioning APIs**.
- Portal dialogs now receive user palette directly. Global dialogs are 960px wide where space permits; Author document preview 1180px; intermission/dice stages up to 980px. Smaller viewports never exceed available width.
- Inkbound live narration is connected to the existing `StoryReveal` component, `sceneId`, player reveal preference and narrator cues. Audio remains independent of word animation. No story generation or dice logic changed.

## Verification boundaries
- A Playwright smoke render checks all six Author CSS schemes and modal dimensions on desktop, and the Parchment dialog on a phone viewport. This **does not** simulate authenticated authoring or full React app navigation.
- Source-level TypeScript transpilation/syntax checks only in this sandbox; full Vite/TS build must run locally via `release-staging.sh`.
- Existing story/audio Node regressions and Python-focused contracts run. Browser end-to-end co-op and live TTS require user testing after deployment.

## Next surfaces
Full creator editor replacement in React (only after all controls are audited), Arcade minigame boards, complete Hero CRUD flows, auth/public pages and admin tools. Evaluate each theme in the authenticated browser across 6 themes and desktop/mobile before declaring complete.
