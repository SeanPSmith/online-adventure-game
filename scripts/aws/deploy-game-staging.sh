#!/usr/bin/env bash
set -euo pipefail

# Tales of Two / Adventure Platform staging deploy helper.
# Normal code deploy:
#   ./scripts/aws/deploy-game-staging.sh
#
# Optional:
#   ./scripts/aws/deploy-game-staging.sh --backend-only
#   ./scripts/aws/deploy-game-staging.sh --frontend-only
#   ./scripts/aws/deploy-game-staging.sh --no-smoke
#
# This intentionally does NOT deploy CDK/CloudFormation infrastructure.
# Use the dedicated infrastructure scripts when infra definitions change.

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
EXPECTED_ACCOUNT="${EXPECTED_AWS_ACCOUNT:-120737642380}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AWS_SCRIPTS="$ROOT_DIR/scripts/aws"

DO_BACKEND=1
DO_FRONTEND=1
DO_SMOKE=1

usage() {
  cat <<'USAGE'
Usage: deploy-game-staging.sh [options]

Options:
  --backend-only   Build/push/redeploy only the Python backend.
  --frontend-only  Build/upload only the React frontend.
  --no-smoke       Skip the final public smoke test.
  -h, --help       Show this help.

Environment overrides:
  AWS_PROFILE             Default: adventure-staging
  AWS_REGION              Default: us-east-1
  EXPECTED_AWS_ACCOUNT    Default: 120737642380
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only)
      DO_BACKEND=1
      DO_FRONTEND=0
      ;;
    --frontend-only)
      DO_BACKEND=0
      DO_FRONTEND=1
      ;;
    --no-smoke)
      DO_SMOKE=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

say() {
  printf '\n\033[1;36m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_file() {
  [[ -f "$1" ]] || fail "Required file not found: $1"
}

run_script() {
  local path="$1"
  shift || true
  require_file "$path"
  bash "$path" "$@"
}

START_SECONDS=$SECONDS

say "Preflight"
require_command aws
require_command curl
require_command npm
require_command zip

cd "$ROOT_DIR"
echo "Project: $ROOT_DIR"
echo "Profile: $PROFILE"
echo "Region:  $REGION"

# Warn, but do not block, when deploying uncommitted work.
if command -v git >/dev/null 2>&1 && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
    echo
    echo "WARNING: Git has uncommitted changes."
    echo "         Consider committing before/after this deploy so this build is recoverable."
  fi
fi

# Refresh SSO automatically if the cached session is gone.
if ! aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  say "AWS SSO session expired/missing — opening login"
  aws sso login --profile "$PROFILE"
fi

ACCOUNT="$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Account --output text)"
CALLER="$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Arn --output text)"

echo "Account: $ACCOUNT"
echo "Caller:  $CALLER"

if [[ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  fail "Refusing to deploy: expected AWS account $EXPECTED_ACCOUNT, got $ACCOUNT"
fi

if [[ "$DO_BACKEND" -eq 1 ]]; then
  say "1/5 Package backend"
  run_script "$AWS_SCRIPTS/package-backend.sh"

  say "2/5 Upload backend source"
  run_script "$AWS_SCRIPTS/upload-backend-source.sh"

  say "3/5 Remote CodeBuild → ECR"
  run_script "$AWS_SCRIPTS/start-backend-build.sh"

  say "4/5 Roll Fargate onto new backend image"
  run_script "$AWS_SCRIPTS/redeploy-backend-image.sh"
else
  say "Backend skipped"
fi

if [[ "$DO_FRONTEND" -eq 1 ]]; then
  say "5/5 Build + upload React + invalidate CloudFront"
  run_script "$AWS_SCRIPTS/deploy-frontend-assets.sh"
else
  say "Frontend skipped"
fi

if [[ "$DO_SMOKE" -eq 1 ]]; then
  if [[ "$DO_FRONTEND" -eq 1 ]]; then
    say "Public edge smoke test"
    run_script "$AWS_SCRIPTS/frontend-smoke.sh"
  elif [[ "$DO_BACKEND" -eq 1 ]]; then
    say "Backend health test"
    run_script "$AWS_SCRIPTS/backend-health.sh"
  fi
else
  say "Smoke test skipped"
fi

ELAPSED=$((SECONDS - START_SECONDS))
printf '\n\033[1;32mDEPLOY COMPLETE\033[0m (%dm %02ds)\n' "$((ELAPSED / 60))" "$((ELAPSED % 60))"

# Print the public URL when the frontend stack exists.
if [[ "$DO_FRONTEND" -eq 1 ]]; then
  PUBLIC_URL="$(aws cloudformation describe-stacks \
    --stack-name AdventurePlatformFrontend-staging \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue | [0]" \
    --output text 2>/dev/null || true)"

  if [[ -n "$PUBLIC_URL" && "$PUBLIC_URL" != "None" ]]; then
    echo "Public URL: $PUBLIC_URL"
  fi
fi
