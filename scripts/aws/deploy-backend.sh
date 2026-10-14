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

# Do not silently route staging back to the CPU when a dedicated GPU exists.
# Use story-time-gpu-service.sh cutover/rollback for deliberate narrator switches.
if aws cloudformation describe-stacks \
  --stack-name AdventurePlatformNarratorGpu-staging \
  --profile "$PROFILE" --region "${AWS_REGION:-us-east-1}" \
  --query 'Stacks[0].StackStatus' --output text >/dev/null 2>&1; then
  if [[ "${TOT_STORY_TIME_GPU_CUTOVER:-}" != "0" && "${TOT_STORY_TIME_GPU_CUTOVER:-}" != "1" ]]; then
    echo 'A dedicated GPU narrator stack exists. Refusing ambiguous Backend CDK deployment.' >&2
    echo 'Set TOT_STORY_TIME_GPU_CUTOVER=0 or 1 explicitly, or use story-time-gpu-service.sh cutover/rollback.' >&2
    exit 2
  fi
  export TOT_ENABLE_GPU_NARRATOR_STACK=1
fi

cd "$ROOT_DIR/infra"
npm run build
npx cdk deploy AdventurePlatformBackend-staging --profile "$PROFILE"
