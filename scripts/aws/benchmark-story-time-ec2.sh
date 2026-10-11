#!/usr/bin/env bash
# Baseline the existing Kokoro service inside an AWS SSM terminal.
# No AWS changes, model pulls, service restarts, or instance resizing.
set -euo pipefail

CONTAINER="${STORY_TIME_CONTAINER:-story-time}"
ENDPOINT="${STORY_TIME_BENCH_ENDPOINT:-http://127.0.0.1:8880/v1/audio/speech}"
DEST="${STORY_TIME_BENCH_DIR:-${TMPDIR:-/tmp}/story-time-bench-$(date +%Y%m%d-%H%M%S)}"
DOCKER=(sudo docker)
command -v curl >/dev/null || { echo 'curl is required' >&2; exit 2; }
"${DOCKER[@]}" inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -qx true || {
  echo "Container '$CONTAINER' is not running. Start EC2 and let Kokoro initialize first." >&2
  exit 2
}
# Restrict to EC2 loopback by default; operators can override for local variants.
mkdir -p "$DEST"
chmod 700 "$DEST"
echo 'STORY TIME // INFERENCE BENCHMARK'
echo "Container: $CONTAINER"
echo "Endpoint: $ENDPOINT"
echo "Results: $DEST"
echo 'IMPORTANT: start a 90-minute maintenance hold from your Mac before running this benchmark.'
echo "Started UTC: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo '--- System ---'
uptime
free -h
"${DOCKER[@]}" stats --no-stream "$CONTAINER"
echo '---'

run_sample() {
  local id="$1" voice="$2" message="$3" inputfile outputfile http_code elapsed bytes
  inputfile="$DEST/$id.json"
  outputfile="$DEST/$id.mp3"
  python3 - "$voice" "$message" > "$inputfile" <<'PY'
import json, sys
print(json.dumps({"model": "kokoro", "voice": sys.argv[1], "input": sys.argv[2], "response_format": "mp3", "speed": 1.0}))
PY
  echo "Benchmarking $id ($voice), $(printf '%s' "$message" | wc -c | tr -d ' ') input bytes..."
  # Light resource sampling once during generation, not an additional inference request.
  (sleep 5; "${DOCKER[@]}" stats --no-stream "$CONTAINER" > "$DEST/$id.resources.txt" 2>&1 || true) &
  local stats_pid=$!
  if ! curl -fsS --max-time 240 \
      -H 'Content-Type: application/json' -H 'Accept: audio/mpeg' \
      --data-binary "@$inputfile" \
      -w '%{http_code} %{time_total} %{size_download}\n' \
      -o "$outputfile" "$ENDPOINT" > "$DEST/$id.metrics.txt"; then
    wait "$stats_pid" || true
    echo "Request $id failed. Check: sudo docker logs --tail 80 $CONTAINER" >&2
    return 1
  fi
  wait "$stats_pid" || true
  read -r http_code elapsed bytes < "$DEST/$id.metrics.txt"
  local reported="n/a"
  if command -v ffprobe >/dev/null 2>&1; then
    reported="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$outputfile" 2>/dev/null || echo 'n/a')"
  fi
  echo "  HTTP $http_code | wall ${elapsed}s | audio ${reported}s | bytes $bytes"
  cat "$DEST/$id.resources.txt"
  if command -v file >/dev/null 2>&1; then file "$outputfile"; fi
  printf '%s,%s,%s,%s,%s,%s\n' "$id" "$voice" "${#message}" "$elapsed" "$reported" "$bytes" >> "$DEST/results.csv"
}
printf 'id,voice,input_chars,wall_seconds,audio_seconds,output_bytes\n' > "$DEST/results.csv"
run_sample 'michael_short' 'am_michael' \
  'Welcome to Tales of Two. In the shadows of the castle, the adventure begins.'
run_sample 'bella_short' 'af_bella' \
  'Welcome to Tales of Two. In the shadows of the castle, the adventure begins.'
run_sample 'michael_long' 'am_michael' \
  'The ancient lantern flickered as the travelers entered the ruined observatory. On the far wall, a silver constellation moved against the stone, tracing a path beyond the mountains. A soft voice echoed from the empty gallery above. Nobody could see who was speaking, but the words were unmistakable. The road ahead would demand courage, patience, and the willingness to trust a stranger. One traveler took a careful step forward. The other followed, and together they listened as the hidden machinery began to wake.'
echo '---'
echo "Saved results to $DEST/results.csv"
echo 'Do not infer real-time factor from MP3 bytes alone; use audio_seconds when ffprobe is present.'
echo 'For cost/performance analysis, also collect EC2 CPUCreditBalance/CPUSurplusCreditsCharged and instance type in CloudWatch.'
