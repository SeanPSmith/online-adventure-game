#!/usr/bin/env bash
# SSM-only GPU benchmark. Results/audio go to the isolated GPU pilot bucket.
set -euo pipefail
: "${STORY_TIME_RESULTS_BUCKET:?Missing pilot artifact bucket}"
: "${STORY_TIME_RUN_ID:?Missing benchmark run ID}"
[[ "$STORY_TIME_RUN_ID" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid run ID' >&2; exit 2; }

NAME=story-time-gpu
URL=http://127.0.0.1:8880/v1/audio/speech
DEST="${TMPDIR:-/tmp}/tot-gpu-benchmark-${STORY_TIME_RUN_ID}"
mkdir -p "$DEST"
chmod 700 "$DEST"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DURATION_TOOL="$SCRIPT_DIR/story-time-mp3-duration.py"
command -v aws >/dev/null || { echo 'AWS CLI missing on pilot host' >&2; exit 2; }
command -v nvidia-smi >/dev/null || { echo 'NVIDIA driver missing on pilot host' >&2; exit 2; }
command -v python3 >/dev/null || { echo 'Python 3 missing on pilot host' >&2; exit 2; }
[[ -f "$DURATION_TOOL" ]] || { echo 'MP3 duration helper missing' >&2; exit 2; }

echo 'STORY TIME // ISOLATED GPU BENCHMARK (NO BACKEND CHANGES)'
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
echo "Container: $NAME | Results: s3://${STORY_TIME_RESULTS_BUCKET}/results/${STORY_TIME_RUN_ID}/"
echo "Started UTC: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo 'Waiting for GPU Kokoro to become ready (up to 10 minutes)...'
ready=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:8880/v1/audio/voices >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 10
done
if [[ "$ready" != 1 ]]; then
  echo 'Kokoro is not ready. Diagnostics:' >&2
  sudo docker ps -a || true
  sudo docker logs --tail 80 "$NAME" || true
  tail -n 60 /var/log/tot-story-time-gpu-setup.log || true
  exit 2
fi
sudo docker inspect --format 'Image={{.Config.Image}} Status={{.State.Status}}' "$NAME"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
printf 'id,voice,input_chars,wall_seconds,audio_seconds,real_time_factor,http_status,output_bytes\n' > "$DEST/results.csv"

run_sample() {
  local id="$1" voice="$2" message="$3"
  local input="$DEST/$id.json" output="$DEST/$id.mp3" stats_pid code wall bytes duration rtf
  python3 - "$voice" "$message" > "$input" <<'PY'
import json, sys
print(json.dumps({"model":"kokoro", "voice":sys.argv[1], "input":sys.argv[2], "response_format":"mp3", "speed":1.0}))
PY
  echo "--- $id ($voice, ${#message} characters) ---"
  # Sample actual GPU activity during synthesis (not after). No parallel synthesis.
  (
    while true; do
      nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits 2>/dev/null || true
      sleep 1
    done
  ) > "$DEST/$id.gpu.csv" &
  stats_pid=$!
  if ! curl --fail-with-body -sS --max-time 480 \
    -H 'Content-Type: application/json' \
    --data-binary "@$input" \
    -o "$output" \
    -w '%{http_code} %{time_total} %{size_download}\n' "$URL" > "$DEST/$id.http.txt"; then
    kill "$stats_pid" 2>/dev/null || true
    wait "$stats_pid" 2>/dev/null || true
    echo "Failed to synthesize $id. Check Kokoro logs." >&2
    cat "$output" 2>/dev/null | head -c 400 >&2 || true
    exit 1
  fi
  kill "$stats_pid" 2>/dev/null || true
  wait "$stats_pid" 2>/dev/null || true
  read -r code wall bytes < "$DEST/$id.http.txt"
  duration="$(python3 "$DURATION_TOOL" "$output")"
  rtf="$(python3 - "$duration" "$wall" <<'PY'
import sys
print(f'{float(sys.argv[1])/float(sys.argv[2]):.3f}')
PY
)"
  echo "HTTP $code | wall ${wall}s | audio ${duration}s | throughput ${rtf}x real-time | bytes $bytes"
  sudo docker stats --no-stream "$NAME" || true
  echo 'Sampled GPU (utilization %, VRAM MiB), first and peak:'
  head -n 1 "$DEST/$id.gpu.csv" || true
  python3 - "$DEST/$id.gpu.csv" <<'PY'
import sys
samples=[]
for line in open(sys.argv[1]):
    try: samples.append([int(x.strip()) for x in line.split(',')])
    except ValueError: pass
if samples:
    print('peak_gpu_pct=', max(s[0] for s in samples), 'peak_vram_MiB=', max(s[1] for s in samples))
PY
  printf '%s,%s,%s,%s,%s,%s,%s,%s\n' "$id" "$voice" "${#message}" "$wall" "$duration" "$rtf" "$code" "$bytes" >> "$DEST/results.csv"
}

run_sample michael_short am_michael \
  'Welcome to Tales of Two. In the shadows of the castle, the adventure begins.'
run_sample bella_short af_bella \
  'Welcome to Tales of Two. In the shadows of the castle, the adventure begins.'
run_sample michael_long am_michael \
  'The ancient lantern flickered as the travelers entered the ruined observatory. On the far wall, a silver constellation moved against the stone, tracing a path beyond the mountains. A soft voice echoed from the empty gallery above. Nobody could see who was speaking, but the words were unmistakable. The road ahead would demand courage, patience, and the willingness to trust a stranger. One traveler took a careful step forward. The other followed, and together they listened as the hidden machinery began to wake.'

echo '--- COMPLETE RESULTS ---'
cat "$DEST/results.csv"
# Private pilot bucket; short retention, no production S3 cache contamination.
aws s3 cp "$DEST/" "s3://${STORY_TIME_RESULTS_BUCKET}/results/${STORY_TIME_RUN_ID}/" \
  --recursive --only-show-errors

echo "Download A/B audio and CSV: bash scripts/aws/story-time-gpu-pilot.sh fetch"
echo "Uploaded to s3://${STORY_TIME_RESULTS_BUCKET}/results/${STORY_TIME_RUN_ID}/"
