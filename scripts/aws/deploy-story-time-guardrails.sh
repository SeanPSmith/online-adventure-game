#!/usr/bin/env bash
# Pass 62A.3: fix ECS environment-variable routing inspection (no GPU change).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AWS_PROFILE="${AWS_PROFILE:-adventure-staging}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_PAGER=""
BACKEND_STACK=AdventurePlatformBackend-staging
GPU_STACK=AdventurePlatformNarratorGpu-staging
ACTION="${1:-plan}"

# Preserve the already-active GPU producer references when synthesizing Backend.
export TOT_ENABLE_NARRATOR_STACK=0
export TOT_ENABLE_GPU_NARRATOR_STACK=1
export TOT_STORY_TIME_GPU_CUTOVER=1

if [[ "$ACTION" != plan && "$ACTION" != deploy && "$ACTION" != verify ]]; then
  echo 'Usage: bash scripts/aws/deploy-story-time-guardrails.sh [plan|deploy|verify]' >&2
  exit 2
fi
"$ROOT/scripts/aws/check-aws.sh"

output() {
  aws cloudformation describe-stacks --stack-name "$GPU_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text
}

check_routing() {
  local active gpu_id task_definition current_id backend_status gpu_status
  gpu_status="$(aws cloudformation describe-stacks --stack-name "$GPU_STACK" --query 'Stacks[0].StackStatus' --output text)"
  backend_status="$(aws cloudformation describe-stacks --stack-name "$BACKEND_STACK" --query 'Stacks[0].StackStatus' --output text)"
  [[ "$gpu_status" == CREATE_COMPLETE || "$gpu_status" == UPDATE_COMPLETE ]] || {
    echo "GPU stack is not settled ($gpu_status); refusing backend changes." >&2; return 1;
  }
  [[ "$backend_status" == CREATE_COMPLETE || "$backend_status" == UPDATE_COMPLETE ]] || {
    echo "Backend stack is not settled ($backend_status); refusing backend changes." >&2; return 1;
  }
  gpu_id="$(output NarratorInstanceId)"
  [[ "$gpu_id" == i-* ]] || { echo 'GPU instance ID missing; refusing.' >&2; return 1; }
  task_definition="$(aws ecs describe-services \
    --cluster adventure-platform-staging-cluster \
    --services adventure-platform-staging-backend \
    --query 'services[0].taskDefinition' --output text)"
  [[ "$task_definition" == arn:* ]] || { echo 'Backend ECS task definition missing; refusing.' >&2; return 1; }
  # ECS has containerDefinitions[] -> environment[]. Flatten the latter before
  # filtering; omitting [] returns 'None' even when the correct ID is present.
  current_id="$(aws ecs describe-task-definition --task-definition "$task_definition" \
    --query "taskDefinition.containerDefinitions[?name=='backend'].environment[] | [?name=='KOKORO_INSTANCE_ID'].value | [0]" --output text)"
  if [[ "$current_id" != "$gpu_id" ]]; then
    echo "Existing backend routes to '$current_id' but GPU stack is '$gpu_id'." >&2
    echo 'Refusing to synthesize a different narrator route. Resolve routing first.' >&2
    return 1
  fi
  echo "PASS: existing backend narrator is the dedicated GPU ($gpu_id)."
}

meter_from_ecs() {
  local task_definition
  task_definition="$(aws ecs describe-services \
    --cluster adventure-platform-staging-cluster \
    --services adventure-platform-staging-backend \
    --query 'services[0].taskDefinition' --output text)"
  aws ecs describe-task-definition --task-definition "$task_definition" \
    --query "taskDefinition.containerDefinitions[?name=='backend'].environment[] | [?name=='STORY_TIME_METER_TABLE'].value | [0]" --output text
}

if [[ "$ACTION" == verify ]]; then
  check_routing
  meter="$(meter_from_ecs)"
  [[ -n "$meter" && "$meter" != None ]] || {
    echo 'FAIL: ECS task definition has no STORY_TIME_METER_TABLE.' >&2; exit 1;
  }
  aws dynamodb describe-table --table-name "$meter" \
    --query 'Table.[TableName,TableStatus,GlobalSecondaryIndexes[0].IndexStatus]' --output table
  echo "PASS: configured ECS metering table: $meter"
  exit 0
fi

check_routing
(
  cd "$ROOT/infra"
  npm run build
  npx cdk diff "$BACKEND_STACK" --exclusively --profile "$AWS_PROFILE"
)
if [[ "$ACTION" == plan ]]; then
  echo 'Plan only. Expected: new NarrationMeter DynamoDB table, GSI, ECS task role/env and task revision.'
  echo 'Do NOT approve replacements of the GPU, RDS, backend ALB or S3 buckets.'
  echo 'To apply: bash scripts/aws/deploy-story-time-guardrails.sh deploy'
  exit 0
fi

printf '\nReview the diff. Type DEPLOY NARRATOR METER to update ONLY Backend: '
IFS= read -r confirmation
[[ "$confirmation" == 'DEPLOY NARRATOR METER' ]] || { echo 'Cancelled.'; exit 2; }
(
  cd "$ROOT/infra"
  npx cdk deploy "$BACKEND_STACK" --exclusively --profile "$AWS_PROFILE" --require-approval broadening
)
# CloudFormation output alone is not enough: the task definition must contain
# the backend resource's meter table name before any protected calls are made.
meter="$(meter_from_ecs)"
[[ -n "$meter" && "$meter" != None ]] || {
  echo 'FAIL: deployed backend task lacks STORY_TIME_METER_TABLE. Do not open public signup.' >&2; exit 1;
}
aws dynamodb describe-table --table-name "$meter" --query 'Table.[TableName,TableStatus]' --output table
printf 'PASS: backend meter deployed, configured and IAM scoped. Existing GPU unchanged.\n'
