# Tales of Two — Living Book, Environment Engine & Cosmetic System V1
**Durable next-chat handoff · October 18, 2026 · Pass 64.4E.2 baseline → Pass 64.4F**

> **READ FIRST IN THE NEXT CHAT:** This document is the current, user-approved product direction. Respect the creative north star, preserve the approved visual laboratory, and continue implementation rather than brainstorming the same vision again. The user values production visual fidelity to the approved reference above any specific rendering technology. They have explicitly authorized the build direction below.

## 0. Immediate status, locations and workflow

- Product: **Tales of Two**, AI-directed solo/cooperative fantasy/sci-fi story adventure. React/TypeScript frontend, FastAPI backend, AWS staging at `https://onlinetextadventure.com`.
- User's Mac project root: `/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root`.
- Standard ZIP download folder: `/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/assets/AWS/` (relative to root: `../assets/AWS/`).
- Existing overlay installer: `bash scripts/install-overlay.sh ../assets/AWS/<overlay>.zip`. Then `./scripts/check-project.sh`; **only on fully green checks**: `./scripts/release-staging.sh "Pass N: description"`. Avoid asking the user to manually perform repetitive multistep actions: give one command for installer+checks and a separate deploy command gated by green checks. Installer overwrites matching files; commit/back up existing work.
- Last deployed/current screenshot: **Pass 64.4E Ink Lab**, protected at `/game/ink-lab`; photographic blank-book playground `/game/visual-playground`. Latest 64.4E.1 and 64.4E.2 hotfixes fix respectively a test-only Pillow import and `useRef<HTMLDivElement>` TypeScript build mismatch. User screenshot praised the ink lab, ink absorption/reappear transitions and typography as *much closer* to the vision; mild text safe-area intrusion remains to correct. Full checks after 64.4E.2 not explicitly shown in chat, but screenshot proves route running.
- `/game` is still the older production player homepage and should **not be silently replaced** while the new visual foundation is being perfected. New experiments should be isolated, protected routes, with genuine browser screenshots and honest distinction between sample data vs connected gameplay.
- Reconstruct source from `tales-of-two-ui-source.zip` and chronological Pass 64 overlays, especially `tales-of-two-pass64-4d-visual-playground.zip`, `tales-of-two-pass64-4e-ink-laboratory.zip`, `tales-of-two-pass64-4e1-stdlib-mask-test-hotfix.zip`, and `tales-of-two-pass64-4e2-bloom-ref-type-hotfix.zip`. **Do not treat the base source ZIP as current by itself.** If the user supplies a more recent source, use that instead.

## 1. Creative north star — NON-NEGOTIABLE

The interface is a **physical, photorealistic desk with an open antique/literary book**, not a normal scrolling website or flat dashboard with faux-page panels. Inspiration: sunlit, tactile desk wood, light through foliage, tea, botanicals, old maps, brass compass, rich but restrained hand-painted watercolor in the book; incredible typography, layered ink, believable paper fibers, page-stack thickness, leather spine, natural shadows and props. Premium and intricate rather than a generic theme/palette swap.

**The desk, book, spine, paper, light, top parchment menu and other physical environment pieces stay pixel-stable when switching tabs. ONLY content 'printed on the pages' disappears/reappears.** Transitions MUST be actual alpha-mask/pigment/ink-absorption/feathered watercolor masks, not cheap full-spread opacity fades, not faux page flips. Current ink lab uses ~33 precomputed alpha WebP frames; keep and improve it. Support interruption/race safety and `prefers-reduced-motion`.

Top menu is an elegant, real, accessible HTML/React parchment strip with **no lettering baked into the scene artwork**. Logo similarly live DOM, not duplicated by the photograph. The existing photographic blank-book background `/art/pass64/pass64-4d-tabletop-book.webp` is an approved foundation. No fake second set of side tabs attached to the book; navigation is already in the header/left arrangement. **Visual fidelity matters more than using Three.js**: prefer efficient HTML/CSS/SVG/layered illustrated/photo assets if they achieve the approved result. Never claim tests alone prove the deployed visuals match the reference; inspect actual browser screenshots at desktop/laptop and mobile.

Desktop: full-viewport immersive scene, book centered, no body-long scrolling. Page-internal overflow only when needed. Mobile: intentional separate single-page journal, vertical scrolling, legible text/tap targets, reduced motion. Accurate content safe zones: avoid gutter, botanical margins and deckled edges. Actual text stays selectable accessible HTML, not embedded in a generated image. All content photos/images have correct alternative text; purely decorative images use empty alt and are hidden as appropriate.

## 2. The newly approved product vision — personal customization and cosmetic economy

Players **own their reading space**. A world/adventure can recommend a richly art-directed theme, but the player may use their own favorite setup, or mix-and-match compatible pieces from worlds/packs/individual purchases. Selling purely cosmetic skins and decorative objects is an intended future product capability; build a store-ready domain model now **without adding live purchases, fake entitlements, billing, checkout, or gameplay changes yet**.

