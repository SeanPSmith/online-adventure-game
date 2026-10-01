#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformBackend-staging"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT_DIR/scripts/aws/check-aws.sh"

CLUSTER=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendClusterName'].OutputValue | [0]" \
  --output text)

SERVICE=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendServiceName'].OutputValue | [0]" \
  --output text)

if [[ -z "$CLUSTER" || "$CLUSTER" == "None" || -z "$SERVICE" || "$SERVICE" == "None" ]]; then
  echo "Could not resolve ECS cluster/service from $STACK." >&2
  exit 3
fi

echo "Forcing ECS deployment so the service pulls the new staging-current image..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region "$REGION" \
  --profile "$PROFILE" \
  --output json \
  --query '{service:service.serviceName,deployment:service.deployments[0].id,desired:service.desiredCount}'

echo "Waiting for ECS service stability..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --profile "$PROFILE"

echo "Backend service is stable."
"$ROOT_DIR/scripts/aws/backend-health.sh"
