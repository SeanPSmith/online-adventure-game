# Pass 64.4E — Ink Laboratory (isolated)

## Goal

Test true organic ink disappear/reappear transitions **on the approved Pass 64.4D physical book** before changing real player pages. This is a deliberately small, protected motion experiment, not a new homepage, gameplay feature, art pipeline, or skin.

### Routes

- `/game/visual-playground` — unchanged blank-book baseline.
- `/game/ink-lab` — new temporary chapter samples, with the SAME photographic physical book/header and a real HTML ink layer.
- `/game` and all other routes — unchanged.

The ink lab reuses the existing header, menu interactions, account link, skip navigation, and `pass64-4d-tabletop-book.webp` supplied by the preceding pass. No header text is baked into new artwork. No gameplay APIs, room writes, hero writes, or new services.

## Mechanics

- 33 small 420×420 transparent WebP masks: multiscale, coherent pigment-front noise with fine fiber variations, normalized to give an organic progression rather than a linear wipe.
- Animation uses `requestAnimationFrame`, swappable mask-image URLs and progressive threshold frames. `mask-image` / `-webkit-mask-image` applies to the HTML copy and illustration; text stays selectable and images use descriptive `alt`.
- The picture is delayed slightly behind the letters. A second blurred, subtly tinted copy of the picture extends the pigment edge before the sharper watercolor arrives.
- **Exit then enter**: old chapter is masked completely away, content swaps while invisible, next chapter reveals. Rapid navigation cancels the active frame loop and continues from the current visible amount; latest requested tab wins.
- 940ms default "Slow · atmospheric" and 480ms "Quick · practical" preview speed. "Replay the ink" restarts reveal.
- `prefers-reduced-motion: reduce` switches content directly with full masks, no animation.
- Mask frames preload in the background when the lab opens. No canvas draws or pixel processing in the browser and no WebGL/Three.js.

### Important visual constraints

Physical tabletop, page material, book edges, spine, lighting, logo, parchment navigation and account menu NEVER animate, fade, scroll, or remount during an ink transition. Only the ink content area on the page is masked. Controls inside the page are part of the ink layer. Desktop keeps the full-viewport stage. Narrow screens use a separate, scrollable lab journal; production mobile journal is not touched.

### Asset budget

~0.55 MB total for 33 mask frames and ~0.19 MB for the two existing decorative art studies. This is a prototype quality/performance balance, not a mandated production choice. Frames are static versionable files, cacheable via CloudFront. The real app should eventually share one reusable `InkTransition` abstraction and may adopt SVG/WebGPU or other techniques only after comparative device measurements.

### Known limits

- Character/art studies are placeholders; hero identity and persistence are not implemented here.
- The portrait/watercolor reveal is illustrative and not authored per story.
- The mask is 420² scaled to each region; grain is not physically modeled at zoom extremes.
- Full frontend TypeScript and project regressions, actual deployed React rendering, and real hardware motion perception must still be checked locally after installation. The included standalone interactive HTML is a representative browser fixture built with the same CSS and mask assets, **not** a screenshot of the running React app.

### Installation

From `OnlineAdventureGame/root`, after saving ZIP in `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4e-ink-laboratory.zip
./scripts/check-project.sh
```

Only if full checks pass, staging:

```bash
./scripts/release-staging.sh "Pass 64.4E: Isolated ink laboratory with organic watercolor mask transitions"
```

Inspect `/game/ink-lab`. Try Home → Discover → Heroes and Replay. Compare `/game/visual-playground` to verify the untouched baseline. Do not approve production integration until motion, type readability, and reduced-motion behavior are approved on actual devices.
