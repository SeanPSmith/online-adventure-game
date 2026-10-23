#!/usr/bin/env bash
# Isolated GPU pilot only: never changes existing CPU narrator or backend.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AWS_PROFILE="${AWS_PROFILE:-adventure-staging}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
# Budget pilot has its OWN CloudFormation stack, private bucket, EC2, and watchdog.
# Default commands retain the original T4 pilot, unchanged.
VARIANT="${STORY_TIME_GPU_PILOT_VARIANT:-standard}"
case "$VARIANT" in
  standard) STACK='AdventurePlatformNarratorGpuPilot-staging'; DEFAULT_GPU_TYPE='g4dn.xlarge'; MAX_RUN_SECONDS=7200; CONTAINER_MEMORY_GIB=12; ROOT_VOLUME_GIB=80;;
  budget) STACK='AdventurePlatformNarratorGpuBudgetPilot-staging'; DEFAULT_GPU_TYPE='g6f.large'; MAX_RUN_SECONDS=1800; CONTAINER_MEMORY_GIB=6; ROOT_VOLUME_GIB=50;;
  *) echo "Unknown GPU pilot variant: $VARIANT" >&2; exit 2;;
esac
CPU_STACK='AdventurePlatformNarrator-staging'
TEMPLATE="$ROOT_DIR/infra/gpu-pilot/story-time-gpu-pilot.yaml"
COMMAND="${1:-plan}"

"$ROOT_DIR/scripts/aws/check-aws.sh"

stack_exists() {
  aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text >/dev/null 2>&1
}
output() {
  aws cloudformation describe-stacks --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text
}
pilot_id() {
  local value
  value="$(output GpuPilotInstanceId)"
  [[ "$value" == i-* ]] || { echo 'GPU pilot stack has no instance output' >&2; exit 2; }
  printf '%s' "$value"
}
require_pilot() {
  stack_exists || { echo 'GPU pilot stack does not exist; run plan, then deploy.' >&2; exit 2; }
}

case "$COMMAND" in
  plan)
    if [[ "$VARIANT" == budget ]]; then
      cat <<'BUDGET'
Pass 61B.8 // budget NVIDIA GPU benchmark — NOTHING CREATED.
- NEW isolated g6f.large (1/8 NVIDIA L4; 3 GiB VRAM; 8 GiB system RAM).
- Kernel-6.1-pinned Amazon Linux 2023 AMI; explicitly installs AWS GRID vGPU
  driver 19.5 (or 19.4) from AWS-owned S3 instead of OSS/Tesla driver.
- NVIDIA container toolkit + same Kokoro image/samples as the T4 pilot.
- First boot uses AL2023 curl-minimal, matching kernel build headers AND
  kernel6.1-modules-extra: required for DRM/GEM symbols used by NVIDIA GRID.
- A guarded "repair" command can fix the existing failed, stopped G6f
  without destroying/redeploying the budget pilot stack.
- Before benchmarking, wait for cloud-init to finish and verify NVIDIA/ Docker;
  SSM Online alone does not mean the GPU bootstrap is ready.
  Startup may take several minutes; no silent alternate driver.
- 50 GiB encrypted gp3 EBS, 6 GiB Docker memory ceiling, NO inbound ports.
- Private S3 artifact bucket with 2-day object retention.
- Automatic instance stop after 30 minutes of continuous running (5m polling),
  plus automatic stop request after each benchmark, even if it fails.
- Approximate on-demand GPU compute $0.202/hour in us-east-1; EBS continues
  to bill after EC2 stop. No existing pilot or production resources altered.
- IMPORTANT: Driver installation and CUDA compatibility remain UNVERIFIED on AWS.
  If it fails, benchmark aborts and stops instance; diagnose logs first.
- New deployments get the dependency fix; an existing failed budget host
  can be repaired in-place after exact typed confirmation.
- To run: bash scripts/aws/story-time-gpu-budget.sh deploy
- Then:  bash scripts/aws/story-time-gpu-budget.sh benchmark
- Fetch: bash scripts/aws/story-time-gpu-budget.sh fetch
- Remove all billable pilot resources: bash scripts/aws/story-time-gpu-budget.sh cleanup
BUDGET
      exit 0
    fi
    cat <<'INFO'
Pass 59B // isolated full-quality Kokoro GPU pilot — NOTHING CREATED.
- Separate g4dn.xlarge (NVIDIA T4), AWS GPU-ready AL2023 image,
  ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126.
