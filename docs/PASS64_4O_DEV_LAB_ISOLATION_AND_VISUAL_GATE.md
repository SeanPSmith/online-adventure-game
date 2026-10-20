# Pass 64.4O — Development Workshop and Visual Fidelity Gate

## Intent
Keep all seven temporary Pass 64 experiments while removing them from the `/game` URL namespace and protecting them from general player traffic. The currently deployed player experience and authoritative mechanics are unchanged. The new canonical lab index is `/dev`.

## Routing contract

- `/dev` — workshop index; authentication + admin permission required.
- `/dev/visual-playground`, `/dev/ink-lab`, `/dev/inkspace-story`, `/dev/inkspace-reader`, `/dev/tabletop-kit`, `/dev/space-lab`, `/dev/home-lab` — same components/behavior as before, new canonical paths.
- Old `/game/<lab>` URLs temporarily **redirect** to `/dev/<lab>` to preserve bookmarks and historical source tests. These redirects should be removed in a future explicitly announced cleanup after links are updated.
- `/game`, `/game/adventure/:roomId`, Hero, author, account, and existing player routes stay unchanged.
- The admin-only gate is a UI discoverability/isolation measure, *not* backend permission enforcement. The server continues to own authorization for all state-changing requests.
- Existing author-console, staging shell, and AWS infrastructure are not modified.

## Fidelity failures we are fixing next (not solved by this routing patch)

1. The source book plate is 1672×941 and softens on high-DPI desktop monitors. Produce high-resolution clean base plates first; never upscale the current image as a substitute for detail.
2. Original mockups have detailed physical depth, coherent wood/paper texture, contextual lighting, tasteful irregular watercolor cutouts and coherent typography; the current DOM/CSS render does not yet reach that level.
3. Book print areas need a measured per-scene contour, not one generic rectangle. Validate actual typography, gutters, outer margins, art collisions, overflow, and safe areas at 1280×800, 1440×900, 1600×900, 1920×1080, and mobile widths.
4. For customizable themes, the **base plate** contains only the table/book, **baked dressing** is non-collectible surface texture, and **anchor objects** are *separate* transparent alpha artwork with stable scene-relative placement and lighting-matched shadows. Never bake saleable, swappable items into the plate.
5. Page art must be genuine standalone transparent illustrations with hand-painted contours, sufficient transparent margins, and meaningful `alt`; never rectangular thumbnails with a CSS gradient masquerading as a cutout.
6. Physical book/tabletop/header remain static; only actual text and art dissolve/reform through fully loaded ink masks. Repeat/interrupt/quick-toggle/reduced-motion behavior must be covered by browser tests.
7. React controls must feel intentionally physical **or** overtly magical/floating—never flat CSS rectangles impersonating leather tabs. The reader needs real data, in-game Hero/Chat/Notes instruments, and honest persistence claims.
8. Client-side source/test assertions alone are not visual verification. Require real Playwright/Chromium screenshots of the installed React route, side-by-side with a target reference, before calling a visual pass approved.

## Suggested visual acceptance gate for every future art/layout pass

- **Separate approvals:** Functional / visual / responsive / accessibility / performance. All five needed before promoting a lab to the main route.
- Screenshot at target aspect ratios and inspect typography, binding, highlights, UV texture, prop alignment, print-area offsets, and art silhouettes at 100% and 2× display densities.
- No overlapping controls or clipped ink; no full-page scroll in desktop reading mode, with only deliberate page-local pagination; phone uses a readable single-page flow.
- Preserve ability to switch to the prior interface during migration. Do not redirect production traffic to experiments until explicitly approved.
- Preserve `./scripts/check-project.sh` as the regression gate and deploy only after full suite passes on the user's Mac.

## Next build order

1. **64.4O** workshop route cleanup (this pass).
2. **64.4P** real-browser visual parity harness (automated baseline comparison + interactive screenshot set), followed by fixing the most visually damaging mismatch.
3. **64.4Q** art asset pipeline: clean higher-res table/book, separate baked dressing and independent alpha props.
4. **64.4R** promote the authenticated home and live reader only after visual and functional review, not by copying CSS blindly.

## Installer

Standard ZIP overlay from `OnlineAdventureGame/root`: `bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4o-dev-workshop.zip && ./scripts/check-project.sh`. No AWS infrastructure changes.
