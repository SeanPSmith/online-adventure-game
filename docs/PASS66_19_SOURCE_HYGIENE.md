# Pass 66.19 — Source hygiene, low-risk retirement

This pass is based on `root-review-20261023-105414.zip` with Pass 66.18 applied. It makes no gameplay changes.

## One-time staged release

From the `root/` directory after placing ZIP under sibling `../assets/AWS/`:

```bash
bash scripts/install-overlay.sh \
  ../assets/AWS/pass66_19_quillairo_source_hygiene.zip \
  && python3 scripts/prune-retired-source.py --apply \
  && ./scripts/release-staging.sh
```

The new prune utility is distributed inside the overlay, so the install step must precede the prune step. All three operations stop on an error. The release script runs the full verification suite before pushing or deploying.

## What is removed, and why

Only three files are removed, after their SHA-256 digests and incoming reference state are checked:

- `frontend/src/features/appearance/BookPageTurn.tsx`: old fake page-flip transition explicitly unmounted in Pass 64.3A; the reader's live DOM must not be remounted for this effect.
- `frontend/src/features/appearance/bookPageTurn.css`: stylesheet imported only by that retired component.
- `frontend/src/components/ui/StoryTimeConsentCopy.tsx`: no imports in active React source; currently unreachable and not used for narration controls.

Backups are copied into `_cleanup-backups/pass66_19/` before source removal. The folder is excluded from Git and source review snapshots. A second run is a no-op. Modified files or unexpected live references stop the prune rather than overwriting work.

## Audit results

- 52 explicit `/art/` and `/brand/` URLs resolved in the snapshot.
- Zero missing literal asset URLs or relative JavaScript/TypeScript modules in that snapshot.
- Five identical-image groups identified, **not deleted**. They have distinct public URLs, and two groups are actively referenced by experiments/production CSS; deduplication requires a proper URL migration.
- `app/web/` is **not dead**: FastAPI still mounts it under `/static` and serves it at `/`. The React site is separately deployed through Vite/CloudFront. Removing that backend mount requires a deliberate cutover.
- Admin-gated `/dev` experiments and old internal `inkbound-*`/`inkspace-*` classes remain in active routes or UI. No blanket removal.
- Dependency packages are untouched: usage cannot be proven by simple file-name searches and deployment scripts need their own dependencies.

`scripts/audit-source-hygiene.py --strict` now runs before the Python suite in `scripts/check-project.sh`, providing an early warning for missing imports and explicit art assets. **It is a static guard, not a runtime test, full dead-code analyzer, or cloud audit.**

## Verification boundary

Tests to run before staging: the complete `scripts/check-project.sh`, which includes the Python suite, Node regression checks, frontend production build and infra CDK TypeScript build. An independent review environment lacking the project's full Python and Node dependencies cannot substitute for this release gate.
