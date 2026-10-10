#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"

"$ROOT_DIR/scripts/aws/check-aws.sh"

# Once the optional narrator stack exists, preserve its backend wiring on
# ALL future infrastructure redeploys; never silently blank KOKORO_BASE_URL.
if aws cloudformation describe-stacks \
  --stack-name AdventurePlatformNarrator-staging \
  --profile "$PROFILE" --region "${AWS_REGION:-us-east-1}" \
  --query 'Stacks[0].StackStatus' --output text >/dev/null 2>&1; then
  export TOT_ENABLE_NARRATOR_STACK=1
fi

cd "$ROOT_DIR/infra"
npm run build
npx cdk deploy AdventurePlatformBackend-staging --profile "$PROFILE"
