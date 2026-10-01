#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"

"$ROOT_DIR/scripts/aws/check-aws.sh"

cd "$ROOT_DIR/infra"
npm run build
npx cdk diff \
  AdventurePlatformData-staging \
  AdventurePlatformBackend-staging \
  --profile "$PROFILE"
