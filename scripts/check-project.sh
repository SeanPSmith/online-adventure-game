#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

say() {
  printf '\n==> %s\n' "$1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 1
  }
}

require_command "$PYTHON_BIN"
require_command node
require_command npm

cd "$ROOT_DIR"

say "Python regression suite"
"$PYTHON_BIN" -m pytest tests -q

say "Legacy browser JavaScript syntax"
node --check app/web/author/author.js
node --check app/web/adventure_ui.js

say "Adventure reconnect regressions"
node --test scripts/tests/adventure-recovery.cjs

say "Lazy route and page-load recovery regressions"
node --test scripts/tests/route-loading.cjs

say "Adventure turn presentation regressions"
node --test scripts/tests/turn-flow.cjs

say "React production build"
(
  cd frontend
  npm run build
)

say "AWS CDK TypeScript build"
(
  cd infra
  npm run build
)

printf '\nPROJECT CHECKS PASSED\n'
