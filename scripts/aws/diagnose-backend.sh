#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformBackend-staging"

output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

CLUSTER=$(output BackendClusterName)
SERVICE=$(output BackendServiceName)
LOG_GROUP=$(output BackendLogGroupName)

echo "Cluster: $CLUSTER"
echo "Service: $SERVICE"
echo "Log:     $LOG_GROUP"
echo

echo "Recent ECS service events:"
aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'services[0].events[0:10].[createdAt,message]' \
  --output table || true

echo
echo "Recent backend logs:"
aws logs tail "$LOG_GROUP" \
  --since 20m \
  --region "$REGION" \
  --profile "$PROFILE" || true
