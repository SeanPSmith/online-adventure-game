# Apply Pass 45 after Pass 44

Copy these full replacement files into the matching paths of your existing project root. Keep all existing files not included here. This source overlay includes no database, secrets, dependencies, or generated builds.

Adds a three-step first-run guide, account-scoped skip preference, balanced Hero creation, explicit Solo/co-op lobby selection, and First Light: a curated three-turn starter that completes and saves a Chronicle without AI calls.

The canonical project document remains in docs/PROJECT_MASTER.md. Its prior content is preserved and Pass 45 is appended at the end.

Validation: 306 Python tests, legacy JavaScript syntax, React production build, and AWS CDK TypeScript build passed. Browser visual/mobile QA remains unverified. No cloud deployment performed.

Release:
./scripts/release-staging.sh "Pass 45: first-run player guide, balanced Hero setup, and First Light starter adventure"

After deployment: test new account -> balanced Hero -> Home -> Solo starter -> three turns -> Chronicle. Repeat with two accounts in co-op and check invites/readiness. Verify Skip Guide persists and How to Start reopens it. Check phone layouts.

Files:
- app/adventures/bootstrap.py
- app/adventures/content/first_light.py
- app/auth/store.py
- app/game/session.py
- app/main.py
- app/persistence/store.py
- docs/PROJECT_MASTER.md
- frontend/src/features/onboarding/FirstRunGuide.tsx
- frontend/src/pages/game/AdventurePage.tsx
- frontend/src/pages/game/GameHomePage.tsx
- frontend/src/pages/heroes/HeroCreatePage.tsx
- frontend/src/services/game.ts
- frontend/src/state/GameSocketContext.tsx
- frontend/src/styles/components.css
- tests/test_pass45_onboarding.py
