# Pass 46 — Apply after Pass 45 + copy-test correction

Overlay these full replacement files onto matching paths in your project root. Keep files not included here. This bundle excludes databases, secrets, dependency folders, and builds.

Adds the Playtest Operations dashboard, per-adventure/room spend, generation failure details, observed retry/QTE metrics, persistent AI pause/resume, non-admin account disable/enable, typed room termination, and an operator audit trail. Cancelled/stale generation reservations retain conservative estimated charges. Full details and operating limits are appended in docs/PROJECT_MASTER.md.

Validation: 319 Python tests and every check in scripts/check-project.sh passed. Desktop and phone Chromium interactions passed with mocked service responses; backend regressions used real temporary SQLite databases. No cloud deployment performed.

Release:
./scripts/release-staging.sh "Pass 46: playtest operations dashboard, AI pause, account controls, and audited room termination"

Deployment smoke checks:
1. Open Admin and check metrics, filters, failure rows, room inspection, and the operator audit.
2. Pause AI, verify a tester's new generation is refused without losing its saved adventure, then resume.
3. Disable a disposable tester; confirm old sessions/socket play fail. Re-enable and log in again.
4. End a disposable unfinished room using its typed code. Verify removal plus the participants' operator-ended archive.
5. Verify completed Chronicles, normal gameplay, allowance controls, and Author/Arcade publishing remain usable.

Files:
- app/admin/analytics.py
- app/admin/operations.py
- app/auth/routes.py
- app/auth/store.py
- app/main.py
- app/persistence/store.py
- app/usage/meter.py
- app/usage/store.py
- docs/PROJECT_MASTER.md
- frontend/src/pages/admin/AdminPage.css
- frontend/src/pages/admin/AdminPage.tsx
- frontend/src/pages/admin/OperationsDashboard.tsx
- frontend/src/pages/game/MyAdventuresPage.tsx
- frontend/src/services/admin.ts
- tests/test_gameplay_ui_contract.py
- tests/test_pass43_usage_entitlements.py
- tests/test_pass46_operations.py