- 80 GiB encrypted gp3 disk, PRIVATE S3 benchmark samples expiring after 2 days.
- No inbound ports; no ECS/game backend changes; no interference with CPU narrator.
- Public IP is needed for outbound GHCR/SSM in the existing public subnet.
- Automatic EC2 stop after 120 minutes of continuous running (5-minute polling).
- EC2 compute around $0.526/hour (~$1.05/2h), plus public IPv4, EBS,
  Lambda, S3 and data charges. Instance and disk bill from deployment.
- Explicit cleanup required to remove storage and pilot resources.

To create billable GPU infrastructure (requires AWS quota and sufficient IAM):
  bash scripts/aws/story-time-gpu-pilot.sh deploy

For other operations:
  bash scripts/aws/story-time-gpu-pilot.sh status
  bash scripts/aws/story-time-gpu-pilot.sh benchmark
  bash scripts/aws/story-time-gpu-pilot.sh fetch
  bash scripts/aws/story-time-gpu-pilot.sh stop
  bash scripts/aws/story-time-gpu-pilot.sh cleanup
INFO
    ;;
  deploy)
    if stack_exists; then
      echo 'GPU pilot stack already exists. Refusing to create/update it; use status.' >&2
      exit 2
    fi
    CPU_INSTANCE="$(aws cloudformation describe-stacks --stack-name "$CPU_STACK" \
      --query "Stacks[0].Outputs[?OutputKey=='NarratorInstanceId'].OutputValue | [0]" --output text)"
    [[ "$CPU_INSTANCE" == i-* ]] || { echo 'CPU narrator instance not resolved. Aborting.' >&2; exit 2; }
    # Reuse public subnet to ensure internet egress works as it does for CPU.
    read -r VPC SUBNET <<< "$(aws ec2 describe-instances --instance-ids "$CPU_INSTANCE" \
      --query 'Reservations[0].Instances[0].[VpcId,SubnetId]' --output text)"
    [[ "$VPC" == vpc-* && "$SUBNET" == subnet-* ]] || { echo 'VPC or subnet missing'; exit 2; }
    if [[ "$VARIANT" == budget ]]; then
      [[ "${STORY_TIME_GPU_TYPE:-g6f.large}" == g6f.large ]] || { echo 'Budget pilot only supports g6f.large.' >&2; exit 2; }
      # Pin to still-supported AL2023 kernel 6.1 so GRID compiles against
      # predictable, matching kernel-devel instead of a moving default.
      AMI_PARAM='/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64'
    else
      AMI_PARAM='/aws/service/ecs/optimized-ami/amazon-linux-2023/gpu/recommended/image_id'
    fi
    AMI="$(aws ssm get-parameter --name "$AMI_PARAM" --query Parameter.Value --output text)"
    [[ "$AMI" == ami-* ]] || { echo 'AL2023 AMI lookup failed.' >&2; exit 2; }
    # Deep Learning AMIs can have a larger source snapshot than our desired
    # 50-GiB budget root disk. EBS cannot create a volume smaller than its
    # snapshot. Read the actual AMI minimum BEFORE provisioning billable EC2.
    AMI_MIN_VOLUME="$(aws ec2 describe-images --image-ids "$AMI" \
      --query 'Images[0].BlockDeviceMappings[0].Ebs.VolumeSize' --output text)"
    [[ "$AMI_MIN_VOLUME" =~ ^[0-9]+$ ]] || { echo "Could not determine AMI snapshot volume size: $AMI_MIN_VOLUME" >&2; exit 2; }
    if (( AMI_MIN_VOLUME > ROOT_VOLUME_GIB )); then
      ROOT_VOLUME_GIB="$AMI_MIN_VOLUME"
      echo "NOTICE: Selected AMI requires at least ${ROOT_VOLUME_GIB} GiB EBS; budget disk was increased to match snapshot."
    fi
    echo "Pilot variant: $VARIANT | Stack: $STACK"
    echo "Pilot instance: ${STORY_TIME_GPU_TYPE:-$DEFAULT_GPU_TYPE} | Existing VPC: $VPC | Subnet: $SUBNET | GPU AMI: $AMI"
    echo "Storage: ${ROOT_VOLUME_GIB} GiB gp3 | Container RAM limit: ${CONTAINER_MEMORY_GIB} GiB | Watchdog: ${MAX_RUN_SECONDS}s"
    echo 'The CPU narrator and game backend will not be modified.'
    if [[ "$VARIANT" == budget ]]; then
      echo 'Type CREATE BUDGET GPU PILOT to accept billable resources and a 30-minute watchdog:'
      confirmation='CREATE BUDGET GPU PILOT'
    else
      echo 'Type CREATE GPU PILOT to accept billable resources and a 2-hour automatic stop:'
      confirmation='CREATE GPU PILOT'
    fi
    IFS= read -r answer
    [[ "$answer" == "$confirmation" ]] || { echo 'Cancelled.'; exit 1; }
    aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" \
      --capabilities CAPABILITY_IAM \
      --parameter-overrides \
        "VpcId=$VPC" "SubnetId=$SUBNET" "GpuAmiId=$AMI" \
        "InstanceType=${STORY_TIME_GPU_TYPE:-$DEFAULT_GPU_TYPE}" "HardStopSeconds=$MAX_RUN_SECONDS" \
        "ContainerMemoryGiB=$CONTAINER_MEMORY_GIB" "RootVolumeGiB=$ROOT_VOLUME_GIB" \
      --tags Project=TalesOfTwo Environment=staging Purpose=StoryTimeGpuPilot
    echo 'Provisioned isolated GPU resources. This instance is BILLING until stopped.'
    echo 'Container image pull can take several minutes. Check status and logs if needed.'
    bash "$0" status
    ;;
  status)
    require_pilot
    IID="$(pilot_id)"
    aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].[InstanceId,State.Name,InstanceType,LaunchTime,PrivateIpAddress]' --output table
    echo "Private benchmark bucket: $(output GpuPilotBucket)"
    echo "Watchdog: $(output GpuPilotWatchdog) (stop after $(output GpuPilotHardStopSeconds)s, polled every 5m)"
    ;;
  diagnose)
    # Read-only inspection. No EC2 start/stop, stack mutations or container changes.
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text)"
    echo "GPU pilot ($VARIANT) diagnostics: $IID ($STATE)"
    echo '--- Latest EC2 console output (no instance start required) ---'
    CONSOLE="$(aws ec2 get-console-output --instance-id "$IID" --latest \
      --query Output --output text 2>&1)" || CONSOLE='Console output unavailable (AWS access or instance support).'
    if [[ -z "$CONSOLE" || "$CONSOLE" == None ]]; then
      echo 'No console output returned. This is not evidence that cloud-init succeeded.'
    else
      printf '%s\n' "$CONSOLE" | tail -n 100
    fi
    if [[ "$STATE" != running ]]; then
      echo "Instance is $STATE. Host-specific cloud-init logs require an explicitly started instance."
      echo "No instance was started. To authorize billable diagnosis: bash scripts/aws/story-time-gpu-budget.sh start"
      exit 0
    fi
    PING="$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=$IID" \
      --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
    if [[ "$PING" != Online ]]; then
      echo "SSM is not Online ($PING). Host logs unavailable; no changes made."
      exit 0
    fi
    echo '--- Read-only SSM bootstrap diagnostics ---'
    PARAMS="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-diagnose.XXXXXXXX.json")"
    trap 'rm -f "$PARAMS"' EXIT
    python3 - "$PARAMS" <<'PYDIAG'
