# Tales of Two — Pass 64.4I.5: Poetic Ink Reliability & Isolated Page Art

## Purpose
Refine the approved illuminated manuscript before binding real Director gameplay.
Do **not** alter the photographed tabletop, book shell, top navigation, server
state, dice mechanics, Hero progression, or live `/game` screens.

## Corrected ink motion

- Both `/game/ink-lab` and `/game/inkspace-story` await **decoded** images for
  all 33 WebP mask stages before starting animation. Merely assigning `img.src`
  to the browser cache was not a reliable barrier, especially in Poetic/Slow.
- Share one preload promise across the two labs, and retain image references so
  decoded textures are not immediately reclaimed by garbage collection.
- A fresh selection cancels the previous RAF and exits *from its current mask
  progress*; it never resets to a conflicting frame.
- New HTML content is revealed only after React has committed that content
  (`useLayoutEffect`), eliminating the old `requestAnimationFrame`-before-commit
  race which could briefly show the previous spread or an empty page.
- Switching Quick/Poetic mid-transition resumes the current progress. Only an
  intentional Replay resets the paper to blank.
- A failed image decode removes the masks and shows normal, readable content.
  Reduced-motion preferences likewise avoid animation.
- Avoid redundant CSS `mask-image` writes when the frame index is unchanged.

## Page artwork

- Real transparent RGBA PNGs: `river-fortress-cutout.png`,
  `forgotten-crossroads-cutout.png`, `harbor-traveler-cutout.png`.
- The PNG *itself* defines the painting's irregular pigment/negative space;
  CSS no longer overlays a radial gradient to disguise rectangular artwork.
- Images remain real `<img>` elements with nonempty `alt` text; no story copy or
  UI is embedded into the PNGs.
- The original WebP files are retained for compatibility with older tests and
  current consumers; only the isolated Story Surface samples switch assets.
- This is a first production-style demonstration of the **separated artwork
  asset contract**; it is not the final per-world illustration generation system.

## Validation completed in the packaging environment

- 38 Pass 64 focused Python regressions passed (including three new checks).
- A Node execution test of the actual TypeScript-preprocessed preloader passed:
  33 decoded frames, shared cache identity, no redundant load, CSS mask application,
  failure fallback.
- Syntax checked with local TypeScript for all changed TSX/TS files.
- Browser reference-layout checks at 1600×900, 1280×800, and 390×844:
  illustrations loaded, zero horizontal overflow, zero JS page errors. **These
  are stand-alone composition proofs, not compiled React runtime tests.**
- Full `tsc -b && vite build` and full project checks are intentionally delegated
  to the user's installed app and dependencies.

## Installation (standard overlay)

From `OnlineAdventureGame/root` with the ZIP saved to `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4i5-poetic-ink-and-art-cutouts.zip
./scripts/check-project.sh
```

If green:

```bash
./scripts/release-staging.sh "Pass 64.4I.5: Poetic ink stability and transparent story art"
```

## Staging QA

1. On `/game/inkspace-story`, switch Story → Illustrated → Illuminated
   repeatedly **during** the reveal; verify old letters never ghost on new pages.
2. Press Replay 5–10 times in Poetic mode. Switch speed halfway through a reveal.
   The book, lighting, navigation and paper must not change or flicker.
3. On `/game/ink-lab`, rapidly select Home, Heroes, Discover, and replay.
4. Confirm reduced-motion OS setting displays complete content without the ink
   animation, and a failed mask request never strands blank pages.
5. Inspect watercolor illustration edges against the ivory page: no hard rectangle,
   CSS radial-frame effect, or embedded text; image alt text remains meaningful.
6. Check desktop and mobile; the page-content clipping and reading geometry should
   remain unchanged from the approved full-leaf composition.

## Next step

**Pass 64.4J — Gameplay on the Page:** map authoritative Director narration,
choice lock and choice UX, dice and effects feedback onto the story surface.
Do it in stages; don't let the page presentation invent or mutate game outcomes.
