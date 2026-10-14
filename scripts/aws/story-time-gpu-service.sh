#!/usr/bin/env bash
# Pass 61C.2: opt-in LIVE narrator service (NOT the benchmark pilot).
# No command other than an explicitly confirmed action creates or starts GPU compute.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AWS_PROFILE="${AWS_PROFILE:-adventure-staging}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_PAGER=""
GPU_STACK=AdventurePlatformNarratorGpu-staging
CPU_STACK=AdventurePlatformNarrator-staging
BACKEND_STACK=AdventurePlatformBackend-staging
ACTION="${1:-plan}"
"$ROOT/scripts/aws/check-aws.sh"

stack_exists() { aws cloudformation describe-stacks --stack-name "$1" --query 'Stacks[0].StackStatus' --output text >/dev/null 2>&1; }
output() { aws cloudformation describe-stacks --stack-name "$GPU_STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text; }
gpu_id() {
  stack_exists "$GPU_STACK" || { echo 'Dedicated GPU narrator stack does not exist. Run plan/provision first.' >&2; exit 2; }
  local id; id="$(output NarratorInstanceId)"
  [[ "$id" == i-* ]] || { echo 'GPU instance ID is missing from the stack output.' >&2; exit 2; }
  printf '%s' "$id"
}
ask() { local answer; printf 'Type %s to proceed: ' "$1"; IFS= read -r answer; [[ "$answer" == "$1" ]] || { echo 'Cancelled.'; exit 2; }; }
state() { aws ec2 describe-instances --instance-ids "$(gpu_id)" --query 'Reservations[0].Instances[0].State.Name' --output text; }
status() {
  local id; id="$(gpu_id)"
  aws ec2 describe-instances --instance-ids "$id" \
    --query 'Reservations[0].Instances[0].[InstanceId,State.Name,InstanceType,PrivateIpAddress]' --output table
  echo 'Narrator idle watchdog uses room/generation leases and a 30-hour monthly compute allowance.'
  echo 'EC2 compute bills while running, even without GPU inference; EBS bills while stopped.'
}
smoke() {
  local id; id="$(gpu_id)"
  [[ "$(state)" == running ]] || { echo 'GPU narrator is not running. Start it explicitly first.' >&2; exit 2; }
  echo 'Checking online SSM and on-instance Kokoro readiness. No backend routing changes.'
  local ping=""
  for i in $(seq 1 45); do
    ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$id" \
      --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
    [[ "$ping" == Online ]] && break
    sleep 4
  done
  [[ "$ping" == Online ]] || { echo 'SSM agent unavailable; GPU remains billable. Stop it if finished.' >&2; exit 2; }
  local payload file cid status_value
  file="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-smoke.XXXXXXXX.json")"
  trap 'rm -f "$file"' RETURN
  python3 - "$file" <<'PY'
import json,sys
commands=[
 'set -e',
 'cloud-init status --wait',
 'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader',
 'test "$(sysctl -n vm.overcommit_memory)" = 1',
 'test "$(docker inspect -f "{{.State.Running}}" story-time-gpu)" = true',
 'curl -fsS --max-time 10 http://127.0.0.1:8880/v1/audio/voices > /dev/null',
 'echo "PASS: G6f host, GPU Docker, and Kokoro ready."',
]
with open(sys.argv[1],'w') as f: json.dump({'commands':commands,'executionTimeout':['900']},f)
PY
  cid="$(aws ssm send-command --instance-ids "$id" --document-name AWS-RunShellScript \
    --comment 'Tales of Two dedicated GPU readiness (no story content)' --parameters "file://$file" \
    --query Command.CommandId --output text)"
  for i in $(seq 1 150); do
    status_value="$(aws ssm get-command-invocation --command-id "$cid" --instance-id "$id" \
      --query Status --output text 2>/dev/null || true)"
    case "$status_value" in
      Success) echo "GPU narrator smoke PASS (SSM $cid)."; return 0 ;;
      Failed|Cancelled|TimedOut|Cancelling) echo "GPU narrator smoke FAILED: $status_value" >&2
        aws ssm get-command-invocation --command-id "$cid" --instance-id "$id" \
          --query '[StandardOutputContent,StandardErrorContent]' --output text || true
        return 1 ;;
    esac
    sleep 6
  done
  echo "GPU narrator smoke timed out (SSM $cid); stop the instance if not needed." >&2
  return 1
}
cdk_action() {
  local selected="$1"
  export TOT_ENABLE_NARRATOR_STACK=1
  export TOT_ENABLE_GPU_NARRATOR_STACK=1
  export TOT_STORY_TIME_GPU_CUTOVER="$selected"
  (cd "$ROOT/infra" && npm run build && npx cdk diff "$BACKEND_STACK" --profile "$AWS_PROFILE")
  ask "$( [[ "$selected" == 1 ]] && echo SWITCH STAGING TO GPU || echo RESTORE CPU NARRATOR )"
  (cd "$ROOT/infra" && npx cdk deploy "$BACKEND_STACK" --exclusively --profile "$AWS_PROFILE" --require-approval broadening)
}
case "$ACTION" in
  plan)
    cat <<'PLAN'