import json,sys
# SSM Run Command truncates inline stdout at 24,000 characters. The previous
# diagnosis spent that budget on verbose package listings. Keep the output
# focused and bounded, with the most recent runtime/RPC error FIRST.
# Never send story content, credentials or audio.
commands=[
  # Preserve the highest-value diagnostic output first. SSM inline stdout is
  # bounded, and package/installer logs previously consumed the entire budget.
  # These files survive the explicit EC2 stop after a failed runtime repair.
  'echo "=== LAST RUNTIME REPAIR: errors and kernel-memory hints ==="; if test -f /var/log/tot-gpu-runtime-ssm.log; then grep -Ei "rpc error|nvidia-container-cli:|nvc:|__vm_enough_memory|not enough memory|allocation|segfault|oom|out.of.memory|ERROR:|FAILED|overcommit|Kernel GPU/memory" /var/log/tot-gpu-runtime-ssm.log | tail -n 24 | cut -c 1-190 || true; else echo "No previous runtime-repair log"; fi',
  'echo "=== NVIDIA CONTAINER CLI: last diagnostic messages ==="; if test -f /var/log/tot-nvidia-container-cli.log; then tail -n 22 /var/log/tot-nvidia-container-cli.log | cut -c 1-190; else echo "No toolkit diagnostic log"; fi',
  'echo "=== Kernel allocation / NVIDIA RPC errors: latest and previous boot ==="; { journalctl -k -b --no-pager 2>/dev/null; journalctl -k -b -1 --no-pager 2>/dev/null; } | grep -Ei "nvc:|__vm_enough_memory|not enough memory|allocation|segfault|oom|out.of.memory|nvrm|xid" | tail -n 20 | cut -c 1-190 || true',
  'echo "=== Linux memory commitment (read-only) ==="; printf "vm.overcommit_memory="; cat /proc/sys/vm/overcommit_memory; grep -E "^(MemTotal|MemAvailable|SwapTotal|CommitLimit|Committed_AS):" /proc/meminfo || true',
  'echo "=== NVIDIA installer: errors with context ==="; if test -f /var/log/nvidia-installer.log; then grep -inE -C 2 "^ERROR:|Kernel module load error|Unknown symbol|nouveau|nvrm|secure boot|lockdown" /var/log/nvidia-installer.log | tail -n 13 | cut -c 1-180 || true; else echo "MISSING /var/log/nvidia-installer.log"; fi',
  'echo "=== Driver and hardware facts ==="; uname -r; gcc --version | head -n 1; lspci -nn | grep -i nvidia || true; lsmod | grep -E "^(nouveau|nvidia)" || true; test -d "/usr/src/kernels/$(uname -r)" && echo "matching kernel-devel: present" || echo "matching kernel-devel: missing"; command -v nvidia-smi || true',
  'echo "=== Bootstrap result (errors only) ==="; grep -iE "(ERROR:|fail|selected AWS GRID driver|installer|NVIDIA driver)" /var/log/tot-story-time-gpu-setup.log 2>/dev/null | tail -n 12 | cut -c 1-180 || true',
  'echo "=== cloud-init ==="; cloud-init status --long 2>&1 | head -n 10 || true',
]
with open(sys.argv[1],'w') as f:
  json.dump({'commands':commands,'executionTimeout':['90']},f)
