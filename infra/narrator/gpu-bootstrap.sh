# GPU-only AL2023 bootstrap. Included by CDK UserData (which supplies #!/bin/bash).
# New stack ONLY; preserves the separately deployed CPU narrator and pilot.
set -euxo pipefail
exec > >(tee -a /var/log/tot-story-time-gpu-setup.log) 2>&1
RUNNING_KERNEL="$(uname -r)"
case "$RUNNING_KERNEL" in
  6.1.*)  KERNEL_DEV="kernel-devel-$RUNNING_KERNEL"; KERNEL_EXTRA="kernel-modules-extra-$RUNNING_KERNEL" ;;
  6.12.*) KERNEL_DEV="kernel6.12-devel-$RUNNING_KERNEL"; KERNEL_EXTRA="kernel6.12-modules-extra-$RUNNING_KERNEL" ;;
  6.18.*) KERNEL_DEV="kernel6.18-devel-$RUNNING_KERNEL"; KERNEL_EXTRA="kernel6.18-modules-extra-$RUNNING_KERNEL" ;;
  *) echo "Unsupported AWS GRID kernel: $RUNNING_KERNEL" >&2; exit 12 ;;
esac
# Important: do not request full curl; AL2023 has conflicting curl-minimal.
dnf install -y docker awscli-2 gcc make perl pciutils elfutils-libelf-devel \
  libglvnd-devel "$KERNEL_DEV" "$KERNEL_EXTRA"
modprobe drm
systemctl enable --now docker
systemctl enable --now amazon-ssm-agent || true
# The 3 GB fractional GPU exposes an NVIDIA container toolkit memory-commit
# issue; the successful benchmark required Linux overcommit mode 1.
echo 'vm.overcommit_memory = 1' > /etc/sysctl.d/98-tot-gpu.conf
sysctl -p /etc/sysctl.d/98-tot-gpu.conf
aws s3 cp s3://ec2-linux-nvidia-drivers/grid-19.5/NVIDIA-Linux-x86_64-580.159.03-grid-aws.run /tmp/tot-grid.run
chmod 700 /tmp/tot-grid.run
sh /tmp/tot-grid.run --silent --accept-license --no-questions --kernel-module-type=proprietary
modprobe nvidia
nvidia-smi
nvidia-smi -pm 1
if command -v nvidia-persistenced >/dev/null 2>&1; then
  systemctl enable --now nvidia-persistenced || true
fi
curl -fsSL https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo \
  -o /etc/yum.repos.d/nvidia-container-toolkit.repo
dnf install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
# Probe GPU passthrough BEFORE attempting to start Kokoro.
nvidia-container-cli info
docker pull ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126
docker rm -f story-time-gpu 2>/dev/null || true
# Managed by systemd so every subsequent wake enables persistence first.
docker create --name story-time-gpu --gpus all --shm-size=1g --memory=6g \
  --pids-limit=1024 -p 8880:8880 -e API_LOG_LEVEL=WARNING \
  ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126
cat > /etc/systemd/system/tot-story-time-gpu.service <<'UNIT'
[Unit]
Description=Tales of Two Kokoro G6f narrator
After=docker.service network-online.target nvidia-persistenced.service
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/usr/bin/nvidia-smi -pm 1
ExecStart=/usr/bin/docker start story-time-gpu
ExecStop=/usr/bin/docker stop -t 45 story-time-gpu
TimeoutStartSec=180
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now tot-story-time-gpu.service
# Fail cloud-init if driver/container startup fails; watchdog still stops
# the instance when there are no authenticated listeners or pending jobs.
docker inspect -f '{{.State.Running}}' story-time-gpu | grep -qx true
echo 'GPU narrator bootstrap complete. Await verified health before cutover.'
