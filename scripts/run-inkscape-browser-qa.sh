#!/usr/bin/env bash
# Run from root/. Browser QA is isolated in sibling assets/AWS/.qa-venv.
# macOS Big Sur/Monterey/Ventura: use the installed Node and compatible Playwright.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR="${QUILLAIRO_QA_VENV:-${ROOT_DIR}/../assets/AWS/.qa-venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
cd "$ROOT_DIR"
"$PYTHON_BIN" scripts/inkscape-browser-qa.py --self-check

PW_SPEC='playwright>=1.55,<2'
PW_PIN=''
if [[ "$(uname -s)" == "Darwin" ]]; then
  MACOS_VERSION="$(sw_vers -productVersion 2>/dev/null || true)"
  MACOS_MAJOR="${MACOS_VERSION%%.*}"
  if [[ "$MACOS_MAJOR" =~ ^[0-9]+$ ]] && (( MACOS_MAJOR < 14 )); then
    # The October 2026 Playwright driver bundles a Node binary linked against
    # macOS 13.5. 1.55.0 supports Node >=18 and runs with system Google Chrome.
    PW_PIN='1.55.0'
    PW_SPEC="playwright==${PW_PIN}"
    if [[ -z "${PLAYWRIGHT_NODEJS_PATH:-}" ]]; then
      if ! command -v node >/dev/null 2>&1; then
        echo 'QA BLOCKED: Node.js 18+ is required on older macOS; none was found on PATH.' >&2
        exit 2
      fi
      export PLAYWRIGHT_NODEJS_PATH="$(command -v node)"
    fi
    if [[ ! -x "$PLAYWRIGHT_NODEJS_PATH" ]]; then
      echo "QA BLOCKED: PLAYWRIGHT_NODEJS_PATH does not point to an executable: $PLAYWRIGHT_NODEJS_PATH" >&2
      exit 2
    fi
    NODE_MAJOR="$("$PLAYWRIGHT_NODEJS_PATH" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
    if [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 18 )); then
      echo 'QA BLOCKED: Playwright 1.55.0 needs working Node.js 18+ on this Mac.' >&2
      exit 2
    fi
    echo "Big Sur-compatible browser QA: Playwright ${PW_PIN}, Node $("$PLAYWRIGHT_NODEJS_PATH" -v), Google Chrome."
  fi
fi

if [[ ! -x "$ENV_DIR/bin/python" ]]; then
  echo 'Creating isolated browser QA environment outside Git...'
  "$PYTHON_BIN" -m venv "$ENV_DIR"
fi

# Upgrade/downgrade only this disposable QA venv; never modify Quillairo's app venv.
CURRENT_VERSION="$($ENV_DIR/bin/python -c 'from importlib.metadata import version; print(version("playwright"))' 2>/dev/null || true)"
if [[ -n "$PW_PIN" ]]; then
  NEED_INSTALL=0
  [[ "$CURRENT_VERSION" == "$PW_PIN" ]] || NEED_INSTALL=1
else
  NEED_INSTALL=0
  [[ -n "$CURRENT_VERSION" ]] || NEED_INSTALL=1
fi
if (( NEED_INSTALL )); then
  echo "Installing compatible browser QA dependency into isolated venv (${PW_SPEC})..."
  "$ENV_DIR/bin/python" -m pip install --disable-pip-version-check --quiet "$PW_SPEC"
fi

# Playwright's Python driver reads PLAYWRIGHT_NODEJS_PATH from this environment.
exec "$ENV_DIR/bin/python" scripts/inkscape-browser-qa.py "$@"
