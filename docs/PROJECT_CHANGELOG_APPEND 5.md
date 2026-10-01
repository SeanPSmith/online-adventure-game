## 2026-09-30 — PostgreSQL compatibility recovery

### Practical changes
- Restored the shared `app.database` SQLite/PostgreSQL compatibility boundary across all persistent backend stores.
- Restored PostgreSQL-aware character, authoring, generation, persistence, auth-provider, and auth-store implementations from Infrastructure Pass 02.
- Preserved the later PostgreSQL auth datetime compatibility fix rather than reverting `app/auth/store.py` to the older Pass 02 version.
- Added regression coverage that verifies all persistent stores are wired through the shared database boundary and that the character store no longer opens SQLite directly.

### Result
- AWS character creation no longer writes to the container-local SQLite database while auth uses PostgreSQL.
- All durable game stores now select SQLite locally and PostgreSQL in AWS from the same `DB_BACKEND` configuration.