The player controls: desk/tabletop, physical book shell and binding, page material, decorative objects in independently positioned slots, light/day-night, ink appearance, typography, botanical/marginal ornaments, potentially ambient effects, bookmark/wax seal. Objects include cups, coffee, mugs, tea, brass compasses, ink/pen/quill/watercolors, candles, plants/vases, flowers/herbs, maps, books, charms, crystals, seals, curios.

Approved families/examples: **Brighter World** (wood/sun/tea/flowers), **Leatherbound** (dark desk/ink/brass/candle), **Garden Table** (herbaceous/cozy ceramics), **Starward** (metal/obsidian/star-chart), **Ink & Ash**, **Bloodmoon** (gothic); future nautical, apothecary, seasonal etc. Day and night variants when practical. Allow mixing across packs where placement and aesthetic constraints permit, with safe defaults.

**Gameplay fairness:** every premium item is *cosmetic only*, never modifies HP, XP, difficulty, combat odds, RNG, story choices, access to content, QTE timings, or other server-authoritative mechanics. No pay-to-win. Never send untrusted theme assets as arbitrary CSS, JS, executable code, external URLs, or unrestricted SVG. Catalog is versioned/curated and asset paths are allowlisted same-origin. No real-money purchase implementation until expressly requested.

## 3. Three player-facing appearance modes (clear UX)

1. **Follow the World** (`follow_world`): apply that adventure/world's recommended scene + theme, with catalog defaults for missing slots.
2. **Use My Setup** (`my_setup`): apply player's saved equipment, independent of world suggestions.
3. **Custom Mix** (`custom_mix`): for each slot, deliberately choose `world` or `mine`, plus an optional individually selected owned item; fully deterministic, comprehensible preview with a reset.

Worlds **recommend**, never override player preference. For unsupported or unowned selected items: fall back safely and visibly; no nonexistent asset requests. A bundle grants a collection of individual item entitlements in a future storefront; user still equips pieces slot by slot. A store should be able to sell both complete curated themes and individual pieces. Keep entitlement proofs server-side when purchases exist.

## 4. Versioned cosmetic slot contract

Use stable item IDs, theme IDs, asset IDs and revision/version identifiers. Suggested V1 slots:

- `environment`: tabletop material, surrounding stationary scene/photo plate.
- `book_shell`: physical book size, binding, hardware, cover and page geometry.
- `paper_material`: ivory, smooth cream, aged parchment, vellum etc; constrained to page geometry.
- `prop_left` and `prop_right` (expand to precise anchored slots like `top_left`, `bottom_left`, `top_right`, `bottom_right` if needed): independent transparent, lighting-matched props, no overlaps with book content/header.
- `ink_style`: readable color, bleed, masks/reveal tuning.
- `typography`: font family/scale and optional decorative initial, with fallback/responsiveness.
- `ornaments`: botanical borders, marginalia, cartographic lines, compass drawings.
- `lighting`: day, dusk, moonlight etc; visual only.
- Future: ambient FX, bookmarks, wax seals, tabletop mascots.

Schema example (illustrative, NOT already implemented):

```json
{
  "schemaVersion": 1,
  "itemId": "decor.brass_compass.01",
  "slot": "prop_right",
  "packId": "pack.brighter_world",
  "asset": "/art/cosmetics/props/brass-compass.webp",
  "anchorId": "outer_right_lower",
  "layoutVersion": "bookspread.1",
  "alt": "A weathered brass compass resting beside the book",
  "cosmeticOnly": true,
  "published": true
}
```

Recommended domain objects: `CosmeticItem`, `ThemePack` (partial slot defaults + version), `UserCosmeticEntitlement`, `PlayerEquippedSetup`, `AdventureRecommendedTheme`, `CosmeticResolution` (fully resolved items + provenance). `owned` ≠ `equipped`. Version migrations must not brick older saved setups or randomly equip paid items.

## 5. Art-production pipeline and compositing

**Critical discovery:** The approved Pass 64.4D image is a *single flattened illustration/photo-composite*, with some props already baked into corners. That is fine for the approved foundation, but does NOT permit convincingly swapping just the compass/cup. Do not fake it by covering baked-in props with CSS vector drawings or pretending all objects are independently removable. Before true a-la-carte prop customization, produce a real layered scene kit:

- **Clean plate**: tabletop + correctly positioned open book, no props, no text/UI, with fixed geometry and camera/light calibration. Strong composition and realistic page texture, believable binding/spine, natural ambient shadows.
- **Prop layers**: physically plausible transparent high-quality WebP/PNG sprites with matching top-down perspective, contact shadow, light direction, plausible scale; objects isolated and positioned in validated anchors outside book/page safe zones. Each prop has alt/accessibility metadata.
- **Book & page material variants**: consistent geometry so paper/content-safe zones don't shift unpredictably. If changing geometry, each variation ships its own calibrated anchors/safe zones.
- **Asset manifest**: fixed pixel dimensions/aspect ratio, anchor points, safe polygons/rects for left/right pages, do-not-cover header zone, viewport adaptation, color palette/lighting, file integrity/license/origin, variants (desktop/mobile, DPR, day/night).
- **Generation templates**: prompts must constrain overhead camera, book opening angle, spine at same x, page corners, lighting vector, shadows, physical material, blank unlettered pages; separate prompt for prop plates. Never bake content, logo/menu text, fake controls, hero imagery into background.
- **Art QA**: review actual crop at 1600×900, 1440×900, 1280×800, portrait phone; check typography safe zone, texture continuity, margins, no floating/duplicate props, page perspective, consistent photographic quality, realistic blending and small file size. A generated scene is a candidate until visually approved, not final on generation alone.

