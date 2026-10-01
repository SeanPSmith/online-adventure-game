# Adventure Platform — Admin + Content Portability Pass 01

This patch adds a narrow superuser control room, restores access to the full legacy Author console through CloudFront, and adds a safe Author-content export/import path for the old SQLite database.

## What changes

### Superuser bootstrap
- `SeanSteezy` is configured as the staging bootstrap administrator.
- On backend startup that account receives durable `admin`, `author`, and `publish` permissions.
- Registration also applies configured bootstrap permissions immediately if the matching account is created later.
- Admin privilege is **not delegable from the browser**.

### Admin control room
New React route:

`/admin`

An administrator can:
- search cloud users by username/email,
- grant Author + Publish access,
- revoke Author + Publish access (including legacy owners, via an explicit denial marker),
- inspect current permission chips,
- upload/import a portable legacy Author-content bundle.

The portal cannot grant another user `admin`.

### Full Author console in AWS
The existing Python Author editor is exposed through:

`/author-console`

CloudFront now forwards:
- `/author-console*` to the backend,
- `/static/author/*` to the backend,
- existing `/api/author/*` behavior continues through `/api/*`.

The Account header shows AUTHOR only to Author users and ADMIN only to administrators.

### CloudFront-safe Author writes
The Author write guard now recognizes same-origin browser requests behind CloudFront via `Sec-Fetch-Site`, while retaining the custom `X-TOT-Author-Request` header requirement.

### Legacy content portability
Exporter:

```bash
python scripts/content/export_legacy_author_content.py
```

Default output:

`backups/author_content_YYYYMMDD_HHMMSS.json`

The bundle includes:
- Author worlds,
- adventure briefs,
- every Author version,
- draft/published/retired state,
- parent-world relationships,
- lore/source JSON,
- generated adventures/public stories,
- legacy author username/email metadata.

It intentionally excludes:
- passwords/password hashes,
- sessions,
- Heroes,
- active room state,
- chat,
- completed player history.

The cloud importer resolves ownership by **username** against current PostgreSQL accounts. The Admin UI exposes a **Legacy Ownership Map** before import, so an old local username can be mapped to a new cloud username without rewriting the bundle. If any resolved destination author is missing, the entire import is refused and nothing is written.

This means `Princess_Athena` should create her cloud account before importing content she owns. This is intentional: staging registration is currently public, so pre-authorizing an unclaimed username would allow someone else to register it first and inherit access. If your own old local username differs from `SeanSteezy`, map that legacy name to `SeanSteezy` in the import screen.

## Validation performed

Focused backend regression suite:

```text
13 passed
```

Coverage included:
- portable SQLite/Postgres auth datetime tests,
- DB compatibility tests,
- admin user search/grant/revoke,
- content export,
- content import,
- ownership remapping by username,
- atomic refusal when a legacy author account is missing.

## Apply

Overlay the patch contents onto the project root and append `PROJECT_CHANGELOG_APPEND.md` to `docs/PROJECT_CHANGELOG.md`.

### 1. Preserve/export the legacy content first

From project root:

```bash
python scripts/content/export_legacy_author_content.py
```

Keep the generated JSON bundle somewhere safe.

### 2. Run focused tests

```bash
python -m pytest \
  tests/test_admin_permissions.py \
  tests/test_content_portability.py \
  tests/test_auth_datetime_compat.py \
  tests/test_database_compat.py \
  -q
```

Expected: `13 passed`.

### 3. Build/push the backend image

```bash
./scripts/aws/package-backend.sh
./scripts/aws/upload-backend-source.sh
./scripts/aws/start-backend-build.sh
```

Wait for `SUCCEEDED`.

### 4. Deploy the Backend + Frontend infrastructure update

This updates the ECS environment with `SeanSteezy` as bootstrap admin and adds the Author-console CloudFront behaviors.

```bash
./scripts/aws/deploy-frontend-stack.sh
```

### 5. Upload the React bundle

```bash
./scripts/aws/deploy-frontend-assets.sh
```

### 6. Verify

Log in as `SeanSteezy`, refresh once, then verify:

- `/admin` opens the superuser control room,
- `/author-console` opens the full existing Author editor,
- the account nav shows both AUTHOR and ADMIN.

If `Princess_Athena` has already registered in staging, search for her in `/admin` and click `GRANT AUTHOR`. If she has not registered yet, wait until her account exists.

### 7. Import legacy content

Open `/admin`, select the exported JSON bundle under **LEGACY AUTHOR CONTENT**. Review the automatically populated ownership mappings, change any legacy username that should point at a different current account, then import.

If the importer reports `Princess_Athena` as a missing cloud account, no content was partially imported. Have her register, approve her Author access, and rerun the same bundle.

If generated/public stories were inserted, restart the backend once afterward so the runtime registry reloads the newly restored approved stories:

```bash
./scripts/aws/redeploy-backend-image.sh
```