PYDIAG
    CMD_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
      --instance-ids "$IID" --parameters "file://$PARAMS" \
      --comment 'Read-only Quillairo GPU bootstrap diagnostics' \
      --query Command.CommandId --output text)"
    echo "SSM diagnostic command: $CMD_ID"
    STATUS=Pending
    for _ in $(seq 1 18); do
      STATUS="$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$IID" \
        --query Status --output text 2>/dev/null || echo Pending)"
      case "$STATUS" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
      sleep 5
    done
    echo "Diagnostics status: $STATUS"
    aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$IID" \
      --query '[StandardOutputContent,StandardErrorContent]' --output text || true
    echo 'Diagnostics complete. No resources were started/stopped or modified.'
    ;;
  start)
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
       --query 'Reservations[0].Instances[0].State.Name' --output text)"
    if [[ "$STATE" == running ]]; then
      echo 'GPU pilot already running; hard stop still counts from its launch time.'
    elif [[ "$STATE" == stopped ]]; then
      echo "Starting $VARIANT GPU pilot. Hard-stop countdown ($MAX_RUN_SECONDS seconds) resets on EC2 start."
      aws ec2 start-instances --instance-ids "$IID" >/dev/null
    else
      echo "Instance in $STATE; wait for state to settle before starting." >&2
      exit 2
    fi
    bash "$0" status
    ;;
  stop)
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
       --query 'Reservations[0].Instances[0].State.Name' --output text)"
    if [[ "$STATE" == running || "$STATE" == pending ]]; then
      echo "Stopping isolated GPU pilot $IID (not CPU narrator)."
      aws ec2 stop-instances --instance-ids "$IID" >/dev/null
    else
      echo "GPU pilot already $STATE."
    fi
    ;;
  repair)
    # Recovery is explicitly limited to the existing budget stack. Never
    # touches the standard T4, CPU narrator, production or game backend.
    [[ "$VARIANT" == budget ]] || { echo 'Repair is only supported for the budget g6f.large pilot.' >&2; exit 2; }
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
       --query 'Reservations[0].Instances[0].State.Name' --output text)"
    TYPE="$(aws ec2 describe-instances --instance-ids "$IID" \
       --query 'Reservations[0].Instances[0].InstanceType' --output text)"
    [[ "$TYPE" == g6f.large && "$STATE" == stopped ]] || {
      echo "Budget repair requires a stopped g6f.large; found $TYPE / $STATE" >&2; exit 2;
    }
    echo "Repair existing isolated budget GPU $IID (g6f.large)."
    echo 'This starts billable EC2 temporarily and changes only its host software.'
    echo 'The 30-minute watchdog stays active; the command also requests stop on exit.'
    echo 'Type REPAIR BUDGET GPU PILOT to proceed:'
    IFS= read -r answer
    [[ "$answer" == 'REPAIR BUDGET GPU PILOT' ]] || { echo 'Cancelled.'; exit 1; }
    # Upload before startup so a failed upload cannot incur compute charges.
    BUCKET="$(output GpuPilotBucket)"
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-gpu-budget-repair-ec2.sh" \
      "s3://$BUCKET/scripts/repair.sh" --only-show-errors
    stop_budget_after_repair() {
      echo 'Budget repair ended; requesting stop to control GPU costs.'
      bash "$ROOT_DIR/scripts/aws/story-time-gpu-budget.sh" stop || true
    }
    trap stop_budget_after_repair EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    aws ec2 start-instances --instance-ids "$IID" >/dev/null
    aws ec2 wait instance-running --instance-ids "$IID"
    echo 'Waiting for SSM registration...'
    online=0
    for _ in $(seq 1 36); do
      ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$IID" \
         --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
      if [[ "$ping" == Online ]]; then online=1; break; fi
      sleep 5
    done
    [[ "$online" == 1 ]] || { echo 'SSM not Online; automatic stop requested.' >&2; exit 22; }
    PARAMS="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-repair.XXXXXXXX.json")"
    trap 'rm -f "$PARAMS"; stop_budget_after_repair' EXIT
    python3 - "$PARAMS" "$BUCKET" <<'PYREPAIR'
