# Tales of Two — Pass 64.3A: Brighter World Foundation

Status: source overlay. **No AWS changes made by this ZIP.** Reviewed against the latest complete frontend source previously supplied by the user plus Passes 64.2, 64.2a, 64.2b, 64.2c, and 64.2c.1. Perform a full `./scripts/check-project.sh` on the current Mac checkout before deploying.

## Built in this pass

- New **Brighter World** built-in **platform** skin. It is the default for *new* local appearance preferences; explicit existing preferences and installed V1 palette themes remain unchanged. To see the new look with an existing account, **Account → Preferences → Wardrobe → Brighter World**. Do not silently erase a user's previous equipped appearance.
- Real photographic/watercolor *decorative* asset layers (`brighter-desk.webp`, `brighter-vista.webp`, `brighter-paper.webp`), with artwork-only areas extracted from the approved generated reference. The live book, Hero data, adventure titles, links, and controls are all real DOM. Illustrations are **generic atmosphere**, not fabricated covers or portraits belonging to live users.
- More compact, editorial book composition: ivory paper, fine-line chrome, compact greeting, a painterly landscape integrated into the left page, a featured journey as a paper keepsake, and a quieter right page. Desktop nav receives pale paper bookmarks. Mobile is a single flowing journal, not a shrunk two-page spread.
- Old `BookPageTurn` has been **unmounted** from `GameLayout`: no fake page-flip overlay. Short opacity-based mount animation is used for **non-Adventure routes only**. The live Reader is never remounted or faded by the shell.
- `StoryReveal` now supports optional illuminated first-letter treatment and reader typography: **Novel / Typewriter / Plain**. Controls live in **Account → Story Display**. All display preferences persist locally. Existing word-reveal and narration follow cues are preserved; no changes to story text/word splitting, dice, outcomes, or game state. The plain world Reader automatically forces plain typography and no drop-cap.
- Dedicated contract tests and revised obsolete 64.2c page-flip assertion.

## Important gaps (planned, not claimed)

- No canonical Hero portrait generation/storage/cropping pipeline and no per-adventure asset pipeline. Generic fallback art and initial medallions remain. Art identity/cost/rights and creator tooling belong in later passes.
- This does NOT ship V2 JSON theme schema or true day/night packs. V1 import/export and ownership rules are unchanged; later 64.3B introduces versioned parsing and bundled asset IDs.
- No Author Studio redesign or Admin restyling.
- No WebGL, Three.js or new client dependency. No paid token economy or marketplace.
- Fonts use **system fallbacks** (Georgia, Palatino, American Typewriter, etc.), not unlicensed remote font files. Review readable fallbacks on target devices.

## Installation and checks

Download ZIP to `OnlineAdventureGame/assets/AWS/`. From `OnlineAdventureGame/root`:

```bash
bash scripts/install-overlay.sh ../assets/AWS/tales-of-two-pass64-3a-brighter-world.zip \
  && ./scripts/check-project.sh
```

The installer is the **existing** project script. It verifies ZIP bytes but does **not** check current source fingerprints, make backups, or automatically roll back on failure. Check `git status` and preserve a clean commit first. If current files have changed materially since 64.2c.1, inspect/diff them before installing.

Only after all checks pass, inspect the actual Home and Reader locally/staging. The user may then run:

```bash
./scripts/release-staging.sh "Pass 64.3A: Brighter World living storybook"
```

## Visual verification

A local static **layout fixture** (not connected to the game) was rendered at 1600, 1280, 390, and 360 pixels with no horizontal overflow. This confirms layout behavior of representative cards and artwork only; **it is not an authenticated live browser regression**. Verify with actual long Hero names, empty catalogs, missing Hero images, actual data, and both owned Reader and plain-reading modes.

Please send live desktop/mobile screenshots after the full build; further art-direction refinement is expected. The approved concept references remain the higher visual quality target. Real generated player artwork will close the largest remaining gap.
