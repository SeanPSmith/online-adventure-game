# Pass 64.4I.3 — Scene Geometry Regression Hotfix

**Scope:** one test file, no runtime/React/assets changes. Apply after 64.4I.2.

## Reason
`tests/adventures/test_pass64_4f_space_lab.py` still asserted the old 64.4F page positions (`x: 0.267`, `x: 0.563`, `y: 0.258`) although the newer 64.4I.2 manuscript uses intentionally expanded page-safe zones.

## Correct contract
The updated test now verifies the photograph-to-overlay aspect mapping; the actual source-aligned Space Lab consumption of both shared safe rectangles and polygons; printable areas contained inside the measured page boundaries with spine clearance; and page-relative outer/gutter margin symmetry with increased exterior clearance. No production geometry or tests from later passes are weakened.

## Validation
Reconstructed chronological Pass 64 overlay fixture: 11 focused tests passed. Mutating the right safe-zone x coordinate to an invalid gutter margin causes the revised test to fail as expected. Full Mac project checks still required before deployment.
