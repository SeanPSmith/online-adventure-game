#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CDK_VERSION="${AWS_CDK_VERSION:-2.1143.0}"

cd "$ROOT_DIR/infra"

npm run build

# Pin the AWS CDK CLI explicitly. This avoids npx resolving the unrelated
# `cdk` package/version when no global/local CDK executable is present.
npm exec --yes --package "aws-cdk@${CDK_VERSION}" -- cdk deploy \
  AdventurePlatformBackend-staging \
  AdventurePlatformFrontend-staging \
  --profile "$PROFILE" \
  --require-approval never
