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

stack_status() {
  local result errfile
  errfile="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-stack-status.XXXXXXXX")"
  if result="$(aws cloudformation describe-stacks --stack-name "$1" \
      --query 'Stacks[0].StackStatus' --output text 2>"$errfile")"; then
    rm -f "$errfile"
    printf '%s\n' "$result"
  elif grep -qi 'does not exist' "$errfile"; then
    rm -f "$errfile"
    echo ABSENT
  else
    cat "$errfile" >&2
    rm -f "$errfile"
    return 1
  fi
}
stack_exists() {
  local current_status
  current_status="$(stack_status "$1")" || return 1
  [[ "$current_status" != ABSENT ]]
}
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
# All GPU observations run against the EXISTING, explicitly running instance.
# Neither smoke nor diagnose starts EC2, changes routing, or mutates Docker.
wait_ssm_online() {
  local id="$1" ping=""
  for i in $(seq 1 45); do
    ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$id" \
      --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
    [[ "$ping" == Online ]] && return 0
    sleep 4
  done
  echo 'SSM agent unavailable. GPU may still be billable; check status and stop if idle.' >&2
  return 1
}
run_observation() {
  local id="$1" action="$2" file cid status_value
  file="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-${action}.XXXXXXXX.json")"
  python3 - "$file" "$action" <<'PYINNER'
import json, shlex, sys
path, action = sys.argv[1:]
if action == 'smoke':
    commands = [
        'set -eu',
        'cloud-init status --wait',
        'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader',
        'test "$(sysctl -n vm.overcommit_memory)" = 1',
        'echo "Waiting up to 3 minutes for Kokoro HTTP readiness..."',
        'ready=0; attempt=0',
        'while [ "$attempt" -lt 36 ]; do',
        '  if curl -fsS --max-time 3 http://127.0.0.1:8880/v1/audio/voices >/dev/null 2>/tmp/tot-gpu-readiness-curl.err; then ready=1; break; fi',
        '  attempt=$((attempt + 1)); sleep 2',
        'done',
        'if [ "$ready" -ne 1 ]; then',
        '  echo "FAIL: Kokoro never became HTTP ready after 36 attempts."',
        '  echo "=== Last curl error ==="; tail -c 500 /tmp/tot-gpu-readiness-curl.err || true',
        '  echo "=== Container state ==="; docker inspect -f "status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{.State.Error}}" story-time-gpu || true',
        '  echo "=== Last Kokoro logs ==="; docker logs --tail 75 story-time-gpu 2>&1 | tail -c 9000 || true',
        '  echo "=== Systemd unit ==="; systemctl is-active tot-story-time-gpu.service || true',
        '  exit 41',
        'fi',
        'test "$(docker inspect -f "{{.State.Running}}" story-time-gpu)" = true',
    ]
    # A voices-list GET is necessary but not sufficient: verify a small actual
    # Michael generation before permitting live backend cutover.
    sample = shlex.quote(json.dumps({
        'model': 'kokoro', 'voice': 'am_michael',
        'input': 'Quillairo narrator health check.',
        'response_format': 'mp3', 'speed': 1.0,
    }, separators=(',', ':')))
    commands += [
        'echo "Checking synthetic Kokoro speech generation (no story content)..."',
        'if ! curl -fsS --max-time 75 -H "Content-Type: application/json" --data-binary ' + sample + ' -o /tmp/tot-gpu-smoke.mp3 http://127.0.0.1:8880/v1/audio/speech; then',
        '  echo "FAIL: Kokoro voices endpoint ready but speech generation failed."; docker logs --tail 50 story-time-gpu 2>&1 | tail -c 7000 || true; rm -f /tmp/tot-gpu-smoke.mp3; exit 42',
        'fi',
        'audio_bytes=$(wc -c </tmp/tot-gpu-smoke.mp3); rm -f /tmp/tot-gpu-smoke.mp3',
        'test "$audio_bytes" -gt 1000 || { echo "FAIL: synthetic MP3 was unexpectedly small ($audio_bytes bytes)."; exit 43; }',
        'echo "PASS: G6f host, GPU Docker, Kokoro HTTP, and synthetic MP3 generation."',
    ]
