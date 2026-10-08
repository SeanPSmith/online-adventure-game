# Pass 46 Hero history hotfix

Apply these full replacement files over Pass 46, preserving their paths:

- app/persistence/store.py
- tests/test_hero_history_postgres_fix.py
- docs/PROJECT_MASTER.md
- docs/PASS46_HERO_HISTORY_FIX.md

Run from the project root:

```bash
./scripts/release-staging.sh "Fix PostgreSQL Hero story history and My Adventures 500 errors"
```

No database reset or migration is needed. After deployment, open a Hero sheet and My Adventures and confirm their story/history requests succeed. This fixes the specific PostgreSQL exception supplied in the staging logs. Local validation: 324 Python tests passed; PostgreSQL adapter regression coverage uses a recording connection, not a live PostgreSQL server.