import json,sys
p,bucket=sys.argv[1:]
commands=[
    'set -e',
    f'aws s3 cp s3://{bucket}/scripts/repair.sh /tmp/tot-gpu-repair.sh --only-show-errors',
    'bash /tmp/tot-gpu-repair.sh >/var/log/tot-story-time-gpu-repair-ssm.log 2>&1 || { tail -n 35 /var/log/tot-story-time-gpu-repair-ssm.log; exit 23; }',
    'echo "Budget GPU repair succeeded"; nvidia-smi --query-gpu=name,memory.total --format=csv,noheader',
]
with open(p,'w') as f: json.dump({'commands':commands,'executionTimeout':['1200']},f)
PYREPAIR
    COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
      --instance-ids "$IID" --parameters "file://$PARAMS" \
      --comment 'Explicit Quillairo budget GPU dependency repair' \
      --query Command.CommandId --output text)"
    echo "Budget repair SSM command: $COMMAND_ID"
    RESULT=Pending
    for _ in $(seq 1 150); do
      RESULT="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
        --query Status --output text 2>/dev/null || echo Pending)"
      case "$RESULT" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
      sleep 8
    done
    echo "Budget repair SSM status: $RESULT"
    aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
      --query '[StandardOutputContent,StandardErrorContent]' --output text || true
    [[ "$RESULT" == Success ]] || { echo 'GPU repair failed; inspect focused diagnostics before further changes.' >&2; exit 1; }
    echo 'GPU repaired. After EC2 is stopped, restart it and benchmark. Do not redeploy.'
    ;;
  runtime-repair)
    # Explicit recovery of NVIDIA container runtime failure on existing budget GPU.
    [[ "$VARIANT" == budget ]] || { echo 'Runtime repair is budget g6f.large only.' >&2; exit 2; }
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text)"
    TYPE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].InstanceType' --output text)"
    [[ "$TYPE" == g6f.large && "$STATE" == stopped ]] || {
      echo "GPU runtime repair requires a stopped g6f.large; found $TYPE / $STATE" >&2; exit 2;
    }
    echo "Repair NVIDIA Docker runtime on existing isolated budget GPU $IID."
    echo 'Temporary billable EC2 startup; 30-minute watchdog, automatic stop on exit.'
    echo 'No driver downloads, CloudFormation updates, CPU narrator changes or new EC2 instances.'
    echo 'Type FIX GPU CONTAINER RUNTIME to proceed:'
    IFS= read -r answer
    [[ "$answer" == 'FIX GPU CONTAINER RUNTIME' ]] || { echo 'Cancelled.'; exit 1; }
    BUCKET="$(output GpuPilotBucket)"
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-gpu-budget-runtime-ec2.sh" \
      "s3://$BUCKET/scripts/runtime-repair.sh" --only-show-errors
    stop_budget_after_runtime() {
      echo 'GPU runtime test concluded; requesting EC2 stop.'
      bash "$ROOT_DIR/scripts/aws/story-time-gpu-budget.sh" stop || true
    }
    trap stop_budget_after_runtime EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    aws ec2 start-instances --instance-ids "$IID" >/dev/null
    aws ec2 wait instance-running --instance-ids "$IID"
    online=0
    for _ in $(seq 1 36); do
      ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$IID" \
        --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
      if [[ "$ping" == Online ]]; then online=1; break; fi
      sleep 5
    done
    [[ "$online" == 1 ]] || { echo 'SSM not Online; stop requested.' >&2; exit 22; }
    PARAMS="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-runtime.XXXXXXXX.json")"
    trap 'rm -f "$PARAMS"; stop_budget_after_runtime' EXIT
    python3 - "$PARAMS" "$BUCKET" <<'PYRUNTIME'
