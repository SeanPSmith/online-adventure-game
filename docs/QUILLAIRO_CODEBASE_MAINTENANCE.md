# Quillairo — source of truth and legacy boundaries

Updated 2026-10-23. This is a **source-maintenance guide**, not a runtime migration.

## Canonical brand

- Public application name: **Quillairo** (spelled Q-u-i-l-l-a-i-r-o).
- Primary public domain remains `onlinetextadventure.com`; the brand does not imply a domain change.
- Use the approved artwork under `frontend/public/brand/` without regenerating or applying filters.
- Story prompts, notification titles, exported filenames, legal notices, developer banners, and player copy should use Quillairo.
- `Inkbound` denotes an older visual component/style system; `Inkspace` denotes internal prototype components. Neither is a competing product brand. Do not bulk-rename React component names, import paths, CSS classes, asset directories, or developer preview URLs merely to rebrand them.

## Canonical runtime paths

- Frontend: React/Vite under `frontend/src`; `frontend/src/router.tsx` identifies production versus admin-only `/dev` routes.
- Backend: FastAPI/socket server in `app/main.py`; Director in `app/generation/director.py`; source planning in `app/generation/openai_provider.py`; authoring assistant in `app/authoring/ai_assist.py`.
- Illustrations: `app/generation/scene_art.py`; image generation is asynchronous and **must not gate** Director turn commits.
- Tests: Python suite under `tests`, plus Node checks in `scripts/check-project.sh`.
- Releases: `scripts/install-overlay.sh` followed by `scripts/release-staging.sh` (which calls `scripts/check-project.sh`).

## Legacy identifiers intentionally retained

| Identifier | Reason |
| --- | --- |
| `tales-of-two-theme/v1`, `tales-of-two-theme/v2` | On-disk theme format IDs required to read existing theme files. |
| `tales-of-two:notification-preferences:v2` | Existing user browser settings must not be reset. |
| `tales-of-two:notification-settings-changed` | Existing same-tab event subscribers remain compatible. |
| `tales-of-two:author:...` | Stable source identifiers; may be present in saved authoring documents. |
| `tales_of_two_director_*` | OpenAI structured-output schema identifiers; change separately only with tests. |
| `--tot-*`, `--tot2-*` | CSS custom properties already consumed across older theme layers. |
| `inkspace-*`, `inkbound-*`, `/dev/inkspace-*` | Internal selectors, React components, assets, and preview URLs. |
| Existing AWS names, instance tags and deployment resources | Renaming would imply an infrastructure migration; not a cosmetic fix. |

## Audit results and safe cleanup

- Removed retired `legacy_product_name` metadata from branding JSON; not consumed by the app.
- Normalized frontend package identity, user-facing story prompts, release banners, legal notices and theme export filenames.
- Consolidated duplicate `.gitignore` rules. The review packaging script now excludes `.aws-build/`, `.pass64-2-backup/`, and TypeScript incremental output.
- **Not deleted**: historical Pass docs/tests, old styles and artwork, classical reader and `/dev` experiments, or backing AWS names. Some may be used by active code or recovery tests. Delete only after route/import/asset tracing, regression tests and production-deployment review.
- **No database migration** or saved user content rewrite is part of this pass.

## Safe change procedure across conversations

1. Start from the latest `scripts/package-for-review.sh` full source snapshot, not reconstructed files from previous patch ZIPs.
2. Make narrow edits in that snapshot and produce an overlay of **only changed/new files**.
3. Compare changed content against the snapshot and run `scripts/check-project.sh` in the target environment.
4. Never claim full regression completion from a standalone overlay. Keep server-owned dice outcomes, Director metering, timeout rescue and asynchronous illustrations intact.

## Pass 66.19 — Conservative source hygiene

- Checked static frontend TypeScript/JavaScript imports, literal `/art` and `/brand` URLs, and file-identical image groups; `scripts/audit-source-hygiene.py --strict` runs before the test suite in `scripts/check-project.sh`. This is an early guard, **not** a complete runtime dependency or reachability proof.
- Three retired files are approved for removal via hash-guarded `python3 scripts/prune-retired-source.py --apply`: `BookPageTurn.tsx`, `bookPageTurn.css`, `StoryTimeConsentCopy.tsx`. The original page-turn was previously unmounted explicitly; the Story Time component has no active imports. The script checks for new references before applying changes, rejects modified files, and backs up originals to `_cleanup-backups/pass66_19/`. It is safe to run more than once.
- After installing the pass overlay, apply the separate guarded prune **before** running the staging release; this is intentionally explicit because overlays install/replace files but cannot safely delete existing paths.
- Five byte-identical image groups were identified and **retained**; some use different live public URLs or appear in dev prototypes/tests. Changing these requires a URL migration and broad test coverage.
- The old `app/web/` client is still mounted by FastAPI at `/static`, while `/dev` labs remain routed. Keep both pending a documented deployment cutover or route removal. Older scripts and styling are also preserved until their consumers are traced.
- No Python packages, npm dependencies, databases, cloud resources, or historical files were removed based only on a name or visual age.