else:
    commands = [
        'set +e',
        'echo "=== Cloud-init ==="; cloud-init status',
        'echo "=== Host GPU ==="; nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader',
        'echo "=== Memory overcommit ==="; sysctl vm.overcommit_memory',
        'echo "=== Docker container state ==="; docker ps -a --filter name=story-time-gpu --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}" | head -n 6',
        'docker inspect -f "status={{.State.Status}} running={{.State.Running}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} error={{.State.Error}}" story-time-gpu || true',
        'echo "=== Kokoro logs (last 85 lines) ==="; docker logs --tail 85 story-time-gpu 2>&1 | tail -c 10000',
        'echo "=== GPU service unit ==="; systemctl status tot-story-time-gpu.service --no-pager -l 2>&1 | tail -n 24',
        'echo "=== HTTP readiness probe ==="; curl -fsSv --max-time 6 http://127.0.0.1:8880/v1/audio/voices -o /dev/null 2>&1 | tail -c 1500',
        'echo "=== Recent kernel GPU/OOM warnings ==="; journalctl -k -b --no-pager 2>/dev/null | grep -Ei "nvidia|oom|out of memory|segfault" | tail -n 18 | cut -c1-230',
    ]
with open(path, 'w') as stream:
    json.dump({'commands': commands, 'executionTimeout': ['600']}, stream)
PYINNER
  if ! cid="$(aws ssm send-command --instance-ids "$id" --document-name AWS-RunShellScript \
    --comment "Quillairo dedicated GPU ${action} (no story content)" --parameters "file://$file" \
    --query Command.CommandId --output text)"; then
    rm -f "$file"
    return 1
  fi
  rm -f "$file"
  echo "GPU ${action} SSM command: $cid"
  for i in $(seq 1 115); do
    status_value="$(aws ssm get-command-invocation --command-id "$cid" --instance-id "$id" \
      --query Status --output text 2>/dev/null || true)"
    case "$status_value" in
      Success)
        # Print even on success: diagnoses need the detailed Docker/HTTP evidence.
        aws ssm get-command-invocation --command-id "$cid" --instance-id "$id" \
          --query '[StandardOutputContent,StandardErrorContent]' --output text || true
        [[ "$action" == diagnose ]] || echo "GPU narrator smoke PASS (SSM $cid)."
        return 0 ;;
      Failed|Cancelled|TimedOut|Cancelling)
        echo "GPU $action FAILED: $status_value (SSM $cid)" >&2
        aws ssm get-command-invocation --command-id "$cid" --instance-id "$id" \
          --query '[StandardOutputContent,StandardErrorContent]' --output text || true
        return 1 ;;
    esac
    sleep 5
  done
  echo "GPU $action timed out (SSM $cid). Stop the instance if not needed." >&2
  return 1
}
smoke() {
  local id; id="$(gpu_id)"
  [[ "$(state)" == running ]] || { echo 'GPU narrator is not running. Start it explicitly first.' >&2; return 2; }
  echo 'Waiting for on-instance Kokoro readiness. No backend routing changes.'
  wait_ssm_online "$id" || return 1
  run_observation "$id" smoke
}
diagnose() {
  local id; id="$(gpu_id)"
  [[ "$(state)" == running ]] || { echo 'GPU must be running for SSM diagnostics. This command never starts it.' >&2; return 2; }
  echo 'Read-only GPU driver, container, and HTTP diagnostics; no backend routing changes.'
  wait_ssm_online "$id" || return 1
  run_observation "$id" diagnose
}

