# Tales of Two — Automated Regression Suite

The Python suite is organized by **feature**, not release/pass number. Every
pre-Pass-50 test is retained, including existing parametrized cases. Source
contracts are not the same as browser behavior tests; they provide cheap
regression protection but cannot replace an end-to-end playthrough.

| Suite | Covers |
| --- | --- |
| `admin/` | Admin RBAC, analytics, controls, operations, entitlements |
| `auth/` | Credentials, login permissions, time serialization |
| `heroes/` | Hero systems, progression, profile UI, history |
| `adventures/` | Room runtime, story outcomes, recovery, QTE, budgets |
| `arcade/` | Catalog, pace, interactions, physics, visual feedback |
| `director/` | Generation, Director, schema, recap, scene presentation |
| `authoring/` | Lore, World/Brief scoping, AI-assist, portability |
| `multiplayer/` | Party gate, rooms, invites, social, notifications |
| `frontend/` | Public/auth shell, onboarding, responsiveness, library |
| `persistence/` | SQLite/Postgres compatibility and store wiring |

## Running checks

From the **project root** in the same environment used for staging:

```bash
python3 -m pytest tests -q               # full Python regression suite
python3 -m pytest tests/arcade -q        # one feature
python3 -m pytest tests/frontend -q      # frontend source contracts
./scripts/check-project.sh             # all release gates (Python, JS, builds)
```

Use `tests.support.PROJECT_ROOT` for repository-relative source-contract checks;
never assume test files live directly under `tests/`. All new tests should
live in a feature folder with a descriptive `test_<behavior>.py` name. Avoid
putting pass numbers in filenames.

**Baseline:** 53 modules, 305 `test_` definitions (plus pytest parametrizations),
with no duplicate identical test function ASTs detected. No test cases were
intentionally removed in Pass 50.

**Coverage limitation:** Several frontend checks inspect implementation text.
Whenever practical, prefer assertions over observable behavior, API responses,
rendered UI, and stable interfaces; gradually replace fragile literal-string
checks as the relevant features receive active development.

## One-time Pass 50 migration

For this specific move-only overlay, unpack the ZIP into the project root and
run `./scripts/apply-pass50-test-layout.sh` **before** the release command.
This verifies all new modules are present before removing the old root-level
copy of each test. It does not delete any other existing test file.