Design all cosmetic swaps so **the book+environment remains stable on page navigation**. Changing a scene or prop is a separate wardrobe action (gentle physical crossfade), not part of chapter navigation transitions. Art text continues to animate exclusively via mask engine.

## 6. State architecture and precedence rules

Inputs: allowed `Catalog`, `worldRecommendation` (optional), `playerOwnedIds`, `playerSavedSetup`, `selectionMode`, `customMixSlotSource`. Output: one fully validated `ResolvedCosmeticScene` containing normalized slot choices and asset references; each choice includes source `world`/`mine`/`fallback`. Never trust local browser purchase claims. At V1 preview stage, use deterministic seeded/default inventory and local draft state, not payment servers.

Resolution:

```
for each slot:
  follow_world => world item OR built-in free default
  my_setup     => player equipped owned item OR built-in free default
  custom_mix   => explicit owned choice if valid,
                  else choose world vs player by slot source,
                  then built-in free default
```

Validate item actually belongs to slot, is published, is available for the current scene/layout, and is owned/free before using it. Unsupported combinations should have deterministic, documented fallbacks and explanatory UX. Equip updates only the player's cosmetic setup; never mutate story state. Preview changes are temporary until explicitly saved in later releases. Plan eventual persistence behind authenticated API with concurrency-safe `version`/`updated_at`; entitlements are server-side, obtained via verified store events with replay/idempotency control, never forged by frontend.

## 7. Release sequence and scope boundaries

**Pass 64.4F — Environment & Composition Lab (NOW):** in a separate protected route, implement a versioned typed catalog/resolver, scene normalization/safe-zone geometry, a small high-quality preview/workshop; do not modify `/game`, `/game/ink-lab` or backend game logic. If proper isolated prop assets are not yet available, do not claim the baked props are dynamically swappable. Use real working lighting/space previews and documented slots, while art production creates a clean plate. Focused regression tests, full build, screenshot review; generate standard overlay ZIP.

**Next Pass — Real Scene Kit & Props:** generate/curate a vetted clean plate and 6–12 individual photographic transparent prop assets, anchor maps, collision/safe-zone checks; consistent art direction and real mix-and-match.

**Next Pass — Cosmetic V1 Storage/Equipping:** catalogue persisted server-side, player-owned free inventory, equip/save/restore, world recommendation modes, Wardrobe page. Keep author-recommended theme optional and nonauthoritative. Tests validate permissions, fallback and forbidden data.

**Later:** priced theme packs, individual items, commerce checkout/webhooks/entitlements, refunds/revocations, merchandising, gifting, seasonal editions; only after explicit approval and security/billing review.

## 8. Hard-earned engineering/testing lessons

- Source overlays are relative paths with no folder wrappers. Do not accidentally replace unrelated existing React components or weaken security/regression tests. Preserve `/game` and both approved lab routes unless expressly integrating after screenshot review.
- Pass 64.4E introduced 33 WebP masks. A Python regression imported Pillow even though it wasn't a project dependency; hotfix 64.4E.1 replaced with standard-library validation. Pass 64.4E TS build used `useRef<HTMLElement>` on a `<div>`; hotfix 64.4E.2 changed to `useRef<HTMLDivElement>`. Ensure build/typecheck not only lint/static checks.
- Current user request: **'write this map down for the next ChatGPT and let's proceed'**. Provide a durable handoff file, then an actual next-pass implementation. User wants action, standard ZIP overlays, clear test and deploy commands, and screenshot review. Do not generate more decorative concept images as a substitute for React code.

## 9. Definition of done for the next implementation pass

- Playgrounds remain working, separate and protected.
- New environment preview demonstrates real, visually coherent changes; *never claim baked-in props are independently interchangeable*.
- Typed catalog and deterministic composition rules are implemented and tested independently of billing and game mechanics.
- Safe zones are explicit in geometry and can be audited/visualized, including mobile adaptations.
- Public assets are same-origin/validated. No executable theme payloads or price/payment side effects.
- Keyboard operation, descriptive alt and decorative-image semantics, `prefers-reduced-motion` and contrast maintained.
- Standard overlay ZIP + focused checks, then ask user to run `./scripts/check-project.sh`, deploy only if green.
- Once the approved physical scene matches reference and clean plate/prop layers exist, implement true personal space customization, saved setup, world override precedence and later monetization.

**One-line product tenet:** _The environment is yours. The story is shared. The world can suggest, but never dictate. The book stays; the ink changes._
