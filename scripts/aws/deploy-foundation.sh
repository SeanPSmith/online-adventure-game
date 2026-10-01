#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"

"$ROOT/scripts/aws/check-aws.sh"

cd "$ROOT/infra"

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run build

npx cdk deploy \
  AdventurePlatformNetwork-staging \
  AdventurePlatformBuild-staging \
  --profile "$PROFILE" \
  --require-approval never

printf '\nFoundation deployment complete in %s.\n' "$REGION"
