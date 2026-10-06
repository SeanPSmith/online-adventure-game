#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="AdventurePlatformFrontend-staging"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

output_value() {
  local key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text
}

BUCKET="$(output_value FrontendBucketName)"
DISTRIBUTION_ID="$(output_value CloudFrontDistributionId)"
PUBLIC_URL="$(output_value CloudFrontUrl)"

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not resolve FrontendBucketName from $STACK_NAME." >&2
  exit 1
fi

if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
  echo "Could not resolve CloudFrontDistributionId from $STACK_NAME." >&2
  exit 1
fi

echo "Building React production bundle..."
cd "$FRONTEND_DIR"

# Stamp the deployed UI with the exact Git revision when available. This is
# intentionally a Vite public build identifier, not a secret. It lets support
# and testers confirm which frontend bundle a browser is actually running.
if command -v git >/dev/null 2>&1 && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BUILD_ID="$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
else
  BUILD_ID="deploy-$(date +%Y%m%d-%H%M%S)"
fi

echo "Frontend build id: $BUILD_ID"
VITE_BUILD_ID="$BUILD_ID" npm run build

if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  echo "frontend/dist/index.html was not produced." >&2
  exit 1
fi

echo "Uploading static assets to s3://$BUCKET ..."
aws s3 sync "$FRONTEND_DIR/dist/" "s3://$BUCKET/" \
  --delete \
  --region "$REGION" \
  --profile "$PROFILE" \
  --cache-control "public,max-age=31536000,immutable"

# index.html must revalidate so a deployment never pins an old hashed bundle.
aws s3 cp "$FRONTEND_DIR/dist/index.html" "s3://$BUCKET/index.html" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --content-type "text/html" \
  --cache-control "no-cache,no-store,must-revalidate"

# Service workers must revalidate. Giving this file the same one-year immutable
# policy as hashed Vite assets can pin an old push handler after a deploy.
if [[ -f "$FRONTEND_DIR/dist/notification-sw.js" ]]; then
  aws s3 cp "$FRONTEND_DIR/dist/notification-sw.js" "s3://$BUCKET/notification-sw.js" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --content-type "application/javascript" \
    --cache-control "no-cache,no-store,must-revalidate"
fi

echo "Invalidating CloudFront..."
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/*' \
  --profile "$PROFILE" \
  --query 'Invalidation.Id' \
  --output text)"

echo "Invalidation: $INVALIDATION_ID"
echo "Public URL:   $PUBLIC_URL"
echo
echo "CloudFront may need a few minutes before every edge location sees the new bundle."