verify_gpu_synth() {
  # Always validate synthesized CloudFormation before an AWS deployment.
  # No billable resources are created, and a stale existing template cannot pass.
  local dir
  dir="$(mktemp -d "${TMPDIR:-/tmp}/tot-gpu-synth.XXXXXXXX")"
  if ! (cd "$ROOT/infra" && npx cdk synth "$GPU_STACK" --exclusively --quiet \
      --profile "$AWS_PROFILE" --output "$dir"); then
    rm -rf "$dir"
    echo 'GPU CDK synthesis failed; refusing deploy.' >&2
    return 1
  fi
  if ! python3 "$ROOT/scripts/aws/verify-gpu-cdk-template.py" "$dir/$GPU_STACK.template.json"; then
    rm -rf "$dir"
    echo 'GPU CloudFormation launch-template validation failed; refusing deploy.' >&2
    return 1
  fi
  rm -rf "$dir"
}
cdk_action() {
  local selected="$1" target_stack publish_confirmation switch_confirmation
  export TOT_ENABLE_NARRATOR_STACK=1
  export TOT_ENABLE_GPU_NARRATOR_STACK=1
  export TOT_STORY_TIME_GPU_CUTOVER="$selected"

  if [[ "$selected" == 1 ]]; then
    target_stack="$GPU_STACK"
    publish_confirmation='PUBLISH GPU NARRATOR EXPORTS'
    switch_confirmation='SWITCH STAGING TO GPU'
  else
    target_stack="$CPU_STACK"
    publish_confirmation='PUBLISH CPU NARRATOR EXPORTS'
    switch_confirmation='RESTORE CPU NARRATOR'
  fi

  # Critical: the Backend refers to the narrator's instance, cache, and table.
  # CDK generates cross-stack Outputs/Exports ONLY when that consumer reference
  # exists in the synthesized app. The narrator was originally deployed alone,
  # before cutover, and thus lacked the auto-generated AudioCache ARN export.
  # Backend --exclusively cannot publish it on the producer's behalf.
  # Synthesize the narrator WITH the selected backend reference, update ONLY
  # that already-provisioned narrator stack, then deploy the Backend.
  echo "Review $target_stack export changes before backend routing."
  (cd "$ROOT/infra" && npm run build && npx cdk diff "$target_stack" --exclusively --profile "$AWS_PROFILE")
  ask "$publish_confirmation"
  (cd "$ROOT/infra" && npx cdk deploy "$target_stack" --exclusively --profile "$AWS_PROFILE" --require-approval broadening)

  echo "Narrator CloudFormation exports published; review backend routing diff."
  (cd "$ROOT/infra" && npx cdk diff "$BACKEND_STACK" --exclusively --profile "$AWS_PROFILE")
  ask "$switch_confirmation"
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
  bash scripts/aws/story-time-gpu-service.sh clear-rollback # only after failed create/rollback
  bash scripts/aws/story-time-gpu-service.sh provision   # creates BILLABLE new stack
  bash scripts/aws/story-time-gpu-service.sh status
  bash scripts/aws/story-time-gpu-service.sh start       # deliberate billable wake
  bash scripts/aws/story-time-gpu-service.sh smoke       # bounded readiness retries + failure logs
  bash scripts/aws/story-time-gpu-service.sh diagnose    # read-only container/driver logs
  bash scripts/aws/story-time-gpu-service.sh stop
  bash scripts/aws/story-time-gpu-service.sh cutover     # publish GPU exports first, then change backend
  bash scripts/aws/story-time-gpu-service.sh rollback    # publish CPU exports first, then restore backend
PLAN
    ;;
  provision)
    current_status="$(stack_status "$GPU_STACK")"
    if [[ "$current_status" != ABSENT ]]; then
      echo "Dedicated GPU stack exists ($current_status). Refusing to modify it." >&2
      if [[ "$current_status" == ROLLBACK_COMPLETE ]]; then
        echo 'To recover: bash scripts/aws/story-time-gpu-service.sh clear-rollback' >&2
      fi
      exit 2
    fi
    ask 'CREATE DEDICATED GPU NARRATOR'
    export TOT_ENABLE_GPU_NARRATOR_STACK=1
    (cd "$ROOT/infra" && npm run build)
    verify_gpu_synth
    (cd "$ROOT/infra" && npx cdk diff "$GPU_STACK" --profile "$AWS_PROFILE")
    ask 'DEPLOY DEDICATED GPU'
    (cd "$ROOT/infra" && npx cdk deploy "$GPU_STACK" --exclusively --profile "$AWS_PROFILE" --require-approval broadening)
    echo 'GPU instance is now billable. Check status and stop when verification is done.'
    status
    ;;
  clear-rollback)
    current_status="$(stack_status "$GPU_STACK")"
    if [[ "$current_status" != ROLLBACK_COMPLETE ]]; then
      echo "Refusing delete: dedicated GPU stack is $current_status (requires ROLLBACK_COMPLETE)." >&2
      echo 'If rollback is still in progress, wait until CloudFormation finishes.' >&2
      exit 2
    fi
    echo "This removes ONLY the failed CloudFormation stack $GPU_STACK."
    echo 'Review retained resources separately; do NOT delete CPU or benchmark pilot templates.'
    ask 'DELETE FAILED GPU STACK'
    aws cloudformation delete-stack --stack-name "$GPU_STACK"
    aws cloudformation wait stack-delete-complete --stack-name "$GPU_STACK"
    echo 'Failed GPU stack deleted. CPU and GPU pilot stacks unchanged.'
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
  diagnose) diagnose ;;
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
  *) echo 'Usage: story-time-gpu-service.sh [plan|provision|clear-rollback|status|start|stop|smoke|diagnose|cutover|rollback]' >&2; exit 2 ;;
esac
