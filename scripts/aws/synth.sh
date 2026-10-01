#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PROFILE="${AWS_PROFILE:-adventure-staging}"

cd "$ROOT/infra"

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run build
npx cdk synth --profile "$PROFILE"
