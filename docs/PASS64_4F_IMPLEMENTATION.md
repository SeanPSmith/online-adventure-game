# Pass 64.4F — Space Lab, World/Player Cosmetics Resolver & Safe Zones

## Purpose
Build the first **real code** foundation for custom personal reading spaces, without replacing the user-approved scene or connecting payments/owned inventory prematurely.

## Install
From `/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root` after copying overlay into `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4f-space-lab.zip && ./scripts/check-project.sh
```

Only when the full project is green:

```bash
./scripts/release-staging.sh "Pass 64.4F: isolated Space Lab, cosmetic catalog resolver, and image-aligned reading zones"
```

Open protected **`https://onlinetextadventure.com/game/space-lab`**.

## What this pass actually implements

1. Protected isolated route with no `GameLayout` duplicate header and no changes to `/game`, `/game/ink-lab`, `/game/visual-playground` functionality. Reuses exact approved image and parchment/compass/header composition.
2. Reusable, statically allowlisted `CosmeticItem` model and 9 typed item slots. `resolveScene` implements the modes `follow_world`, `my_setup`, and `custom_mix` with explicit per-slot source selection, type checks, free/owned rules, published state and deterministic fallback.
3. Working visual preview of three **lighting treatments on the same photographic book image**. These are CSS color/brightness treatments, not claims of new generated scene assets. Toggle between world suggestion and personal setup; Custom Mix currently demonstrates choosing a source for the lighting slot.
4. Calibrated page content-safe zones for the 1672×941 source image, rendered against the **object-fit: cover** coordinates. Guides are optional and intentionally not part of game UI. On narrow mobile, these desktop geometry guides are hidden until a dedicated mobile art map is designed.
5. A small accessible workshop panel with radio controls, labeled select, live status, reset, a close-to-view-stage action, Escape-to-close support and reduced-motion CSS.
6. No payment, no entitlements granted, no account writes, no backend modification, no generated content, no gameplay logic, no reliance on untrusted remote art. Demo owned set is limited to built-in free items and is not production permission logic.

## Honest boundary

The current approved 64.4D photo has decor *baked into the pixels*. This prototype **cannot swap real individual compasses, plants, cups or books**. True mix-and-match requires a clean photographic plate with matching transparent prop layers and realistic shadows. The catalog/resolver is structured for that next pass. Paper/typography/ornament items are defined but not independently render-swappable until compatible layered art and page typography components are created.

## Implementation artifacts

- `frontend/src/features/cosmetics/environmentCatalog.ts`: schema, curated free catalog, world-theme preview presets, deterministic resolver and asset restrictions.
- `frontend/src/pages/game/SpaceLab.tsx`: isolated visual lab, preview control state; no persistent save.
- `frontend/src/pages/game/spaceLab.css`: workshop, environmental lighting treatments and image-aligned safe-zone visualization.
- `frontend/src/pages/game/VisualBookPlaygroundPage.tsx`: additive page variant; existing variants unmodified logically.
- `frontend/src/router.tsx`: protected isolated `/game/space-lab` route.
- `tests/adventures/test_pass64_4f_space_lab.py`: route isolation, security contract and safe-zone guards.
- `docs/PASS64_4F_COSMETIC_SYSTEM_HANDOFF.md`: full user-approved visual direction and cosmetic economy roadmap.

## Current verification and caveats

Focused reconstructed-source pytest passes for old 64.4D, 64.4E and new 64.4F. Node runtime assertions checked world/personal/custom resolution, invalid slot fallback, unowned fallback and local art restrictions. JS/TSX syntax checked via TypeScript compiler's `transpileModule`, CSS parsed. A **standalone HTML/CSS visual QA fixture** (not actual deployed React) tested 1600×900, 1280×800 and 390×844 in headless Chromium, checking horizontal overflow and preview scene selection. Full React `tsc -b && vite build` and full project checks MUST run on the user's Mac; do not claim otherwise.

## Next implementation decision

Produce *approved* isolated, alpha-bearing props and a clean plate **before** implementing prop selection in the actual UI. Build object placement from world-space art coordinates and versioned anchor geometry; then implement backend-owned inventory/equipped state, world overrides and saving; only later build store checkout.
