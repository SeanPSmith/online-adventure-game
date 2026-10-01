#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CDK_VERSION="${AWS_CDK_VERSION:-2.1143.0}"

cd "$ROOT_DIR/infra"

ACCOUNT="$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)"
CALLER="$(aws sts get-caller-identity --profile "$PROFILE" --query Arn --output text)"

echo "Profile: $PROFILE"
echo "Region:  $REGION"
echo "Account: $ACCOUNT"
echo "Caller:  $CALLER"
echo

npm run build

echo
echo "=== Backend diff (Secure cookie flip) ==="
npm exec --yes --package "aws-cdk@${CDK_VERSION}" -- cdk diff AdventurePlatformBackend-staging \
  --profile "$PROFILE"

echo
echo "=== Frontend diff (S3 + CloudFront) ==="
npm exec --yes --package "aws-cdk@${CDK_VERSION}" -- cdk diff AdventurePlatformFrontend-staging \
  --profile "$PROFILE"
