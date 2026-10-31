# Pass 66.72 — Orphaned artwork removal

Deletes 66 files (about 5 MB) from `frontend/public/art/pass64/`: the desk, tabletop, physical-book,
watercolor-lab, ink-mask, inkspace cutout and scene-kit images belonging to the retired experiments removed in
Pass 66.68. A repository-wide search (source, backend, scripts, infra, tests, CSS, HTML) found no live reference
to any of them. Kept: `scifi.webp` and `gothic.webp`, used by the public home page examples.

Guard: `tests/frontend/test_pass66_72_no_orphan_pass64_art.py` fails if unreferenced art returns or source
points at a deleted file. The transparent-artwork margin audit (>=10% clear margin) still reports 0 pieces
below threshold across the remaining 17 art files. No gameplay, backend or style code changed.
