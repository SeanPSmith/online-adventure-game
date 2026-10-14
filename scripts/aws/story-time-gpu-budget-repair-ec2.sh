#!/usr/bin/env bash
# Recovery ONLY for the isolated g6f.large budget benchmark host.
# Executed as root through AWS SSM with explicit operator confirmation.
set -euo pipefail
exec > >(tee -a /var/log/tot-story-time-gpu-repair.log) 2>&1

marker=/var/lib/tot-story-time-gpu-budget-repaired
rm -f "$marker"
RUNNING_KERNEL="$(uname -r)"
case "$RUNNING_KERNEL" in
  6.1.*)  KERNEL_EXTRA_PKG="kernel-modules-extra-$RUNNING_KERNEL" ;;
  6.12.*) KERNEL_EXTRA_PKG="kernel6.12-modules-extra-$RUNNING_KERNEL" ;;
  6.18.*) KERNEL_EXTRA_PKG="kernel6.18-modules-extra-$RUNNING_KERNEL" ;;
  *) echo "ERROR: Unsupported Amazon Linux 2023 kernel: $RUNNING_KERNEL" >&2; exit 17 ;;
esac

echo "Installing missing DRM/GEM runtime modules: $KERNEL_EXTRA_PKG"
dnf install -y "$KERNEL_EXTRA_PKG"
modprobe drm
# Test that the missing DRM module is actually installed, not merely named in headers.
lsmod | grep -q '^drm ' || { echo 'ERROR: drm module did not load' >&2; exit 18; }

if ! nvidia-smi >/dev/null 2>&1; then
  # Failed cloud-init may have left the driver installer in /tmp; fetch afresh
  # from AWS's licensed GRID-driver bucket if it is unavailable after reboot.
  GRID_RUN=/tmp/tot-grid-driver.run
  if [[ ! -s "$GRID_RUN" ]]; then
    aws s3 ls s3://ec2-linux-nvidia-drivers/ --recursive > /tmp/tot-grid-object-list.txt
    GRID_KEY="$(awk '$4 ~ /(^|\/)NVIDIA-Linux-x86_64-580\.159\.03([-.][a-zA-Z0-9_-]+)?\.run$/ {print $4; exit}' /tmp/tot-grid-object-list.txt)"
    if [[ -z "$GRID_KEY" ]]; then
      GRID_KEY="$(awk '$4 ~ /(^|\/)NVIDIA-Linux-x86_64-580\.126\.09([-.][a-zA-Z0-9_-]+)?\.run$/ {print $4; exit}' /tmp/tot-grid-object-list.txt)"
    fi
    [[ -n "$GRID_KEY" ]] || { echo 'ERROR: No pinned AWS GRID 19.5/19.4 driver' >&2; exit 19; }
    aws s3 cp "s3://ec2-linux-nvidia-drivers/$GRID_KEY" "$GRID_RUN" --only-show-errors
  fi
  echo 'Retrying AWS GRID driver with DRM module present'
  sh "$GRID_RUN" --silent --accept-license --no-questions --kernel-module-type=proprietary
fi
modprobe nvidia
nvidia-smi

# Complete the first-boot steps that cloud-init skipped after its failure.
systemctl enable --now docker
command -v curl >/dev/null 2>&1 || { echo 'ERROR: curl-minimal is missing' >&2; exit 20; }
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo \
  -o /etc/yum.repos.d/nvidia-container-toolkit.repo
dnf install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
docker pull ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126
docker rm -f story-time-gpu 2>/dev/null || true
docker run -d --name story-time-gpu --restart unless-stopped \
  --gpus all --shm-size=1g --memory=6g --pids-limit=1024 \
  -p 127.0.0.1:8880:8880 -e API_LOG_LEVEL=WARNING \
  ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126
[[ "$(docker inspect --format '{{.State.Running}}' story-time-gpu)" == true ]] || {
  echo 'ERROR: GPU Kokoro did not start' >&2; exit 21;
}
# Only a completely healthy GPU/container can override the original failed
# cloud-init status for the existing benchmark instance.
touch "$marker"
echo 'SUCCESS: Budget GPU host repaired; GRID driver and Kokoro container running.'
