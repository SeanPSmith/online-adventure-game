# Pass 66.15 — Quillairo Hero Hall, Character Sheet and Graveyard

This is an incremental visual/functionality overlay to install after Pass 66.14.2.
It is not a standalone frontend or a substitute for the production build.

## Changed player-facing surfaces

- **Hero Hall** (`/game/heroes`): editorial hero intro with actual transparent illustration; filter/search living, retired, fallen and all Heroes; selected private portraits loaded in bounded batches; approved monogram fallback; inline themed confirmation for retire, restore, burial and deletion. Permanent deletion still requires an exact-name match.
- **Hero Sheet** (`/game/heroes/:heroId`): three-column manuscript frontispiece with real selected portrait/candidate, identity and live health/XP; return to optional portrait generation when attempts remain; original authored biography edit, stat/skill/talent spend queues, server advancement and completed stories retained. Equipment and active conditions read from the existing Hero payload.
- **Graveyard** (`/game/graveyard`): shared memorials without ASCII gravestones or leaking private biography. Uses the existing public memorial endpoint.

## Art policy

The two new decorative image assets are separate RGBA PNGs with at least 10% fully transparent safety margin, using alpha-isolated existing Quillairo watercolor art. No text, UI, rectangles, artificial gradient masks, or corner feather effects are baked in. Hero portraits are actual private API media; unknown Heroes use a compact approved monogram instead of fabricated portraits.

## Boundaries

No backend, database, gameplay, turn-controller, or AWS settings are changed. The portrait service comes from Pass 66.6 and must already be deployed. The existing service routes are authoritative for every value and destructive action. No assumptions are made about individual equipment artwork.

## Verification performed

- 55 Hero and new archive Python tests passed in the reconstructed source with the Pass 66.6 Hero model restored in the test fixture.
- 18 Node Hero legacy and turn-flow tests passed.
- Changed TSX parsed successfully with the TypeScript parser; CSS parsed with tinycss2.
- Browser-based *CSS layout fixtures* (not the authenticated React application) checked six palettes on desktop and mobile without horizontal overflow.
- New artwork decoded and perimeter transparency verified using Python's standard library in the included test (no Pillow dependency).
- Full TypeScript/Vite build, authenticated portrait behavior and live co-op remain staging acceptance requirements.

## Installer

From the project's `root` directory, after copying this overlay into `assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass66_15_quillairo_hero_archive.zip \
&& ./scripts/release-staging.sh "Pass 66.15: Quillairo Hero archive"
```

## Next release candidates

- Individual Arcade boards (including mobile/co-op/sound states) with real QTE/turn flow acceptance.
- Remaining Author Studio and admin surfaces.
- Higher fidelity artist-supplied Hero portraits and chapter illustrations; no screenshot crops masquerading as transparent assets.
