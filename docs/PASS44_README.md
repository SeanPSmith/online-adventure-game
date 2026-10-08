# Pass 44 — My Adventures / Resume / Player Library

Apply these full replacement files over the corresponding paths in your Pass 43 project root. This is a source overlay; it excludes databases, credentials, dependencies, and generated builds. Keep your existing files that are not present in this ZIP.

Changes:
- New /game/adventures player library with Active, Completed, and Abandoned shelves, search, saved dates, party/Hero names, World when available, and previous-story receipts.
- Continue and Recover links retain existing authorized room/Hero resume behavior.
- Completed Chronicles include readable archived turn receipts and sharing. Play Another Adventure returns to the existing catalog for a fresh run.
- Host abandonment saves private party-member archive records before room deletion. Historical abandoned runs cannot be recovered; they were previously deleted.
- Authenticated read-only account library API, account-level Chronicle deduplication, and account-deletion cleanup of archived party records.
- Automatic compatible schema migration adds the abandonment table and completed-history World/mode fields; older missing metadata stays blank.
- Explicit @types/node dev dependency fixes clean React builds.
- Updated canonical docs/PROJECT_MASTER.md.

Validation:
- 286 Python tests passed, including five new library/authorization/persistence regressions.
- Legacy browser JavaScript syntax passed.
- React TypeScript and production build passed.
- AWS CDK TypeScript build passed.
- Browser visual/mobile QA was NOT completed: browser download failed in this environment.
- No cloud deployment or paid AI calls performed.

Release:
./scripts/release-staging.sh "Pass 44: My Adventures library, resume links, Chronicles, and abandonment archives"

Deployment smoke checks:
1. Open My Adventures with an existing account; verify active party names, saved date, and Continue opens the correct room/Hero.
2. Finish an adventure; check Completed appears once and Chronicle receipts expand.
3. Abandon an unfinished co-op room as host; verify both members have an Abandoned entry and the room cannot resume.
4. Check a second unrelated account sees none of those private records.
5. Check desktop and phone layouts, search, shelf switching, and library retry on a failed request.

Files:
- app/auth/store.py
- app/main.py
- app/persistence/store.py
- docs/PROJECT_MASTER.md
- frontend/package-lock.json
- frontend/package.json
- frontend/src/layouts/GameLayout.tsx
- frontend/src/pages/game/GameHomePage.tsx
- frontend/src/pages/game/MyAdventuresPage.tsx
- frontend/src/router.tsx
- tests/test_pass44_player_library.py
