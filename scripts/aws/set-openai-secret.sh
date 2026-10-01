#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformData-staging"

SECRET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='OpenAiSecretName'].OutputValue | [0]" \
  --output text)

if [[ -z "$SECRET_NAME" || "$SECRET_NAME" == "None" ]]; then
  echo "Could not resolve OpenAiSecretName from $STACK." >&2
  exit 3
fi

printf 'OpenAI key for %s: ' "$SECRET_NAME"
IFS= read -r -s OPENAI_KEY
printf '\n'

if [[ -z "$OPENAI_KEY" ]]; then
  echo "No key entered; secret was not changed." >&2
  exit 4
fi

aws secretsmanager put-secret-value \
  --secret-id "$SECRET_NAME" \
  --secret-string "$OPENAI_KEY" \
  --region "$REGION" \
  --profile "$PROFILE" \
  >/dev/null

unset OPENAI_KEY

echo "OpenAI staging secret updated."