import json,sys
p,bucket=sys.argv[1:]
commands=[
 'set -e',
 f'aws s3 cp s3://{bucket}/scripts/runtime-repair.sh /tmp/tot-budget-runtime-repair.sh --only-show-errors',
 'bash /tmp/tot-budget-runtime-repair.sh > /var/log/tot-gpu-runtime-ssm.log 2>&1 || { tail -n 65 /var/log/tot-gpu-runtime-ssm.log | cut -c 1-190; exit 30; }',
 'echo "Runtime repair succeeded. Kokoro readiness confirmed."',
]
with open(p,'w') as f: json.dump({'commands':commands,'executionTimeout':['1200']},f)
PYRUNTIME
    COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
      --instance-ids "$IID" --parameters "file://$PARAMS" \
      --comment 'Explicit Quillairo budget NVIDIA runtime repair' \
      --query Command.CommandId --output text)"
    echo "Budget runtime repair SSM command: $COMMAND_ID"
    RESULT=Pending
    for _ in $(seq 1 150); do
      RESULT="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
        --query Status --output text 2>/dev/null || echo Pending)"
      case "$RESULT" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
      sleep 8
    done
    echo "Budget runtime repair SSM status: $RESULT"
    aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
      --query '[StandardOutputContent,StandardErrorContent]' --output text || true
    [[ "$RESULT" == Success ]] || { echo 'Runtime check failed. Do not redeploy; inspect driver/RPC/host-memory diagnostics.' >&2; exit 1; }
    echo 'Runtime check passed. After EC2 is stopped, restart existing pilot and benchmark.'
    ;;
  memory-repair)
    # Pass 61B.11: the exact g6f host showed nvc:[driver] virtual-memory
    # allocation rejections at vm.overcommit_memory=0. Test policy change in
    # place without touching CPU/T4 or reprovisioning GPU drivers.
    [[ "$VARIANT" == budget ]] || { echo 'Memory repair is budget g6f.large only.' >&2; exit 2; }
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text)"
    TYPE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].InstanceType' --output text)"
    [[ "$TYPE" == g6f.large && "$STATE" == stopped ]] || {
      echo "Memory repair requires a stopped g6f.large; found $TYPE / $STATE" >&2; exit 2;
    }
    echo "Experiment: temporarily allow memory overcommit on isolated budget GPU $IID."
    echo 'Tests CUDA passthrough and Kokoro; reverts on failure, persists on success.'
    echo 'Uses the existing stopped EC2; billable runtime plus 30-minute hard-stop watchdog.'
    echo 'Linux overcommit does NOT add physical memory. No other stacks modified.'
    echo 'Type TEST GPU MEMORY OVERCOMMIT to approve:'
    IFS= read -r answer
    [[ "$answer" == 'TEST GPU MEMORY OVERCOMMIT' ]] || { echo 'Cancelled.'; exit 1; }
    BUCKET="$(output GpuPilotBucket)"
    # Upload first; no EC2 billing if artifact preparation fails.
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-gpu-budget-memory-ec2.sh" \
      "s3://$BUCKET/scripts/memory-repair.sh" --only-show-errors
    stop_budget_after_memory() {
      echo 'GPU memory test complete or failed; requesting EC2 stop.'
      bash "$ROOT_DIR/scripts/aws/story-time-gpu-budget.sh" stop || true
    }
    trap stop_budget_after_memory EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    aws ec2 start-instances --instance-ids "$IID" >/dev/null
    aws ec2 wait instance-running --instance-ids "$IID"
    online=0
    for _ in $(seq 1 36); do
      ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$IID" \
        --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
      if [[ "$ping" == Online ]]; then online=1; break; fi
      sleep 5
    done
    [[ "$online" == 1 ]] || { echo 'SSM unavailable; stop requested.' >&2; exit 22; }
    PARAMS="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-memory.XXXXXXXX.json")"
    trap 'rm -f "$PARAMS"; stop_budget_after_memory' EXIT
    python3 - "$PARAMS" "$BUCKET" <<'PYMEMORY'
