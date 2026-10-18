# Pass 64.4G — Measured Gutter & Modular Accent Proof

Scope: protected `/game/space-lab` preview; also shifts ink-example content in the protected `/game/ink-lab` inward to fit the printable book. `/game` unchanged. Original blank book photo and top navigation unchanged.

## User-approved safe-area rule

Page ink sits **closer to the spine than the outside/deckled page edges**, with a measured spine axis at `x = 0.523` of the original `1672×941` scene plate. Both page safe rectangles derive from the same scene contract in `frontend/src/features/cosmetics/environmentCatalog.ts`, not unrelated CSS pixels. The same source-coordinate plane projects through centered `object-fit: cover`, including letterbox-free 1600×900, 1440×900, 1280×800, and mobile. Safe-area guides are hidden on mobile because the mobile page becomes a scrolling journal.

- Left printable: `(x .267, y .258, w .217, h .565)`; left page outer x `.194`, gutter x `.523`. Outer left margin `.073` > gutter margin `.039`.
- Right printable: `(x .563, y .258, w .218, h .565)`; right page outer right x `.882`, gutter x `.523`. Outer right margin `.101` > gutter margin `.040`.
- Slot anchors are outside the physical book bounding box; no overlap with printable areas; all positioned in source-plate normalized coordinates.

## Modular preview (deliberately not a full clean-plate system)

Adds independent `prop_left` and `prop_right` selectors to the existing free-items resolver. Small transparent alpha-WebP *illustrative prototype accents* are attached to defined external scene anchors: pressed fern or wax seal left; ink bottle or wildflowers right; defaults are **none**. World-recommended `Amber Library` and `Moonlit Folio` demonstrate distinct pairs, with player overrides when using My Setup or Custom Mix. Artwork is catalog allowlisted same-origin with fixed slot IDs, no arbitrary paths, scripts, purchases, account save, or game-state mutations. Decorative previews are `aria-hidden` and have empty `alt`; descriptive labels remain available in the workshop controls.

**Honest limitation:** The approved original background still physically contains its own tea, maps, brass compasses, leaves, and books as painted pixels. These remain visible. The add-on images are watercolor-style illustrative proofs of independent layers, not final photorealistic purchasable prop art. **Do not claim the baked objects are removable or clean plate available.** True individual prop swapping will require a high-fidelity blank desk+book plate and a coordinated set of realistic transparent prop assets, independently art-directed and reviewed at multiple viewports.

## Safety and next milestones

User cannot pass arbitrary CSS or asset URLs. `resolveScene` still enforces slot, published, version, ownership/free, same-origin catalog-only asset paths, and defaults. No purchases, entitlements, saving, or backend writes. Tests validate real asset alpha chunks and safe geometry relative to the book spine, rather than brittle arbitrary screenshot values. Reuse existing `TerminalSelect`, not native select.

Next passes: (1) produce and visually approve a *prop-free* photo plate with the **same** exact book+gutter geometry; (2) independent physically plausible prop packs with matching sun/shadows and material; (3) ownership/equip persistence for free items, then future store architecture after explicit approval. No paid cosmetics until real server entitlements and purchase flow are designed and reviewed.
