#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformNarrator-staging"
"$ROOT_DIR/scripts/aws/check-aws.sh"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --profile "$PROFILE" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text
}
INSTANCE_ID="$(output NarratorInstanceId)"
TABLE_NAME="$(output NarratorActivityTable)"
if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo 'Narrator instance is not deployed.' >&2
  exit 1
fi

maintenance_hold() {
  local minutes="${1:-90}"
  if ! [[ "$minutes" =~ ^[0-9]+$ ]] || (( minutes < 5 || minutes > 120 )); then
    echo 'Maintenance hold must be 5–120 minutes.' >&2
    exit 2
  fi
  local now until_epoch
  now="$(date +%s)"
  until_epoch=$((now + minutes * 60))
  aws dynamodb update-item --table-name "$TABLE_NAME" \
    --profile "$PROFILE" --region "$REGION" \
    --key '{"id":{"S":"narrator"}}' \
    --update-expression 'SET manual_lease_until_epoch = :expiry, last_request_epoch = :now' \
    --expression-attribute-values "{\":expiry\":{\"N\":\"$until_epoch\"},\":now\":{\"N\":\"$now\"}}" \
    --output json >/dev/null
  echo "Story Time maintenance hold active for ${minutes} minutes. This avoids idle shutdown; monthly quota still applies."
}

clear_hold() {
  aws dynamodb update-item --table-name "$TABLE_NAME" \
    --profile "$PROFILE" --region "$REGION" \
    --key '{"id":{"S":"narrator"}}' \
    --update-expression 'REMOVE manual_lease_until_epoch' \
    --output json >/dev/null
  echo 'Story Time maintenance hold cleared.'
}

case "${1:-status}" in
  status)
    aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
      --profile "$PROFILE" --region "$REGION" \
      --query 'Reservations[0].Instances[0].[InstanceId,State.Name,PrivateIpAddress,InstanceType]' --output table
    aws dynamodb get-item --table-name "$TABLE_NAME" \
      --profile "$PROFILE" --region "$REGION" \
      --key '{"id":{"S":"narrator"}}' \
      --query 'Item.[manual_lease_until_epoch.N,used_seconds.N]' --output text || true
    ;;
  hold)
    maintenance_hold "${2:-90}"
    ;;
  release)
    clear_hold
    ;;
  stop)
    echo "Stopping Story Time ($INSTANCE_ID). Active narration will be interrupted."
    clear_hold
    aws ec2 stop-instances --instance-ids "$INSTANCE_ID" --profile "$PROFILE" --region "$REGION"
    ;;
  start)
    maintenance_hold "${2:-90}"
    echo "Manually starting Story Time ($INSTANCE_ID). EC2 compute charges apply."
    aws ec2 start-instances --instance-ids "$INSTANCE_ID" --profile "$PROFILE" --region "$REGION"
    ;;
  *)
    echo 'Usage: story-time-control.sh [status|start [hold-minutes]|stop|hold [minutes]|release]' >&2
    exit 2
    ;;
esac