import json, sys
p, bucket = sys.argv[1:]
commands = [
    'set -e',
    f'aws s3 cp s3://{bucket}/scripts/memory-repair.sh /tmp/tot-budget-memory-repair.sh --only-show-errors',
    'bash /tmp/tot-budget-memory-repair.sh > /var/log/tot-gpu-memory-ssm.log 2>&1 || { tail -n 52 /var/log/tot-gpu-memory-ssm.log | cut -c 1-200; exit 38; }',
    'echo "GPU memory repair passed; Kokoro ready; requesting EC2 stop."',
]
with open(p, 'w') as f:
    json.dump({'commands': commands, 'executionTimeout': ['1200']}, f)
PYMEMORY
    COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
      --instance-ids "$IID" --parameters "file://$PARAMS" \
      --comment 'Guarded Quillairo fractional GPU memory overcommit test' \
      --query Command.CommandId --output text)"
    echo "Budget memory test SSM command: $COMMAND_ID"
    RESULT=Pending
    for _ in $(seq 1 150); do
      RESULT="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
        --query Status --output text 2>/dev/null || echo Pending)"
      case "$RESULT" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
      sleep 8
    done
    echo "Budget memory test SSM status: $RESULT"
    aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
      --query '[StandardOutputContent,StandardErrorContent]' --output text || true
    [[ "$RESULT" == Success ]] || { echo 'GPU memory test failed. Do NOT benchmark; inspect saved logs.' >&2; exit 1; }
    echo 'Memory policy test passed. After EC2 stops, start the existing pilot and benchmark.'
    ;;
  benchmark)
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text)"
    [[ "$STATE" == running ]] || { echo "GPU pilot is $STATE. Do NOT restart merely to retry a failed benchmark. Diagnose first: bash $0 diagnose" >&2; exit 2; }
    BUCKET="$(output GpuPilotBucket)"
    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
    echo "GPU pilot ($VARIANT): $IID, result prefix: s3://$BUCKET/results/$RUN_ID/"
    echo 'Checking Systems Manager readiness...'
    ssm_online=0
    for _ in $(seq 1 24); do
      ping="$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$IID" \
        --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
      if [[ "$ping" == Online ]]; then ssm_online=1; break; fi
      sleep 5
    done
    if [[ "$ssm_online" != 1 ]]; then
      echo 'GPU instance is not SSM Online. Check AMI, instance boot logs, IAM and networking before benchmark.' >&2
      echo 'Requesting stop to avoid charges while SSM is unavailable.' >&2
      bash "$0" stop || true
      exit 2
    fi
    echo 'SSM is online; host GPU driver/bootstrap may still be incomplete. Diagnose failures with: bash scripts/aws/story-time-gpu-budget.sh diagnose'
    echo 'Three unique generation tests; A/B MP3 files uploaded privately to S3.'
    printf 'Run now? [y/N] '
    read -r answer
    [[ "$answer" == y || "$answer" == Y ]] || exit 0
    # Stop the billable GPU instance on *every* post-confirmation exit path,
    # including S3 upload, SSM submission, polling and result-fetch errors.
    stop_gpu_on_exit() {
      echo 'Benchmark concluded or failed; requesting GPU pilot stop.'
      bash "$ROOT_DIR/scripts/aws/story-time-gpu-pilot.sh" stop || true
    }
    trap stop_gpu_on_exit EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-gpu-benchmark-ec2.sh" \
      "s3://$BUCKET/scripts/benchmark.sh" --only-show-errors
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-mp3-duration.py" \
      "s3://$BUCKET/scripts/mp3-duration.py" --only-show-errors
    PARAMS="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-ssm.XXXXXXXX.json")"
    trap 'rm -f "$PARAMS"; stop_gpu_on_exit' EXIT
    python3 - "$PARAMS" "$BUCKET" "$RUN_ID" "$AWS_REGION" "$VARIANT" <<'PY'
import json,sys
p,bucket,run_id,region,variant=sys.argv[1:]
# A previously failed first boot can be repaired with the explicit SSM
# "repair" command; its marker is written ONLY after NVIDIA + Docker pass.
bootstrap_gate = ('cloud-init status --wait --long || '
    '{ test -f /var/lib/tot-story-time-gpu-budget-repaired && '
    'echo "Verified repaired budget GPU after historical cloud-init failure"; }') \
    if variant == 'budget' else 'cloud-init status --wait --long'