Pass 61C.2 — isolated production-capable G6f narrator plan (NO AWS changes).
- A NEW dedicated g6f.large GPU stack; never resize or alter the existing CPU instance.
- AWS GRID 580.159.03, pinned kernel 6.1, matching DRM extras, memory overcommit=1.
- Private ECS-backend-only port 8880; SSM; separate private S3 cache and DynamoDB leases.
- Room-aware early wake; active room/generation protected from idle stop; 5m watchdog.
- 10m minimum uptime, ~5m no-room cooldown plus watchdog polling; 30h/month
  advisory compute allowance. The watchdog is NOT a guaranteed billing cap.
- Approximate $0.202 per running GPU hour plus EBS, networking, and AWS services.
- Normal staging code release DOES NOT create or switch GPUs.

Commands:
  bash scripts/aws/story-time-gpu-service.sh provision   # creates BILLABLE new stack
  bash scripts/aws/story-time-gpu-service.sh status
  bash scripts/aws/story-time-gpu-service.sh start       # deliberate billable wake
  bash scripts/aws/story-time-gpu-service.sh smoke       # read-only readiness probe
  bash scripts/aws/story-time-gpu-service.sh stop
  bash scripts/aws/story-time-gpu-service.sh cutover     # explicitly change backend
  bash scripts/aws/story-time-gpu-service.sh rollback    # return to CPU
PLAN
    ;;
  provision)
    stack_exists "$GPU_STACK" && { echo 'Dedicated GPU stack already exists. Refusing to change it.' >&2; exit 2; }
    ask 'CREATE DEDICATED GPU NARRATOR'
    export TOT_ENABLE_GPU_NARRATOR_STACK=1
    (cd "$ROOT/infra" && npm run build && npx cdk diff "$GPU_STACK" --profile "$AWS_PROFILE")
    ask 'DEPLOY DEDICATED GPU'
    (cd "$ROOT/infra" && npx cdk deploy "$GPU_STACK" --exclusively --profile "$AWS_PROFILE" --require-approval broadening)
    echo 'GPU instance is now billable. Check status and stop when verification is done.'
    status
    ;;
  status) status ;;
  start)
    [[ "$(state)" == stopped ]] || { echo 'GPU must be stopped before explicit start.' >&2; exit 2; }
    ask 'START DEDICATED GPU'
    aws ec2 start-instances --instance-ids "$(gpu_id)" --query 'StartingInstances[*].[InstanceId,CurrentState.Name]' --output table
    echo 'Started. Watchdog handles idle stopping, but confirm stop if testing manually.'
    ;;
  stop)
    current="$(state)"
    if [[ "$current" == running || "$current" == pending ]]; then
      aws ec2 stop-instances --instance-ids "$(gpu_id)" --query 'StoppingInstances[*].[InstanceId,CurrentState.Name]' --output table
      echo 'Stop requested. Active speech would be interrupted: only use for an idle/test instance.'
    else echo "No stop necessary: $current"; fi
    ;;
  smoke) smoke ;;
  cutover)
    stack_exists "$CPU_STACK" || { echo 'CPU fallback stack missing. Refusing cutover.' >&2; exit 2; }
    smoke # Refuse to switch if GPU not CURRENTLY healthy.
    cdk_action 1
    echo 'Staging now routes Story Time to dedicated GPU. Watch live rooms and latency.'
    ;;
  rollback)
    stack_exists "$CPU_STACK" || { echo 'CPU narrator stack missing. Refusing rollback.' >&2; exit 2; }
    cdk_action 0
    echo 'Staging has returned to CPU narrator configuration.'
    ;;
  *) echo 'Usage: story-time-gpu-service.sh [plan|provision|status|start|stop|smoke|cutover|rollback]' >&2; exit 2 ;;
esac
