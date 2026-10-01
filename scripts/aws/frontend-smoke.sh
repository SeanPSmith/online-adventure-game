#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="AdventurePlatformFrontend-staging"

output_value() {
  local key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text
}

PUBLIC_URL="$(output_value CloudFrontUrl)"
DISTRIBUTION_ID="$(output_value CloudFrontDistributionId)"

if [[ -z "$PUBLIC_URL" || "$PUBLIC_URL" == "None" ]]; then
  echo "Could not resolve CloudFrontUrl from $STACK_NAME." >&2
  exit 1
fi

echo "URL:          $PUBLIC_URL"
echo "Distribution: $DISTRIBUTION_ID"
echo

echo "[1/4] React root"
ROOT_BODY="$(curl -fsS --max-time 20 "$PUBLIC_URL/")"
if grep -q 'id="root"' <<<"$ROOT_BODY"; then
  echo "PASS: React index.html reached through CloudFront"
else
  echo "FAIL: CloudFront root did not look like the React shell" >&2
  exit 1
fi

echo
echo "[2/4] SPA deep-link rewrite"
LOGIN_BODY="$(curl -fsS --max-time 20 "$PUBLIC_URL/login")"
if grep -q 'id="root"' <<<"$LOGIN_BODY"; then
  echo "PASS: /login rewrites to React without an S3 403/404"
else
  echo "FAIL: /login did not return the React shell" >&2
  exit 1
fi

echo
echo "[3/4] Backend health through CloudFront"
HEALTH_BODY="$(curl -fsS --max-time 20 "$PUBLIC_URL/health")"
echo "$HEALTH_BODY"
if grep -q '"status"' <<<"$HEALTH_BODY" && grep -q '"ok"' <<<"$HEALTH_BODY"; then
  echo "PASS: CloudFront -> ALB -> Fargate"
else
  echo "FAIL: backend health payload was unexpected" >&2
  exit 1
fi

echo
echo "[4/4] Socket.IO polling handshake through CloudFront"
SOCKET_BODY="$(curl -fsS --max-time 20 "$PUBLIC_URL/socket.io/?EIO=4&transport=polling")"
if [[ "$SOCKET_BODY" == 0* ]]; then
  echo "PASS: Socket.IO transport reached the Python server"
else
  echo "FAIL: unexpected Socket.IO handshake: $SOCKET_BODY" >&2
  exit 1
fi

echo
echo "PASS: public staging edge is alive."
echo "$PUBLIC_URL"
