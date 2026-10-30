# Quillairo Inkscape — 66.61 artwork production contract

The supplied Oct 23 reference mockups are the visual authority. Preserve the manuscript's live, selectable text and the existing successful ink/watercolor artwork. This is an asset-production rule, **not** a mandate to simplify the art direction.

## A. Free-standing illustration (hero, building, landscape fragment, ink ornament)

- Transparent canvas (PNG RGBA or lossless WebP with alpha), with **at least 10% fully clear canvas on every side** of the total image dimensions. This is space inside the image, not CSS padding.
- No opaque/white/beige rectangle, painted paper card, artificial vignette, universal speckle layer, or rectangular gradient hidden inside the asset.
- Coherent black ink and restrained gray watercolor wash with sharp intentional terminations; no generic feathered rectangle edges. Preserve natural contours and actual dry-brush behavior.
- One strong silhouette/focal subject; controls and body copy are never baked into art. Keep layers independent of responsive DOM content.
- Inspect on checkerboard **and** on each light/dark paper theme, at thumbnail and full-size. If the painted image is clipped internally, just enlarging the canvas will not repair it: regenerate or genuinely remove the original background.

## B. Framed scene/cover/photographic editorial

- Opaque rectangular cover files are permitted **only inside an intentionally framed media slot** (`object-fit`, predictable aspect ratio, never used as a floating cutout). They are not automatically failures.
- Do not disguise cover edges with a CSS transparency gradient. Prefer a composed scene with transparent art when the mockup calls for unframed art.

## C. Application surface

- Manuscript paper, panels, borders, real text, dice, buttons, form fields, HP/XP values and interactive states are **HTML/CSS**. The hand-drawn scene may occupy a separate image layer but must not flatten the UI.
- Match the 3-column live game composition in the approved mockup (Hero folio / story / dice & consequences), then adapt for mobile.
- Preserve underlying Director, socket handoff, committed dice, recovery, multiplayer and chapter reveals.

## D. Automated art gate

From `root/`, with Pillow installed (using an isolated Python environment if necessary):

```
python3 scripts/audit-inkscape-art-margins.py --report ../assets/AWS/inkscape-art-audit.json
python3 scripts/audit-inkscape-art-margins.py --file frontend/public/art/quillairo-public/home-vista.png --strict
```

The audit checks alpha bounding boxes for the transparent-margin contract; it cannot judge material authenticity or whether a painted-in background creates a hard edge. Inspect those visually. Do not automatically rewrite preexisting art without reviewing its usage.

## E. Current source observations

- `art/quillairo-heroes/hero-hall-vista.png`, `art/quillairo-public/home-vista.png`, `art/quillairo-public/living-worlds.png` and `art/quillairo-public/auth-journey.png` have compliant alpha padding in the reviewed snapshot.
- Older `art/pass64/inkspace/*-cutout.png` and photographic scene-kit cutouts include content closer than 10% to one or more sides; they require an art-direction review before replacing.
- `art/quillairo-public/*-cover.webp` and older Pass64 `*.webp` scene covers are **opaque**, not interchangeable with transparent free-standing artwork. Identify which are intentionally framed versus incorrectly layered by comparing the actual rendered screen to mockup.

## F. Production prompt template

"Create a **single isolated [specific subject]** for Quillairo's approved Inkscape visual system: intentional black pen and ink linework and gray watercolor in a cohesive illustrated medium. Strong subject silhouette, nuanced hand-made ink stroke behavior, selected watercolor density, readable focal structure and restrained detail. Transparent RGBA background. Keep **at least 10% entirely empty transparent margin on all four sides**. No paper background, rectangular border or tonal gradient, no typography, no props beyond the specified subject, no artificial universal noise, and no soft rectangle fade. Never crop the drawing. Final art must composite cleanly over dark and light manuscript themes."

Never regenerate successful illustrations merely to make a different image. Choose exact replacement subjects based on screenshots and annotated mockup differences.
