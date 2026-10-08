# Pass 48 — Mobile and keyboard usability

Apply these full replacement files after Pass 47, preserving paths:

- frontend/src/state/ModalContext.tsx
- frontend/src/layouts/PublicLayout.tsx
- frontend/src/layouts/GameLayout.tsx
- frontend/src/layouts/AccountLayout.tsx
- frontend/src/main.tsx
- frontend/src/styles/accessibility.css
- docs/PROJECT_MASTER.md
- docs/PASS48_APPLY.md

Run from the project root:

```bash
./scripts/release-staging.sh "Pass 48: mobile controls, keyboard navigation, and accessible shared dialogs"
```

Validation passed: 324 Python tests, 8 reconnect tests, frontend/CDK builds, and mocked-API Chromium keyboard/overflow checks at 320, 390, 768 and 1440px. No database migration is needed. Physical-device and screen-reader verification remains a staging task.
