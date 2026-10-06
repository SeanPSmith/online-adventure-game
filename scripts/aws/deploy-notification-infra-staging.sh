#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="AdventurePlatformBackend-staging"
FRONTEND_STACK="AdventurePlatformFrontend-staging"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

command -v aws >/dev/null 2>&1 || { echo "aws CLI is required." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required." >&2; exit 1; }

if ! aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  aws sso login --profile "$PROFILE"
fi

PUBLIC_URL="$(aws cloudformation describe-stacks \
  --stack-name "$FRONTEND_STACK" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue | [0]" \
  --output text 2>/dev/null || true)"

if [[ -n "$PUBLIC_URL" && "$PUBLIC_URL" != "None" ]]; then
  export TOT_PUBLIC_BASE_URL="$PUBLIC_URL"
fi

# Optional SES sender. Set this to an identity already verified in SES, e.g.:
#   TOT_NOTIFICATION_EMAIL_FROM=notifications@example.com ./scripts/aws/deploy-notification-infra-staging.sh
export TOT_NOTIFICATION_EMAIL_FROM="${TOT_NOTIFICATION_EMAIL_FROM:-}"
export TOT_VAPID_CONTACT="${TOT_VAPID_CONTACT:-mailto:push@example.com}"

echo "Deploying notification IAM/environment to $STACK_NAME"
echo "Public URL: ${TOT_PUBLIC_BASE_URL:-<not resolved>}"
if [[ -n "$TOT_NOTIFICATION_EMAIL_FROM" ]]; then
  echo "SES sender: $TOT_NOTIFICATION_EMAIL_FROM"
else
  echo "SES sender: <disabled until a verified sender is supplied>"
fi

echo
cd "$ROOT_DIR/infra"
npm run build
npx cdk deploy "$STACK_NAME" \
  --profile "$PROFILE" \
  --require-approval never
