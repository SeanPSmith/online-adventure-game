# Tales of Two — Pass 64.4A / Fixed Living Book Home

This is the **first functional full-viewport Home stage**, not the finished art-grade overhaul of every player route.

## Structural changes

- Desktop logged-in **Home** is a bounded `100dvh` tabletop, without whole-page scrolling.
- The book is a single React page with **Home / Journeys / Heroes / Discover / Tools** views. In-place navigation uses quick ink dissolves; it never remounts an active adventure, and honors reduced motion.
- The real `createRoom`, `joinRoom`, `abandonAdventure`, `leaveAdventure`, Hero selection, adventure synopsis, co-op invite, FirstRunGuide and search controls remain in functional DOM on their designated spreads.
- Full lists scroll *inside* a page; at <=800px the book becomes a vertically flowing single-page journal with fixed bottom bookmarks.
- The desktop full-width site header is suppressed **only on `/game`** and replaced with in-stage header and bookmarks. All other pages keep the prior layout.
- The photo backdrop contains only decorative props, never UI controls or user-generated state. The illustrated scene is a separate asset.
- Existing V2 theme variables still control ink/paper and non-default tabletop environments. This pass does not create or monetize new themes.

## Important scope boundaries

The Hero Hall `/game/heroes`, Account/Wardrobe, adventure Reader, Author console and Admin are **not yet converted** into the full-screen spread container. Their entry points work from the book. The Reader retains all its gameplay behavior.

Portraits remain original initial medallions when the character has no stored art; chapter-specific cover art still uses the existing fallback resolver. A persistent art-generation backend with ownership, consent, and cost controls is a separate pass.

## Verification

- Bundled: TypeScript syntactic checks, CSS parser, structural design contracts, ZIP integrity, overlay round-trip checks.
- Required on the local Mac: `./scripts/check-project.sh`, production build, desktop screenshots at 1920x1080 and 1440x900, mobile at 390x844 and 360x740, keyboard navigation, actual Hero/journey test data.
- **Do not deploy if full checks fail.** Staging screenshots must be compared against the approved watercolor reference before broad rollout.

## Safe install (from `OnlineAdventureGame/root`)

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-4a-living-book.zip && ./scripts/check-project.sh
```

The existing installer overwrites files without making a backup; commit or snapshot before installing. No AWS deployment is performed by the installer.
