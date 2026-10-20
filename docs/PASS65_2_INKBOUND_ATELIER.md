# Pass 65.2 — Inkbound Editorial Atelier

## Purpose
Work directly from the approved `/dev/inkbound` design preview and resolve the mismatch between
flattened AI images and live React components. This release replaces the administrator-only
Inkbound workshop composition with an interactive editorial layout. Live gameplay remains
owned by the existing AdventurePage and server: this is **not** yet a live-route replacement.

## Art direction
- Chapter illustration `north-road-editorial.png` is an original generated art asset,
  postprocessed to genuine monochromatic RGBA ink. Pale paint becomes transparency so
  actual CSS paper tones show through. Art is NOT a screenshot cutout or CSS radial fade.
- In a 1800×930 canvas, content alpha is inset on **all sides** (bounds verified by tests).
- No white/black background layer baked into artwork; the RGB ink channel has a charcoal
  color while its alpha defines form, washes, and feather-free boundaries.
- Paper grain is separate at the document layer.
- Intro art and chapter art use ordinary `<img>` with accessible alt text.

## React design surfaces
- Frontispiece: editorial hero and ink vignette, feature drawings, primary CTA.
- Chapter: large title, wider transparent illustration, literary paragraphs/drop cap,
  unboxed three-column illustrated decisions, choice and confirmation demo.
- Right marginalia: location, Hero HP/XP/effects, party, journal/chronicle, chat preview.
- Manuscript-style folio dialogs: Hero, Party, Journal/Notes, Chronicle, Inventory,
  Dice visual state, Chat preview, Reader Settings.
- Journaling, chat, paper-tone selection and choice confirmation operate **only on
  local preview state**. They never write to the backend or claim an authoritative die roll.
- Keyboard Escape, focus trap and dialog accessible attributes are preserved.
- Plain opacity transition with reduced-motion support replaces glitching ink-mask animation
  in this workshop.
- Desktop and 390px mobile checked in an isolated browser render; no mobile overflow.

## Validation and limitations
- Focused Python contracts pass and artwork alpha/bbox is checked with stdlib PNG reader.
- The React component was rendered locally in Chromium using a compatibility test harness.
  Production React/Vite build, connected app state, and AWS staging must still be checked
  by the project's normal release script on the user's Mac.
- All existing actual adventure actions and state remain controlled by the existing game
  paths. The ongoing task is to transfer the approved visual system, modal by modal,
  to the real authenticated app after design review.

## Install and release
Download the ZIP to `../assets/AWS/`, then from project root:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass65_2_inkbound_atelier.zip && ./scripts/release-staging.sh "Pass 65.2: Inkbound editorial atelier"
```

The release script is authoritative. It runs checks before Git/AWS deployment; it does
not guarantee rollback if AWS deployment itself partially fails.
