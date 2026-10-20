# Pass 64.4P — Layered Photographic Scene Fidelity

## Objective

Replace the low-fidelity illustrated add-on props in the **existing protected Space Lab** with a material-accurate alpha-cutout proof, and give the HTML navigation a sampled real-paper surface. **Not a new live homepage, not a shop, and not an arbitrary CSS/theme upload system.**

## Implemented

* Base layer: unchanged approved 1672×941 original photograph (`pass64-4d-tabletop-book.webp`), with the historical cup, books, compasses, and botanical dressing still *baked in*. Do not represent that as a clean plate. `SCENE_COMPOSITING.cleanPlateAvailable` remains `false`.
* Material layer: photographed parchment fibers from a quiet interior of the existing book, used **only as a texture** on the real HTML menu; no navigation wording is painted into the file. Removed repeating seams.
* Additive photo anchors: independently composited 32-bit RGBA images of an embossed crimson wax seal and brass compass, cut from the project's own AI-generated visual concept. These are asset prototypes, not 4K master assets. Their bounds and silhouettes contain actual transparent pixels; the drop shadows follow alpha, not a rectangular box.
* Source-correct scene projection: continue to use `SCENE_COMPOSITING.propAnchors`, `sceneRectStyle`, and the existing `background-size: cover` source-plane dimensions to avoid desktop layout drift. Photo props share lighting grades with the desk; strong flat blue Moonlit hue rotation was replaced with gentler scene contrast/saturation.
* Preview: `/dev/space-lab` → **Photographic Study**; switch props individually with **My Setup**, with all picks restricted to published catalog entries. No account data writes, payments, network requests or gameplay changes.

## Honest limitations & next art gate

1. The cup and original compass **cannot** be unequipped because they are still part of the flattened original scene. The two alpha overlays are additional. A genuinely clean photographed plate of identical geometry and light is the next required image asset before monetizable slot equip/unequip can be approved.
2. Two isolated props and a paper swatch **do not make the whole app mockup-identical**. The plate is 1672×941 and remains a limiting factor on high-DPI displays. Do not upscale and label that 4K.
3. The retained game homepage and adventure stay as-is. This pass intentionally changes only the protected studio and shared dev menu material; no new app routes or audience-facing UI are created.
4. The comparison fixture uses actual CSS and assets but not a mounted production React build. User's Mac must run `./scripts/check-project.sh` before deployment. Review on staging, never promise browser parity solely from Python regression tests.

## Scene layering contract

1. Photographic base plate (must eventually be free of collectible props)
2. Baked atmosphere and scenery dressing
3. Anchored, separately loaded transparent PNG/WebP items with matching light, occlusion, alpha and contact shadows
4. Live accessible React content and controls; only story/page ink transitions

Theme appearance mode remains **Follow World / My Setup / Custom Mix**, cosmetics are *visual only*, and the environment is persistent while the ink changes.

## Verify

From `/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root`, after backing up/committing work and saving the ZIP in `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4p-photographic-materials.zip && ./scripts/check-project.sh
```

If all checks pass:

```bash
./scripts/release-staging.sh "Pass 64.4P: Photographic layered anchors and seamless parchment navigation"
```

Open protected `/dev/space-lab`, choose **Photographic Study**, compare original vs added props at desktop and mobile sizes, and check Brighter/Amber/Moonlit. Existing gameplay must be unaffected.
