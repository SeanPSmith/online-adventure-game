# Pass 65.0 — Inkbound Editorial Fantasy Foundation

**Source baseline:** user-provided `root-review-20261020-130945.zip` (Oct 20, 2026)

## What this overlay actually changes

- Adds `/dev/inkbound` **inside the existing authenticated administrator-only DevLabGate**.
- Adds a genuine React/TypeScript editorial-frontispiece and chapter-reader preview.
- Provides two paper tones, novel-style typography, decorated initial, transparent ink art, responsive illustrated choices, selected/committed UI states, hero status, journal and character dialogs through the actual shared ModalProvider.
- Reuses the existing 33-stage `inkMaskAssets.ts` animation, including decode preflight, cancellation, fallback, and reduced motion.
- Adds a `.inkbound`-scoped foundation stylesheet; portal dialog overrides are scoped with `body:has(.inkbound)` and cannot affect other routes when the preview is not mounted.
- Adds alpha-cutout images with safe space on all four sides and a separate paper texture; art is **not** a baked HTML screenshot.
- Adds standard-library test coverage of protected routing, isolation, alpha channels, and safe margins.
- Links the preview from `/dev`.

**No player-facing routes, gameplay hooks, persistence, Story Director calls, socket traffic, dice outcomes, permissions, Story Time settings, admin logic, backend code, existing themes, or existing game CSS have been modified.**

### Artwork status — important

The `hero-vista`, `north-road`, and three small accent illustrations are **provisional cutouts processed from the user's approved visual-reference images**. They have real, verified RGBA alpha and transparent margins; their paper is not stored inside the image. They are appropriate for visual direction testing but are **not newly commissioned original production illustrations**. Replace with custom isolated artwork once the layout is approved. Do not generate opaque or edge-to-edge replacements.

### Preview interactions

- Frontispiece / The Story switches actual React content without changing the game.
- Two paper tones are selectable in the demo; persisted theme preferences are intentionally not touched.
- Chapter choices may be selected, confirmed, and advanced to another **deterministic sample** chapter. No simulated roll or effect is represented as a real backend action.
- Journal and hero controls open the **existing shared accessible modal** with example content.
- Real game link navigates to `/game`.
- 33-frame ink reveal runs for chapter changes if assets decode and motion is allowed.

## Integration inventory and next implementation targets

The ZIP contains approximately 38 router path declarations and 35 frontend CSS files from multiple historical visual generations. This overlay deliberately avoids rewriting them en masse. Next reskin passes should tackle:

1. Public site: `PublicLayout`, `PublicHomePage`, login, registration, password reset, legal pages, shared nav and footer.
2. Authenticated library: `GameLayout`, `GameHomePage`, Heroes, sheets, history, adventures, graveyard, author and account navigation.
3. Live adventure: `AdventurePage`, `InkspaceLiveRoom`, `ChoiceInspector`, `StoryReveal`, dice and turn theater, mobile choices, notes, chat, Story Time and party drawers.
4. Every dialog/overlay: shared `ModalContext`, `HeroDeathModal`, `LevelUpModal`, `QuickEventModal`, `TurnTheater`, invite/share controls, account/admin dialogs, reconnect and error treatments.
5. Arcade game shell and every mini-game's overlays; author/admin can receive restrained ink styling without extensive commissioned art.

**Migration invariant:** preserve the canonical lobby readiness > begin adventure > first Director scene, and the server-owned choice lock > authoritative roll/outcome > intermission > next scene. Design states must map to real state instead of introducing decorative false mechanics.

## How to install and test on the developer Mac

From the real project root:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass65_0_inkbound_foundation.zip && ./scripts/check-project.sh
```

If checks pass, run the local app as usual and visit **`/dev/inkbound`** as an administrator. Inspect both Frontispiece and The Story at the mockup viewport and on mobile. Test selection/commitment, both dialogs, and the paper switch. Do not deploy to public traffic until visual comparisons and the full build are satisfactory.

Optionally, after review and Git commit:

```bash
./scripts/release-staging.sh "Pass 65.0 — Inkbound Foundation preview"
```

The ZIP deliberately does **not** auto-deploy or alter infrastructure.

## Validation completed in the analysis sandbox

- 12 focused / related Python frontend tests passed.
- 23 existing Node route/turn/audio regressions passed.
- New TSX and changed router/workshop TSX passed standalone TypeScript syntax transpilation.
- New stylesheet parsed successfully with PostCSS.
- Alpha channel margins inspected with stdlib PNG pixel parser.

**Environment limitation:** `npm ci` could not resolve the external npm registry; full `npm run build`, complete Python pytest collection (missing `socketio`), and browser screenshot comparisons were **not performed** in this sandbox. The local `check-project.sh` and visual acceptance are still required.
