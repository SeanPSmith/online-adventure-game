#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK='AdventurePlatformNarrator-staging'
"$ROOT_DIR/scripts/aws/check-aws.sh"

FUNCTION_NAME="$(aws cloudformation list-stack-resources --stack-name "$STACK" \
  --profile "$PROFILE" --region "$REGION" \
  --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId | [0]" \
  --output text)"
TABLE_NAME="$(aws cloudformation describe-stacks --stack-name "$STACK" \
  --profile "$PROFILE" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='NarratorActivityTable'].OutputValue | [0]" \
  --output text)"
if [[ -z "$FUNCTION_NAME" || "$FUNCTION_NAME" == None || -z "$TABLE_NAME" || "$TABLE_NAME" == None ]]; then
  echo 'Could not identify the narrator watchdog Lambda and activity table. No changes made.' >&2
  exit 1
fi

cat <<TXT
Story Time watchdog HOTFIX only
  AWS account/profile: $PROFILE
  Region: $REGION
  Lambda: $FUNCTION_NAME
  Activity table: $TABLE_NAME

This updates the watchdog Lambda code and enables DynamoDB TTL for expiring
inference job leases. It DOES NOT deploy CloudFormation, replace or start EC2,
or modify the game server. AWS usage charges may still apply to these services.
TXT
if [[ "${1:-}" != '--deploy' ]]; then
  echo 'To approve: bash scripts/aws/deploy-story-time-watchdog-hotfix.sh --deploy'
  exit 0
fi
printf 'Type UPDATE WATCHDOG to proceed: '
IFS= read -r confirmation
if [[ "$confirmation" != 'UPDATE WATCHDOG' ]]; then
  echo 'Cancelled.'
  exit 1
fi

TMP_ZIP="$(mktemp "${TMPDIR:-/tmp}/story-time-watchdog.XXXXXX.zip")"
trap 'rm -f "$TMP_ZIP"' EXIT
python3 - "$ROOT_DIR/infra/narrator/watchdog.py" "$TMP_ZIP" <<'PY'
import sys
import zipfile
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[1], 'watchdog.py')
PY
aws lambda update-function-code --function-name "$FUNCTION_NAME" --zip-file "fileb://$TMP_ZIP" \
  --profile "$PROFILE" --region "$REGION" \
  --query '[FunctionName, LastUpdateStatus]' --output text
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION"

TTL_STATUS="$(aws dynamodb describe-time-to-live --table-name "$TABLE_NAME" \
  --profile "$PROFILE" --region "$REGION" --query 'TimeToLiveDescription.TimeToLiveStatus' --output text)"
if [[ "$TTL_STATUS" == 'DISABLED' || "$TTL_STATUS" == None ]]; then
  aws dynamodb update-time-to-live --table-name "$TABLE_NAME" \
    --profile "$PROFILE" --region "$REGION" \
    --time-to-live-specification 'Enabled=true,AttributeName=expires_at_epoch' >/dev/null
  echo 'Enabled expiry cleanup for abandoned job leases (DynamoDB TTL).'
else
  echo "DynamoDB TTL already in state: $TTL_STATUS"
fi
printf '\nWatchdog updated. Keep EC2 stopped until the application release is verified.\n'
