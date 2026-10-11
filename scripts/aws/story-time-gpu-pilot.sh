#!/usr/bin/env bash
# Isolated GPU pilot only: never changes existing CPU narrator or backend.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export AWS_PROFILE="${AWS_PROFILE:-adventure-staging}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="$AWS_REGION"
STACK='AdventurePlatformNarratorGpuPilot-staging'
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
    AMI="$(aws ssm get-parameter \
      --name '/aws/service/ecs/optimized-ami/amazon-linux-2023/gpu/recommended/image_id' \
      --query Parameter.Value --output text)"
    [[ "$AMI" == ami-* ]] || { echo 'GPU-optimized AL2023 AMI lookup failed.' >&2; exit 2; }
    echo "Pilot instance: ${STORY_TIME_GPU_TYPE:-g4dn.xlarge} | Existing VPC: $VPC | Subnet: $SUBNET | GPU AMI: $AMI"
    echo 'The CPU narrator and game backend will not be modified.'
    echo 'Type CREATE GPU PILOT to accept billable resources and a 2-hour automatic stop:'
    IFS= read -r answer
    [[ "$answer" == 'CREATE GPU PILOT' ]] || { echo 'Cancelled.'; exit 1; }
    aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" \
      --capabilities CAPABILITY_IAM \
      --parameter-overrides \
        "VpcId=$VPC" "SubnetId=$SUBNET" "GpuAmiId=$AMI" \
        "InstanceType=${STORY_TIME_GPU_TYPE:-g4dn.xlarge}" "HardStopSeconds=7200" \
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
  start)
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
       --query 'Reservations[0].Instances[0].State.Name' --output text)"
    if [[ "$STATE" == running ]]; then
      echo 'GPU pilot already running; hard stop still counts from its launch time.'
    elif [[ "$STATE" == stopped ]]; then
      echo 'Starting GPU pilot. The 120-minute hard-stop clock resets on EC2 start.'
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
  benchmark)
    require_pilot
    IID="$(pilot_id)"
    STATE="$(aws ec2 describe-instances --instance-ids "$IID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text)"
    [[ "$STATE" == running ]] || { echo "GPU pilot is $STATE. Start it explicitly with: bash $0 start" >&2; exit 2; }
    BUCKET="$(output GpuPilotBucket)"
    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
    echo "GPU pilot: $IID, result prefix: s3://$BUCKET/results/$RUN_ID/"
    echo 'Three unique generation tests; A/B MP3 files uploaded privately to S3.'
    printf 'Run now? [y/N] '
    read -r answer
    [[ "$answer" == y || "$answer" == Y ]] || exit 0
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-gpu-benchmark-ec2.sh" \
      "s3://$BUCKET/scripts/benchmark.sh" --only-show-errors
    aws s3 cp "$ROOT_DIR/scripts/aws/story-time-mp3-duration.py" \
      "s3://$BUCKET/scripts/mp3-duration.py" --only-show-errors
    PARAMS="$(mktemp "${TMPDIR:-/tmp}/tot-gpu-ssm.XXXXXXXX.json")"
    trap 'rm -f "$PARAMS"' EXIT
    python3 - "$PARAMS" "$BUCKET" "$RUN_ID" "$AWS_REGION" <<'PY'
import json,sys
p,bucket,run_id,region=sys.argv[1:]
commands=[
    'set -e',
    f'export AWS_DEFAULT_REGION={region}',
    f'aws s3 cp s3://{bucket}/scripts/benchmark.sh /tmp/tot-story-time-gpu-benchmark.sh --only-show-errors',
    f'aws s3 cp s3://{bucket}/scripts/mp3-duration.py /tmp/story-time-mp3-duration.py --only-show-errors',
    f'STORY_TIME_RESULTS_BUCKET={bucket} STORY_TIME_RUN_ID={run_id} bash /tmp/tot-story-time-gpu-benchmark.sh',
]
with open(p,'w') as f: json.dump({'commands':commands,'executionTimeout':['1200']},f)
PY
    COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
      --instance-ids "$IID" --parameters "file://$PARAMS" \
      --comment 'Isolated Tales of Two GPU narration benchmark' \
      --query Command.CommandId --output text)"
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
    echo 'Stopping the GPU pilot now to avoid idle compute charges.'
    bash "$0" stop || true
    [[ "$RESULT" == Success ]] || { echo 'GPU benchmark failed. Diagnostics remain available in SSM and pilot logs.' >&2; exit 1; }
    echo 'Fetch private audio and CSV with: bash scripts/aws/story-time-gpu-pilot.sh fetch'
    ;;
  fetch)
    require_pilot
    BUCKET="$(output GpuPilotBucket)"
    DEST="${STORY_TIME_GPU_RESULTS_DIR:-${HOME:-/tmp}/Downloads/tales-of-two-gpu-pilot}"
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
    echo 'Type DELETE GPU PILOT to confirm:'
    IFS= read -r answer
    [[ "$answer" == 'DELETE GPU PILOT' ]] || { echo 'Cancelled'; exit 1; }
    bash "$0" stop
    aws s3 rm "s3://$BUCKET" --recursive --only-show-errors
    aws cloudformation delete-stack --stack-name "$STACK"
    aws cloudformation wait stack-delete-complete --stack-name "$STACK"
    echo 'GPU pilot stack deleted. CPU narrator untouched.'
    ;;
  *)
    echo 'Usage: story-time-gpu-pilot.sh [plan|deploy|status|start|stop|benchmark|fetch|cleanup]' >&2
    exit 2
    ;;
esac
