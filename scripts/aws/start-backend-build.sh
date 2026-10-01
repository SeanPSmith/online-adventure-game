#!/usr/bin/env bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK="AdventurePlatformBuild-staging"

PROJECT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendBuildProjectName'].OutputValue | [0]" \
  --output text)

if [[ -z "$PROJECT" || "$PROJECT" == "None" ]]; then
  echo "Could not resolve BackendBuildProjectName from $STACK." >&2
  exit 3
fi

BUILD_ID=$(aws codebuild start-build \
  --project-name "$PROJECT" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'build.id' \
  --output text)

printf 'Started CodeBuild: %s\n' "$BUILD_ID"
printf 'Waiting for completion...\n'

while true; do
  STATUS=$(aws codebuild batch-get-builds \
    --ids "$BUILD_ID" \
    --region "$REGION" \
    --profile "$PROFILE" \
    --query 'builds[0].buildStatus' \
    --output text)

  printf '  %s\n' "$STATUS"

  case "$STATUS" in
    SUCCEEDED)
      echo "Backend build: SUCCEEDED"
      exit 0
      ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      echo
      echo "Backend build did not succeed."
      echo "Failure summary:"
      aws codebuild batch-get-builds \
        --ids "$BUILD_ID" \
        --region "$REGION" \
        --profile "$PROFILE" \
        --query 'builds[0].phases[?phaseStatus==`FAILED`].{Phase:phaseType,Message:contexts[0].message}' \
        --output table || true

      LOG_GROUP=$(aws codebuild batch-get-builds \
        --ids "$BUILD_ID" \
        --region "$REGION" \
        --profile "$PROFILE" \
        --query 'builds[0].logs.groupName' \
        --output text)

      LOG_STREAM=$(aws codebuild batch-get-builds \
        --ids "$BUILD_ID" \
        --region "$REGION" \
        --profile "$PROFILE" \
        --query 'builds[0].logs.streamName' \
        --output text)

      if [[ -n "$LOG_GROUP" && "$LOG_GROUP" != "None" && -n "$LOG_STREAM" && "$LOG_STREAM" != "None" ]]; then
        echo
        echo "Recent CodeBuild log:"
        aws logs get-log-events \
          --log-group-name "$LOG_GROUP" \
          --log-stream-name "$LOG_STREAM" \
          --region "$REGION" \
          --profile "$PROFILE" \
          --limit 80 \
          --query 'events[].message' \
          --output text || true
      fi

      exit 4
      ;;
  esac

  sleep 8
done
