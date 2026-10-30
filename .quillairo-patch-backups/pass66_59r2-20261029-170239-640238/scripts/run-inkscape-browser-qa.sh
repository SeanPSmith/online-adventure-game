#!/usr/bin/env bash
# Run from root/; Playwright only installed into sibling assets/AWS/.qa-venv.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="${QUILLAIRO_QA_VENV:-${ROOT_DIR}/../assets/AWS/.qa-venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
cd "$ROOT_DIR"
"$PYTHON_BIN" scripts/inkscape-browser-qa.py --self-check
if [[ ! -x "$ENV_DIR/bin/python" ]]; then
  echo 'Installing isolated browser QA environment outside the Git repo...'
  "$PYTHON_BIN" -m venv "$ENV_DIR"
fi
if ! "$ENV_DIR/bin/python" -c 'import playwright.sync_api' >/dev/null 2>&1; then
  "$ENV_DIR/bin/python" -m pip install --disable-pip-version-check --quiet 'playwright>=1.55,<2'
fi
exec "$ENV_DIR/bin/python" scripts/inkscape-browser-qa.py "$@"
