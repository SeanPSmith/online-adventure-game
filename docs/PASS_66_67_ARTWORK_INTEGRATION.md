# Quillairo Pass 66.67 — Production Artwork Integration

## What is fixed

The active reader previously rendered a world cover/fallback and the new scene art simultaneously in one transparent grid. Both were visible after the new illustration loaded, producing overlapping focal points and awkward edges. Now it retains the approved art until the optional scene image has fully loaded, then exposes exactly one artwork layer. On load error it returns to the original fallback and preserves the existing retry/error callback. The story, choices and dice are unchanged.

The manuscript uses `object-fit:contain`, actual PNG alpha, and no rectangular masks or fabricated paper fades. The chapter art is limited to a deliberate editorial region at desktop and mobile widths.

## Art acceptance and next candidates

The existing three Quillairo public PNG fallbacks, two Hero Hall PNGs, and current Inkbound panoramic illustrations were audited for *actual alpha* and a 10% transparent margin, not CSS padding. They pass. They have not been replaced or regenerated.

Opaque `/art/quillairo-public/*-cover.webp` files are intentional cover artwork, not floating cutouts. The old `art/pass64` assets are not reintroduced. Existing scene-art generation checks alpha margins before saving (app/generation/scene_art.py).

A generated PNG can pass an outer 10% alpha check while still containing a painted rectangular backdrop **inside** the cutout. This patch does not pretend CSS can remove that. Review actual production screenshots to identify and replace specific matte-containing artworks. Do not use global feathering filters or delete successfully integrated imagery.

## Validation

`python3 -m pytest -q tests/frontend/test_pass66_67_artwork_integration.py`

Release runs the same scoped regression checks, source art audit, and existing reader/turn checks. The frontend production build remains part of the site's normal release gate. Production browser screenshots are still required for visual approval.
