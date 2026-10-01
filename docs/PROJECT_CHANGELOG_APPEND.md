## 2026-09-29 — AWS Infrastructure Pass 02: PostgreSQL + Fargate Runtime

### Portable persistence
- Added `app/database.py`, a SQLite/PostgreSQL compatibility boundary.
- Local development continues to use the existing SQLite database by default.
- Cloud runtime switches to PostgreSQL when `DB_BACKEND=postgres` / `DB_HOST` is supplied.
- Preserved existing store APIs rather than duplicating auth, Hero, authoring, generation, chat, or adventure-history logic.
- Added compatibility handling for SQLite qmark parameters, `NOCASE`, `GROUP_CONCAT`, `INSERT OR IGNORE`, schema introspection PRAGMAs, and SQLite table-existence checks.
- Made auth aggregate queries SQL-standard with explicit `GROUP BY` clauses.
- Made adventure-history play-day extraction portable across SQLite and PostgreSQL.
- Added focused database compatibility tests.

### Staging data plane
- Enabled the staging Data and Backend CDK stacks; React/CloudFront remains disabled for this pass.
- Added private RDS PostgreSQL in isolated subnets with generated Secrets Manager credentials, encrypted storage, one-day staging backups, and snapshot-on-removal behavior.
- Added a staging OpenAI API-key secret managed by Secrets Manager.
- Added `psycopg[binary]` to cloud-only requirements.

### Backend runtime
- Added a single-task ECS/Fargate deployment using the existing `staging-current` ECR image tag.
- Injects PostgreSQL username/password and OpenAI API key through ECS secrets.
- Keeps the backend task in public app subnets for outbound OpenAI access while allowing inbound port 8000 only from the ALB security group.
- Added a public staging Application Load Balancer with `/health` target checks and a five-minute idle timeout for Socket.IO/WebSocket traffic.
- Keeps `desiredCount=1` while live room/session coordination remains process-local.
- Direct ALB preflight temporarily uses a non-Secure auth cookie; the CloudFront/HTTPS pass will switch it back to Secure.

### Operations
- Added runtime diff, RDS deployment, secret update, backend deployment, health-check, and backend-diagnostics scripts.
- The OpenAI secret-update script reads the key interactively without placing it on the command line.
- The staging PostgreSQL database starts empty; existing local SQLite data is not migrated by this pass.