commands=[
    'set -e',
    f'export AWS_DEFAULT_REGION={region}',
    # SSM can be Online while cloud-init is still installing GRID. Wait for
    # actual boot completion before touching the benchmark or stopping EC2.
    'echo "Checking GPU host bootstrap completion..."',
    bootstrap_gate + ' || { echo "GPU bootstrap failed; run story-time-gpu-budget.sh diagnose" >&2; exit 14; }',
    'command -v nvidia-smi && nvidia-smi || { echo "NVIDIA GPU driver is not ready" >&2; exit 15; }',
    'docker inspect --format "{{.State.Running}}" story-time-gpu | grep -qx true || { echo "GPU Kokoro container is not running" >&2; exit 16; }',
    f'aws s3 cp s3://{bucket}/scripts/benchmark.sh /tmp/tot-story-time-gpu-benchmark.sh --only-show-errors',
    f'aws s3 cp s3://{bucket}/scripts/mp3-duration.py /tmp/story-time-mp3-duration.py --only-show-errors',
    f'STORY_TIME_RESULTS_BUCKET={bucket} STORY_TIME_RUN_ID={run_id} bash /tmp/tot-story-time-gpu-benchmark.sh',
]
with open(p,'w') as f: json.dump({'commands':commands,'executionTimeout':['1200']},f)
PY
    COMMAND_ID=''
    for retry in 1 2 3; do
      if COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
        --instance-ids "$IID" --parameters "file://$PARAMS" \
        --comment 'Isolated Quillairo GPU narration benchmark' \
        --query Command.CommandId --output text)"; then break; fi
      if [[ "$retry" == 3 ]]; then echo 'SSM submission failed after three attempts.' >&2; exit 1; fi
      sleep 6
    done
    echo "SSM command $COMMAND_ID started. Waiting (up to 20 minutes)..."
    RESULT=Pending
    for _ in $(seq 1 150); do
      RESULT="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
         --query Status --output text 2>/dev/null || echo Pending)"
      case "$RESULT" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
      sleep 8
    done
    echo "SSM status: $RESULT"
    aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$IID" \
      --query '[StandardOutputContent,StandardErrorContent]' --output text || true
    [[ "$RESULT" == Success ]] || { echo 'GPU benchmark failed. Diagnostics remain available in SSM and pilot logs.' >&2; exit 1; }
    echo 'Fetch private audio and CSV with: bash scripts/aws/story-time-gpu-pilot.sh fetch'
    echo 'Compare local results using scripts/aws/story-time-compare-benchmarks.py --cpu CPU.csv --gpu GPU.csv'
    ;;
  fetch)
    require_pilot
    BUCKET="$(output GpuPilotBucket)"
    if [[ "$VARIANT" == budget ]]; then
      DEFAULT_RESULTS_DIR="${HOME:-/tmp}/Downloads/tales-of-two-gpu-budget"
    else
      DEFAULT_RESULTS_DIR="${HOME:-/tmp}/Downloads/tales-of-two-gpu-pilot"
    fi
    DEST="${STORY_TIME_GPU_RESULTS_DIR:-$DEFAULT_RESULTS_DIR}"
    mkdir -p "$DEST"
    aws s3 sync "s3://$BUCKET/results/" "$DEST" --only-show-errors
    echo "Downloaded private GPU MP3 files and benchmark CSVs to: $DEST"
    ;;
  cleanup)
    require_pilot
    BUCKET="$(output GpuPilotBucket)"
    IID="$(pilot_id)"
    echo "This will permanently delete only $STACK, its pilot $IID, S3 results and EBS volume."
    echo 'It will NOT touch the CPU narrator, main cache or backend.'
    if [[ "$VARIANT" == budget ]]; then
      echo 'Type DELETE BUDGET GPU PILOT to confirm:'
      confirmation='DELETE BUDGET GPU PILOT'
    else
      echo 'Type DELETE GPU PILOT to confirm:'
      confirmation='DELETE GPU PILOT'
    fi
    IFS= read -r answer
    [[ "$answer" == "$confirmation" ]] || { echo 'Cancelled'; exit 1; }
    bash "$0" stop
    aws s3 rm "s3://$BUCKET" --recursive --only-show-errors
    aws cloudformation delete-stack --stack-name "$STACK"
    aws cloudformation wait stack-delete-complete --stack-name "$STACK"
    echo 'GPU pilot stack deleted. CPU narrator untouched.'
    ;;
  *)
    echo 'Usage: story-time-gpu-pilot.sh [plan|deploy|status|diagnose|start|stop|repair|runtime-repair|memory-repair|benchmark|fetch|cleanup]' >&2
    exit 2
    ;;
esac
