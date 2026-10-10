#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Installing the free Story Time browser runtime and updating frontend/package-lock.json..."
(cd "$ROOT_DIR/frontend" && npm install --save-exact kokoro-js@1.2.1)
echo "Story Time dependency installed. Run your standard staging release command."
