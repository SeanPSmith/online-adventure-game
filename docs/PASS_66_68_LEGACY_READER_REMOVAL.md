# Quillairo Pass 66.68 — Retire the Living Book, tabletop and admin-lab experiments

## Scope

Removes obsolete visual code only. No gameplay, Director, dice/D20/DC, HP/XP, turn state
machine, socket, narration, persistence, QTE/Arcade, multiplayer or backend file is touched.

## What changed

- `AdventurePage.tsx`: removed the `?reader=book` branch (`bookRequested`, `bookReady`,
  `changeBookView`), the `InkspaceLiveRoom` render and the "OPEN LIVING BOOK · PREVIEW" button.
  A stale `?reader=book` bookmark now falls through to the default Inkbound reader.
  The explicit **Classic reader** switch is deliberately preserved (separate decision).
  The `bookNotes` state was renamed `fieldNotes`; it already fed the Inkbound reader.
- `router.tsx`: removed the admin-gated `/dev` workshop and `DevLabGate`. `/dev/*` and the
  old `/game/{visual-playground,ink-lab,inkspace-story,inkspace-reader,tabletop-kit,space-lab}`
  and `/game/home-lab` bookmarks now redirect to `/game`.
- New `adventureReaderSwitchPass6668.css` keeps only the three rules the Classic/Inkbound
  switch still needs (`.adventure-layout--reader-hidden`, `.inkspace-live-entry` and its button).
- `.gitignore`: ignores `.quillairo-patch-backups/`, `.quillairo_backups/`, `.pass66-42-backup/`
  so `release-staging.sh`'s `git add -A` stops committing installer backups.
- `scripts/audit-inkscape-ui.py`: the "development gate" check became "retired lab routes stay
  retired"; the lazy-route floor moved from 25 to 22 because eight dev routes no longer exist (30 -> 22).

## Removal manifest (frontend/src)

Components: `InkspaceLiveRoom`, `LiveTabletopInstruments`, `TabletopInstruments`,
`InkspaceReaderLab`, `InkspaceStoryPage`, `InkLabBook`, `SpaceLab`, `VisualBookPlaygroundPage`,
`DevWorkshopPage`, `InkboundFoundationPage`, `InkboundHeroFolio`, `InkboundJourneyGallery`,
`InkboundOutcomePreview`, `DevLabGate`.

Modules: `inkspaceStorySamples.ts`, `inkspaceReaderPagination.ts`, `inkMaskAssets.ts`,
`features/cosmetics/environmentCatalog.ts`.

Stylesheets (each imported only by removed components): `inkspaceLiveRoom`, `liveTabletopInstruments`,
`tabletopInstruments`, `visualBookPlayground`, `inkspaceReaderLab`, `spaceLab`, `inkLabBook`,
`inkspaceStory`, `inkboundJourney`, `inkboundFolio`, `inkboundEditorial`, `inkboundSketchbook`.

Result: 212 -> 183 source files, 331 -> 302 built modules. Reachability from `main.tsx` was
verified before and after; no player-reachable file lost an importer.

## Tests

Deleted because every test in the file asserted the removed experiments exist:
13 files `tests/adventures/test_pass64_4{d,e,f,g,i2,i5,i,j,k,l,m,o,p}_*.py` and
`tests/frontend/test_pass65_{2,3,4,5_1,5_hero_and_result}*.py`.

Pruned from mixed files (only tests of removed code): two in `test_pass65_inkbound_foundation.py`,
one in `test_pass65_1_inkbound_live.py`.

Rewritten against the surviving code (protection kept, not relaxed): `test_pass65_1` (notes wiring,
plain-opacity fades), `test_pass65_7` (default reader), `test_pass65_8` (hidden classic shell),
`test_pass66_28_r2` (server hero first, now asserted inside the Inkbound element),
`test_pass66_44`, `test_pass66_57` (route floor), `test_pass66_63r2`, `hero-effects.cjs`.

Added: `test_pass66_68_legacy_reader_removal.py` — retired files stay gone; AdventurePage keeps every
live-wiring contract; router redirects; and an import-graph guard so unreferenced frontend source
cannot silently accumulate again (known exceptions: `vite-env.d.ts`, `FirstRunGuide.tsx`).

## Not changed on purpose

- **Classic reader** (`?reader=classic`, ASCII/CRT-style layout) remains until the owner decides.
  It is also the likely source of old-UI flashes while a room connects; the entry strip is still
  shown before the Inkbound reader is ready. Confirm in a browser before changing it.
- **Public artwork** is untouched. After this pass 15 images (about 3.2 MB) under `art/pass64/`
  (ink masks, `inkspace/*-cutout.png`, `scene-kit/*`, `pass64-4d-tabletop-book.webp`,
  `p644-ink-lab-*.webp`) are no longer referenced by source. They are candidates for a later
  asset-removal pass once confirmed unused by `app/web`.
- `features/onboarding/FirstRunGuide.tsx` was already unreferenced before this pass.

## Verification

Python: 953 passed, 1 skipped, 2 failed. The two failures are pre-existing and environmental
(`test_pass66_19_source_hygiene.py` needs the gitignored local `_cleanup-backups/pass66_19/`).
Static audits, 134 Node tests, `tsc -b && vite build` and the CDK build pass.
Browser/visual QA of the live site is still required.
