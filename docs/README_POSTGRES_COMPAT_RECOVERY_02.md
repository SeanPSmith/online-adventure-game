# PostgreSQL Compatibility Recovery 02

The AWS traceback from character creation proved the deployed `app/characters/store.py` was still the pre-Pass-02 SQLite-only file: its `_save_sync()` was executing against a local `sqlite3.Connection`, which failed on the foreign key to `main.users` because AWS authentication had already moved to PostgreSQL.

This recovery overlay restores the complete backend database compatibility set from Infrastructure Pass 02 while preserving the newer auth datetime hotfix.

## Files restored
- `app/database.py`
- `app/auth/store.py` (newer datetime-compatible version)
- `app/auth/providers/local.py`
- `app/authoring/store.py`
- `app/characters/store.py`
- `app/generation/store.py`
- `app/persistence/store.py`
- `requirements-aws.txt`
- `tests/test_database_compat.py`
- `tests/test_auth_datetime_compat.py`
- `tests/test_postgres_store_wiring.py`

## Validation
From the project root with the virtualenv active:

```bash
python -m pytest tests/test_database_compat.py tests/test_auth_datetime_compat.py tests/test_postgres_store_wiring.py -q
```

Then rebuild and redeploy the backend image:

```bash
./scripts/aws/package-backend.sh
./scripts/aws/upload-backend-source.sh
./scripts/aws/start-backend-build.sh
./scripts/aws/redeploy-backend-image.sh
```

Do not redeploy the Data or Frontend stacks for this patch.
