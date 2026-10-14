#!/usr/bin/env bash
# Pass 61B.11: explicitly approved, existing budget g6f host only (runs via SSM root).
# The earlier nvc:[driver] allocation failures are documented in the pilot log.
set -euo pipefail
exec > >(tee -a /var/log/tot-story-time-gpu-memory-repair.log) 2>&1

IMAGE='ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126'
MARKER='/var/lib/tot-story-time-gpu-budget-repaired'
SYSCTL_FILE='/etc/sysctl.d/91-tot-budget-gpu-overcommit.conf'
OLD_MODE="$(sysctl -n vm.overcommit_memory)"
SUCCESS=0

finish() {
  rc=$?
  if [[ "$SUCCESS" != 1 ]]; then
    echo 'Memory repair failed; restoring original memory-overcommit policy.'
    sysctl -w "vm.overcommit_memory=$OLD_MODE" || true
    rm -f "$SYSCTL_FILE"
    echo 'Relevant kernel messages:'
    journalctl -k -b --no-pager 2>/dev/null | grep -Ei '__vm_enough_memory|nvc:\[driver\]|segfault|out.of.memory|oom|nvrm' | tail -n 16 | cut -c 1-200 || true
    echo 'Docker GPU state:'
    docker ps -a --filter name=story-time-gpu 2>/dev/null || true
  fi
  exit "$rc"
}
trap finish EXIT

echo 'Pass 61B.11: bounded virtual-memory policy experiment on existing budget GPU.'
echo "Original vm.overcommit_memory=$OLD_MODE"
[[ "$OLD_MODE" =~ ^[012]$ ]] || { echo 'Unexpected initial sysctl mode; refusing to continue.' >&2; exit 32; }
[[ ! -e "$SYSCTL_FILE" ]] || { echo 'Overcommit configuration already exists; refusing to overwrite it.' >&2; exit 33; }
command -v docker >/dev/null
command -v nvidia-smi >/dev/null
[[ "$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1 | tr -d '[:space:]')" == 3072 ]] || {
  echo 'This procedure requires a 3072 MiB fractional L4 GPU; refusing other devices.' >&2; exit 34;
}
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo 'GPU Kokoro image is not already cached; refusing a costly fresh pull.' >&2
  exit 35
fi

echo 'Memory before experiment:'
free -m | head -n 3
grep -E '^(MemAvailable|SwapTotal|CommitLimit|Committed_AS):' /proc/meminfo
nvidia-smi --query-gpu=name,memory.total,memory.used,persistence_mode --format=csv,noheader

echo 'Temporarily enabling vm.overcommit_memory=1 (virtual reservations allowed; physical RAM unchanged).'
sysctl -w vm.overcommit_memory=1
[[ "$(sysctl -n vm.overcommit_memory)" == 1 ]] || exit 36

echo 'Testing NVIDIA GPU passthrough in a short-lived container.'
docker run --rm --gpus all --entrypoint nvidia-smi "$IMAGE" \
  --query-gpu=name,memory.total --format=csv,noheader

echo 'GPU passthrough succeeded. Starting Kokoro to verify the HTTP service.'
docker rm -f story-time-gpu >/dev/null 2>&1 || true
docker run -d --name story-time-gpu --restart unless-stopped \
  --gpus all --shm-size=1g --memory=6g --pids-limit=1024 \
  -p 127.0.0.1:8880:8880 -e API_LOG_LEVEL=WARNING \
  "$IMAGE"

READY=0
for i in $(seq 1 120); do
  if curl --silent --show-error --fail --max-time 3 \
    http://127.0.0.1:8880/docs >/dev/null 2>&1; then
    READY=1
    break
  fi
  if [[ "$(docker inspect --format '{{.State.Running}}' story-time-gpu 2>/dev/null || true)" != true ]]; then
    break
  fi
  sleep 2
done
if [[ "$READY" != 1 ]]; then
  echo 'Kokoro container did not become HTTP-ready.' >&2
  docker logs --tail 25 story-time-gpu 2>&1 | cut -c 1-200 || true
  exit 37
fi

# Persistence is conditional on both Docker GPU passthrough and Kokoro readiness.
# This configuration affects ONLY this isolated pilot EC2 host.
echo 'vm.overcommit_memory = 1' > "$SYSCTL_FILE"
touch "$MARKER"
SUCCESS=1
echo 'PASS: fractional L4 Docker GPU smoke test and Kokoro HTTP readiness.'
echo 'Persisted pilot-only overcommit=1 for subsequent benchmark boots.'
echo 'Note: virtual overcommit does not add physical RAM; monitor OOM and cgroup memory.'
