## 2026-09-30 — PostgreSQL Auth Timestamp Compatibility Hotfix

### Practical changes
- Hardened auth row conversion so timestamp fields can be read from either SQLite ISO-8601 text or PostgreSQL/psycopg `datetime` values.
- Applied the same compatibility handling to user creation timestamps and all persisted auth-session timestamps.
- Added focused regression coverage for both text-backed and PostgreSQL-native datetime values.
- Added `scripts/aws/redeploy-backend-image.sh` to force ECS to pull a freshly rebuilt `staging-current` image without requiring an infrastructure change.

### Result
- AWS registration/login no longer crashes when PostgreSQL returns a native datetime for `users.created_at` or auth-session timestamps.
- Local SQLite behavior remains unchanged.
- No schema migration or RDS replacement is required.
