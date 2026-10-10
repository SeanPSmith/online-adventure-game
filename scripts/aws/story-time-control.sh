#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
"$ROOT_DIR/scripts/aws/check-aws.sh"
INSTANCE_ID="$(aws cloudformation describe-stacks \
  --stack-name AdventurePlatformNarrator-staging \
  --profile "$PROFILE" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='NarratorInstanceId'].OutputValue | [0]" \
  --output text)"
if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo 'Narrator instance is not deployed.' >&2
  exit 1
fi
case "${1:-status}" in
  status)
    aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
      --profile "$PROFILE" --region "$REGION" \
      --query 'Reservations[0].Instances[0].[InstanceId,State.Name,PrivateIpAddress,InstanceType]' --output table
    ;;
  stop)
    echo "Stopping Story Time ($INSTANCE_ID). Active narration will be interrupted."
    aws ec2 stop-instances --instance-ids "$INSTANCE_ID" --profile "$PROFILE" --region "$REGION"
    ;;
  start)
    echo "Manually starting Story Time ($INSTANCE_ID). EC2 compute charges apply."
    aws ec2 start-instances --instance-ids "$INSTANCE_ID" --profile "$PROFILE" --region "$REGION"
    ;;
  *) echo 'Usage: story-time-control.sh [status|start|stop]' >&2; exit 2 ;;
esac
