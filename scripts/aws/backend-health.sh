#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformBackend-staging"

HEALTH_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendHealthUrl'].OutputValue | [0]" \
  --output text)

if [[ -z "$HEALTH_URL" || "$HEALTH_URL" == "None" ]]; then
  echo "Could not resolve BackendHealthUrl from $STACK." >&2
  exit 3
fi

echo "$HEALTH_URL"
curl --fail --show-error --silent "$HEALTH_URL"
echo
