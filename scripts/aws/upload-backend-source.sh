#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformBuild-staging"
ARCHIVE="$ROOT/.aws-build/backend-source.zip"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Backend archive not found. Run scripts/aws/package-backend.sh first." >&2
  exit 2
fi

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='SourceBucketName'].OutputValue | [0]" \
  --output text)

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not resolve SourceBucketName from $STACK." >&2
  exit 3
fi

aws s3 cp "$ARCHIVE" "s3://$BUCKET/backend/source.zip" \
  --region "$REGION" \
  --profile "$PROFILE"

printf 'Uploaded backend source to s3://%s/backend/source.zip\n' "$BUCKET"
