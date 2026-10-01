# PostgreSQL Auth Timestamp Compatibility Hotfix 01

CloudWatch exposed a portability bug in the auth store:

`TypeError: fromisoformat: argument must be str`

SQLite returns the persisted timestamps as strings, while PostgreSQL/psycopg can return native Python `datetime` values. The auth row converter assumed only the SQLite representation.

This patch accepts both representations and keeps the existing auth/session model unchanged.

## Files

- `app/auth/store.py` — complete replacement file
- `tests/test_auth_datetime_compat.py` — focused regression tests
- `scripts/aws/redeploy-backend-image.sh` — forces Fargate to pull the newly built `staging-current` image
- `PROJECT_CHANGELOG_APPEND.md`

## Deploy

From the project root, after overlaying this patch and appending the changelog:

```bash
source .venv/bin/activate
python -m pytest tests/test_auth_datetime_compat.py -q

./scripts/aws/package-backend.sh
./scripts/aws/upload-backend-source.sh
./scripts/aws/start-backend-build.sh
./scripts/aws/redeploy-backend-image.sh
```

Then retry registration through the CloudFront URL.
