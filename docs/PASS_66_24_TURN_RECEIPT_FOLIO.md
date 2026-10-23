# Pass 66.24 — The Committed Turn Folio

Visual alignment with approved Quillairo living-manuscript references for the **real** turn receipt.

- An editorial stepper describes the real progression of the presentation: committed choice, server-authored dice, recorded consequences, then next page (only after explicit acknowledgment). It does not alter the turn state machine.
- Dedicated parchment/ink typography, restrained gold highlights, connected headings, a transparent existing signpost ornament, named hero consequences for multiplayer, and an explicit next-page handoff.
- Adds accessible dialog labeling and status for the settled result without announcing cosmetic rolling faces.
- Only applies the extra stylesheet to the Inkbound receipt (not Arcade, Classic, or unrelated dialogs). Respects six themes, mobile screens and reduced motion.
- The receipts use `result.check`, `receipt.resolution`, and `receipt.hero_progression`. No fabricated probability, XP, HP, dice outcomes, or story. User must click the existing Continue action to expose the newly committed chapter.

Files changed: `TurnResolutionTheater.tsx`, `TurnTheater.tsx`, `main.tsx`; new `quillairoTurnReceiptPass6624.css`, regression tests, and this document. No API, schema, AWS, Director, or dice arithmetic changes.

## Install

Install after Pass 66.23 using `bash scripts/install-overlay.sh ../assets/AWS/pass66_24_quillairo_turn_receipt_folio.zip && ./scripts/release-staging.sh`.

## Acceptance

Run full Python tests and Vite production build with your existing staging release script. During solo and co-op play, check successful, failed, critical, and check-free turns; multiple party checks; HP, XP, effect, death displays; mobile/dark paper; intermission-to-dice order; and chapter display only after Continue.
