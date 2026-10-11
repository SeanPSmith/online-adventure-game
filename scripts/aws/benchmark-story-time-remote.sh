#!/usr/bin/env bash
# Submit the self-contained EC2 benchmark through Systems Manager; no SSH or EC2 image changes.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-adventure-staging}"
REGION="${AWS_REGION:-us-east-1}"
STACK='AdventurePlatformNarrator-staging'
"$ROOT_DIR/scripts/aws/check-aws.sh"
INSTANCE_ID="$(aws cloudformation describe-stacks --stack-name "$STACK" --profile "$PROFILE" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='NarratorInstanceId'].OutputValue | [0]" --output text)"
if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == None ]]; then
  echo 'The narrator stack has no deployed instance. Nothing executed.' >&2
  exit 1
fi
STATE="$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --profile "$PROFILE" --region "$REGION" \
  --query 'Reservations[0].Instances[0].State.Name' --output text)"
if [[ "$STATE" != running ]]; then
  echo "Narrator is $STATE. From your Mac, first run: bash scripts/aws/story-time-control.sh start 90" >&2
  exit 2
fi
cat <<INFO
Story Time benchmark via SSM
  Instance: $INSTANCE_ID ($STATE)
  AWS profile: $PROFILE / $REGION
  The benchmark runs three text samples and collects light Docker stats.
  Confirm a maintenance hold is active or the idle watchdog may stop EC2.
  No other EC2 instances, Docker images or model settings will be altered.
INFO
printf 'Run the on-instance narration benchmark now? [y/N] '
read -r answer
[[ "$answer" == y || "$answer" == Y ]] || { echo 'Cancelled.'; exit 0; }
PARAMS_FILE="$(mktemp "${TMPDIR:-/tmp}/story-time-ssm.XXXXXX.json")"
trap 'rm -f "$PARAMS_FILE"' EXIT
python3 - "$ROOT_DIR/scripts/aws/benchmark-story-time-ec2.sh" "$PARAMS_FILE" <<'PY'
import base64, json, sys
script=open(sys.argv[1], 'rb').read()
encoded=base64.b64encode(script).decode('ascii')
commands=[
    "set -e",
    "umask 077; printf '%s' '"+encoded+"' | base64 -d >/tmp/tot-story-time-benchmark.sh",
    "bash /tmp/tot-story-time-benchmark.sh",
    "rm -f /tmp/tot-story-time-benchmark.sh",
]
with open(sys.argv[2], 'w', encoding='utf-8') as out:
    json.dump({'commands': commands, 'executionTimeout': ['900']},out)
PY
COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
  --instance-ids "$INSTANCE_ID" --parameters "file://$PARAMS_FILE" \
  --comment 'Tales of Two Story Time inference baseline only' \
  --profile "$PROFILE" --region "$REGION" --query 'Command.CommandId' --output text)"
echo "SSM command $COMMAND_ID submitted. Waiting for inference tests (up to ~12 minutes)..."
STATUS='Pending'
for _ in $(seq 1 90); do
  STATUS="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
     --profile "$PROFILE" --region "$REGION" --query 'Status' --output text 2>/dev/null || echo 'Pending')"
  case "$STATUS" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
  sleep 8
done
echo "SSM status: $STATUS"
aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --profile "$PROFILE" --region "$REGION" --query '[StandardOutputContent,StandardErrorContent]' --output text || true
[[ "$STATUS" == Success ]] || { echo 'Benchmark did not complete successfully. See SSM command details above.' >&2; exit 1; }
echo 'When finished, stop EC2 from your Mac: bash scripts/aws/story-time-control.sh stop'
