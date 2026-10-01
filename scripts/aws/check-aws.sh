#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
EXPECTED_ACCOUNT="${EXPECTED_AWS_ACCOUNT:-120737642380}"

ACCOUNT=$(aws sts get-caller-identity \
  --profile "$PROFILE" \
  --query Account \
  --output text)

ARN=$(aws sts get-caller-identity \
  --profile "$PROFILE" \
  --query Arn \
  --output text)

printf 'Profile: %s\n' "$PROFILE"
printf 'Region:  %s\n' "$REGION"
printf 'Account: %s\n' "$ACCOUNT"
printf 'Caller:  %s\n' "$ARN"

if [[ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  printf '\nERROR: expected staging account %s but CLI resolved %s.\n' "$EXPECTED_ACCOUNT" "$ACCOUNT" >&2
  exit 2
fi

printf '\nAWS staging identity check: PASS\n'
