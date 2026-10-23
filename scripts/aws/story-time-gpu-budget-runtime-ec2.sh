#!/usr/bin/env bash
# Pass 61B.9: existing g6f.large only. SSM root script, no cloud formation.
# Do not re-install drivers or change GPU instance configuration.
set -euo pipefail
exec > >(tee -a /var/log/tot-story-time-gpu-runtime-repair.log) 2>&1

IMAGE=ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126
MARKER=/var/lib/tot-story-time-gpu-budget-repaired
RUNTIME_DEBUG=/var/log/tot-nvidia-container-cli.log

summarize_failure() {
  echo '=== NVIDIA runtime failure context ==='
  echo 'Host memory:'; free -m | head -n 3
  echo 'GPU state:'; nvidia-smi --query-gpu=name,memory.total,memory.used,persistence_mode --format=csv,noheader 2>&1 | head -n 4 || true
  echo 'NVIDIA modules:'; lsmod | grep '^nvidia' | head -n 12 || true
  echo 'NVIDIA device nodes:'; ls -l /dev/nvidia* 2>/dev/null | head -n 14 || true
  echo 'Container toolkit recent diagnostics:'; tail -n 24 "$RUNTIME_DEBUG" 2>/dev/null | cut -c 1-190 || true
  echo 'Kernel GPU/memory errors:'
  journalctl -k -b --no-pager 2>/dev/null | grep -Ei 'nvidia|nvrm|xid|oom|out.of.memory|allocation|nvc:|segfault|uvm|vfio' | tail -n 22 | cut -c 1-190 || true
}
trap 'rc=$?; if (( rc != 0 )); then summarize_failure; fi' EXIT

echo 'G6f fractional GPU runtime repair: existing EC2 host; no driver reinstall.'
command -v nvidia-smi >/dev/null
nvidia-smi --query-gpu=name,memory.total,persistence_mode,driver_version --format=csv,noheader
command -v nvidia-container-cli >/dev/null
command -v docker >/dev/null

echo 'Enabling NVIDIA persistence mode before the container runtime test.'
if nvidia-smi -pm 1; then
  PERSISTENCE_OK=1
else
  PERSISTENCE_OK=0
  echo 'WARNING: persistence mode could not be enabled on this fractional GPU; continuing diagnostics.'
fi
modprobe nvidia_uvm || echo 'WARNING: nvidia_uvm could not be loaded; inspect kernel messages.'

# Run the toolkit directly first to isolate an NVML/RPC failure from Docker.
echo '=== Direct NVIDIA container toolkit diagnostic ==='
if nvidia-container-cli -k -d "$RUNTIME_DEBUG" info >/tmp/tot-nvc-output.log 2>&1; then
  echo 'nvidia-container-cli: PASS'
else
  echo 'nvidia-container-cli: FAILED (see detailed driver diagnostics below)'
  tail -n 8 /tmp/tot-nvc-output.log | cut -c 1-190 || true
fi

# Reuse the already pulled Kokoro image; no second GPU image download.
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo 'ERROR: Kokoro image is not cached; refusing a new 3 GB download during runtime repair.' >&2
  exit 27
fi

echo '=== GPU access in a short-lived Docker container ==='
if ! docker run --rm --gpus all --entrypoint nvidia-smi "$IMAGE" \
  --query-gpu=name,memory.total --format=csv,noheader; then
  echo 'ERROR: NVIDIA runtime cannot expose the GPU even to a basic Docker nvidia-smi process.' >&2
  exit 28
fi

echo 'Container GPU access passed; starting the existing local Kokoro service.'
docker rm -f story-time-gpu >/dev/null 2>&1 || true
docker run -d --name story-time-gpu --restart unless-stopped \
  --gpus all --shm-size=1g --memory=6g --pids-limit=1024 \
  -p 127.0.0.1:8880:8880 -e API_LOG_LEVEL=WARNING \
  "$IMAGE"

READY=0
for i in $(seq 1 180); do
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
  echo 'ERROR: GPU container started but the Kokoro HTTP endpoint did not become ready.' >&2
  docker ps -a --filter name=story-time-gpu || true
  docker logs --tail 25 story-time-gpu 2>&1 | cut -c 1-190 || true
  exit 29
fi

# Persist the proven boot-time workaround only when it demonstrably works.
if [[ "$PERSISTENCE_OK" == 1 ]]; then
  cat > /etc/systemd/system/tot-budget-gpu-persistence.service <<'UNIT'
[Unit]
Description=Quillairo budget GPU persistence before Docker
After=systemd-udevd.service
Before=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/nvidia-smi -pm 1
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable tot-budget-gpu-persistence.service
  echo 'Installed boot-time GPU persistence service for future EC2 starts.'
fi
# Success marker retained for a host originally marked as cloud-init failed.
touch "$MARKER"
echo 'SUCCESS: G6f NVIDIA runtime, Docker GPU smoke test, and Kokoro HTTP readiness passed.'
