# Pass 47 — Reconnect recovery

Apply this full-file overlay after Pass 46 and its Hero-history hotfix, preserving paths.

Files:

- frontend/src/state/useLiveAdventure.ts
- frontend/src/state/GameSocketContext.tsx
- frontend/src/pages/game/AdventurePage.tsx
- scripts/check-project.sh
- scripts/tests/adventure-recovery.cjs
- docs/PROJECT_MASTER.md
- docs/PASS47_APPLY.md

Run from the project root:

```bash
./scripts/release-staging.sh "Pass 47: adventure reconnect recovery and offline action guards"
```

Verification: 324 Python tests, 8 reconnect tests, legacy JS syntax, frontend build and CDK TypeScript build passed. Live staging disconnect testing remains to be performed. No database migration is required.
