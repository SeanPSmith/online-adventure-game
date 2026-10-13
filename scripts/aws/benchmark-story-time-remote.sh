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
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
LOCAL_DIR="${STORY_TIME_CPU_RESULTS_DIR:-${HOME:-/tmp}/Downloads/tales-of-two-benchmarks/cpu/$RUN_ID}"
PARAMS_FILE="$(mktemp "${TMPDIR:-/tmp}/story-time-ssm.XXXXXX.json")"
SSM_OUTPUT="$(mktemp "${TMPDIR:-/tmp}/story-time-ssm-output.XXXXXX.txt")"
trap 'rm -f "$PARAMS_FILE" "$SSM_OUTPUT"' EXIT
python3 - "$ROOT_DIR/scripts/aws/benchmark-story-time-ec2.sh" \
  "$ROOT_DIR/scripts/aws/story-time-mp3-duration.py" "$PARAMS_FILE" "$RUN_ID" <<'PY'
import base64, json, sys
script_path, duration_path, params_path, run_id = sys.argv[1:]
def load64(path):
    with open(path, 'rb') as source:
        return base64.b64encode(source.read()).decode('ascii')
benchmark = load64(script_path)
duration = load64(duration_path)
bench_dir = '/tmp/tot-story-time-benchmark-' + run_id
commands = [
    'set -e',
    "umask 077; printf '%s' '" + benchmark + "' | base64 -d >/tmp/tot-story-time-benchmark.sh",
    "umask 077; printf '%s' '" + duration + "' | base64 -d >/tmp/story-time-mp3-duration.py",
    'STORY_TIME_BENCH_DIR=' + bench_dir + ' STORY_TIME_MP3_DURATION_HELPER=/tmp/story-time-mp3-duration.py bash /tmp/tot-story-time-benchmark.sh',
    "printf '\n__TOT_CPU_RESULTS_BEGIN__\n'",
    'cat ' + bench_dir + '/results.csv',
    "printf '__TOT_CPU_RESULTS_END__\n'",
    'rm -f /tmp/tot-story-time-benchmark.sh /tmp/story-time-mp3-duration.py',
]
with open(params_path, 'w', encoding='utf-8') as out:
    json.dump({'commands': commands, 'executionTimeout': ['900']}, out)
PY
COMMAND_ID="$(aws ssm send-command --document-name AWS-RunShellScript \
  --instance-ids "$INSTANCE_ID" --parameters "file://$PARAMS_FILE" \
  --comment 'Tales of Two Story Time inference baseline only' \
  --profile "$PROFILE" --region "$REGION" --query Command.CommandId --output text)"
echo "SSM command $COMMAND_ID submitted. Waiting for inference tests..."
STATUS='Pending'
for _ in $(seq 1 90); do
  STATUS="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
     --profile "$PROFILE" --region "$REGION" --query 'Status' --output text 2>/dev/null || echo 'Pending')"
  case "$STATUS" in Success|Failed|Cancelled|TimedOut|Cancelling) break;; esac
  sleep 8
done
echo "SSM status: $STATUS"
aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --profile "$PROFILE" --region "$REGION" --query 'StandardOutputContent' --output text > "$SSM_OUTPUT" || true
cat "$SSM_OUTPUT"
if [[ "$STATUS" != Success ]]; then
  aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
    --profile "$PROFILE" --region "$REGION" --query 'StandardErrorContent' --output text || true
  echo 'Benchmark did not complete successfully. See SSM details above.' >&2
  exit 1
fi
# Save only fixed benchmark metadata, never SSM logs or narrator credentials.
mkdir -p "$LOCAL_DIR"
python3 - "$SSM_OUTPUT" "$LOCAL_DIR/results.csv" <<'PY'
import csv
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text(encoding='utf-8')
begin, end = '__TOT_CPU_RESULTS_BEGIN__', '__TOT_CPU_RESULTS_END__'
if source.count(begin) != 1 or source.count(end) != 1:
    raise SystemExit('ERROR: SSM output is incomplete/truncated: CPU results were NOT saved.')
contents = source.split(begin, 1)[1].split(end, 1)[0].strip() + '\n'
rows = list(csv.DictReader(contents.splitlines()))
expected = {'michael_short', 'bella_short', 'michael_long'}
if len(rows) != 3 or {row.get('id') for row in rows} != expected:
    raise SystemExit('ERROR: CPU results.csv did not contain the three benchmark samples.')
Path(sys.argv[2]).write_text(contents, encoding='utf-8')
PY
echo "CPU CSV saved: $LOCAL_DIR/results.csv"
echo 'When finished, stop CPU EC2 from your Mac: bash scripts/aws/story-time-control.sh stop'
