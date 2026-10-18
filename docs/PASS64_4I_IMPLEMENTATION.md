# Tales of Two — Pass 64.4I: Inkspace Story Surface

Status: isolated React prototype overlay, **not** an integration with the authoritative Adventure Room.

## Why
The Living Book shell/Ink Laboratory are approved. The next step is to make story prose, editorial headings, illustration, marginalia and decorative initials feel naturally written into its pages, with the desk/book/header remaining physically stationary. The user's illuminated medieval manuscript reference informs the treatment, without copying its historical blackletter body text.

## Route and behavior
- Protected route: `/game/inkspace-story` registered next to the existing visual, ink and space labs, outside `GameLayout` so no duplicate header is created.
- Shared `VisualBookPlaygroundShell` renders the established photographic tabletop and real DOM header unchanged. The new component renders **only story-page content**.
- Three sample modes: `narrative`, `art-forward`, `illuminated`. Switch with the small on-page choices; header tabs also select a corresponding sample composition. The Page Composer is a **preview**, not a story engine.
- Two-page geometry comes directly from `SCENE_COMPOSITING.contentSafeZones` via `sceneRectStyle`, projected through the same 1672×941 cover scaling as the background. The ink leaves carry subtly curved `clip-path:polygon` shapes. Controls remain selectable.
- Real `<h1>`, `<p>`, `<figure><img alt=…>`, `<blockquote>`, drop cap and ruby-red rubrication. No image contains interface typography.
- The existing 33 WebP alpha masks change **only** `.inkspace-page-ink`; the background, leather edges, paper, title bar and profile menu do not receive motion/masks. Animation supports reduced-motion and interruption.
- On narrow screens the two leaves become a vertical, scrollable ivory journal; desktop remains a fixed spread. Small screens use a mobile viewport and do not attempt to shrink two pages into unreadable columns.

## Files
- `frontend/src/router.tsx` — one isolated route.
- `frontend/src/pages/game/VisualBookPlaygroundPage.tsx` — export one playground wrapper, rendering the story surface only when `storyLab` is true.
- `frontend/src/pages/game/InkspaceStoryPage.tsx` — data renderer, graphical typography, actual mask choreography, accessibility and style controls.
- `frontend/src/pages/game/inkspaceStorySamples.ts` — typed `InkspaceStorySpread` and `InkspacePageContent` schema + three illustrative samples.
- `frontend/src/pages/game/inkspaceStory.css` — page-projected editorial composition and mobile journal.
- `frontend/public/art/pass64/inkspace/river-fortress.webp`, `forgotten-crossroads.webp` — isolated painterly illustrations, not an entire page mockup.
- `tests/adventures/test_pass64_4i_story_surface.py` — opt-in route, accessibility, real HTML, mask and geometry contracts.

## How to install and test

Download the overlay into `OnlineAdventureGame/assets/AWS/`. From `OnlineAdventureGame/root`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4i-inkspace-story-surface.zip && ./scripts/check-project.sh
```

Only after the full suite and React production build pass:

```bash
./scripts/release-staging.sh "Pass 64.4I: Inkspace Story Surface, illuminated prose, watercolor art, and manuscript transitions"
```

Then open `https://onlinetextadventure.com/game/inkspace-story`.

## What is verified, and what is not
- Pass-specific pytest contracts and TSX syntax checks pass. Browser-rendered **standalone DOM fixture** at 1600×900, 1280×800, and 390×844 for all modes showed no horizontal overflow, and each image decoded. Ink masking was separately inspected mid-reveal.
- The user's **complete** project suite and production React build are **not executable in the reconstructed source snapshot** (the full project dependencies/lockfiles were not supplied). The user must run `check-project.sh` on their Mac before deploying.
- An attempt to run source with preinstalled browser React 16.0 could not exercise the current React 19 hooks; no production runtime pass is claimed.
- The reconstructed cumulative baseline's 51 Pass64 tests give **49 passed, 2 pre-existing mismatches in unchanged files** (`test_pass64_2c_theme_workshop` vs snapshot `AccountPage.tsx`, and `test_pass64_4f_space_lab` vs later G2 CSS). Neither failure is caused by the 64.4I files, and this overlay does not weaken or rewrite older tests.

## Constraints and next steps
- Not connected to the Director, character/room persistence, dice, choices, user-provided text, or authoring flow. No backend writes, account changes, or payments.
- Two new pieces of sample art were cropped from newly generated concept imagery. Their resolution suffices for a playground, not the final art-generation pipeline.
- Future follow-up `Pass 64.4J` should integrate **authoritative server story content** with the same page atoms, retaining selection mechanics and avoiding overlay-generated game decisions. Dynamically authored copy will need pagination/overflow validation.
