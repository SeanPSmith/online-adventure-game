# Tales of Two — Pass 64.4I.2: Fuller Leaf Composition

## Design review
The photographed book is physically wider than the original story HTML printable rectangles. The user's screenshot correctly revealed visibly unused ivory around both manuscript columns. This pass widens *both* page-safe areas while retaining asymmetric page outlines, a narrower gutter margin and protective clearance from botanical borders.

## Changed
- `environmentCatalog.ts`: source-of-truth page-safe rectangles expanded from 22.6%/24.7% scene width to 26.4%/28.6%. Equalized *page-relative* external (~11.5%) and spine-side (~6%) padding on both leaves; slightly extended height.
- `inkspaceStory.css`: preserves existing irregular leaf silhouettes, ink-mask reveal, and mobile column. Refines watercolor bleed treatment and inner gutters; no cards, borders, or flattened text art.
- A new isolated geometry test.

## Deliberately unchanged
No changes to `AdventurePage`, Director/dice/XP, router, menu, book photo, ink mask assets or account state. Space Lab's guides inherit the updated common safe-zone geometry.

## Verification gates
`bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4i2-full-leaf-composition.zip && ./scripts/check-project.sh`

Do not release if tests fail. Compare `/game/inkspace-story` and `/game/space-lab` at 1280×800 and 1600×900. Confirm chapter title, art, and notes remain safely inside the book edges; no scene movement during transition. Complete React/Vite build must run on user's Mac.
