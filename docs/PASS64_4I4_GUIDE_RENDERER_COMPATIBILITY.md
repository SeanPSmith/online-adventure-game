# Pass 64.4I.4 — Scene-Renderer Compatibility Test

This hotfix replaces **only** `tests/adventures/test_pass64_4f_space_lab.py`.

## Why it exists

64.4I.3 mistakenly required `.space-page-polygon`, an optional renderer
from Pass 64.4G.2. The installed site may instead still use the valid
Pass 64.4G dashed-rectangle guide. Both versions can use the new 64.4I.2
wider print zones, because they consume the same `SCENE_COMPOSITING` model.

## Regression checks preserved

- cover-sized 1672×941 projection and physical-image integrity
- shared source geometry between Space Lab and Inkspace Story
- both leaves clear the actual spine and stay inside the page bounds
- page-relative gutter/outside margin rules and left/right symmetry
- explicit matching of the guide JSX to its stylesheet; a half-installed
  polygon guide fails instead of silently passing
- all existing access, catalog and gameplay-isolation assertions

Both renderer variants have been tested; mismatched JSX/CSS and deliberately
invalid page coordinates are rejected. No application code or art changed.

## Install from OnlineAdventureGame/root

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4i4-geometry-renderer-compatibility.zip && ./scripts/check-project.sh
```

Run the standard staging release only after the full check is green.
