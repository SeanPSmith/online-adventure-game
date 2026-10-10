#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"

"$ROOT_DIR/scripts/aws/check-aws.sh"
if [[ "${1:-}" != "--deploy" ]]; then
  cat <<'INSTRUCTIONS'
Pass 58B narrator infrastructure — NO deployment started.

This creates a BILLABLE, currently-running t3a.medium (2 vCPU, 4 GiB), 30 GiB
EBS disk, private-only inbound speech port, SSM access, a S3 cache, an activity
DynamoDB table, and a 5-minute idle/quota watchdog Lambda.

The instance starts running when CloudFormation creates it. After first boot,
VERIFY the Docker service and STOP the instance before leaving it unattended.

To deliberately provision:
  bash scripts/aws/deploy-story-time-staging.sh --deploy

Read docs/STORY_TIME_EC2_RUNBOOK.md first, including the costs and stop command.
INSTRUCTIONS
  exit 0
fi

printf '\nThis will CREATE billable AWS resources in %s.\n' "$REGION"
printf 'Type CREATE STORY TIME to confirm: '
IFS= read -r confirm
if [[ "$confirm" != "CREATE STORY TIME" ]]; then
  echo 'Cancelled. No infrastructure change.'
  exit 1
fi

export TOT_ENABLE_NARRATOR_STACK=1
cd "$ROOT_DIR/infra"
npm run build
npx cdk diff AdventurePlatformNarrator-staging --profile "$PROFILE"
printf '\nReview the diff. Deploy the narrator stack now? Type DEPLOY: '
IFS= read -r confirm
if [[ "$confirm" != "DEPLOY" ]]; then
  echo 'Cancelled before deployment.'
  exit 1
fi
npx cdk deploy AdventurePlatformNarrator-staging --profile "$PROFILE" --require-approval broadening

cat <<'NEXT'

NARRATOR INFRASTRUCTURE CREATED — ITS EC2 INSTANCE IS NOW BILLING.
1. Check Docker startup with AWS Systems Manager Session Manager.
2. Deploy the backend stack configuration (with the same opt-in flag):
   cd infra && TOT_ENABLE_NARRATOR_STACK=1 npx cdk deploy AdventurePlatformBackend-staging --profile adventure-staging
3. Stop the instance as soon as the health test passes, using the EC2 console
   or scripts/aws/story-time-control.sh stop.
4. The next uncached narration request will wake it automatically.

See docs/STORY_TIME_EC2_RUNBOOK.md. The normal code release does NOT deploy infra.
NEXT
