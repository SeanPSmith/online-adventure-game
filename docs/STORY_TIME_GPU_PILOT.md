### Pass 61B.11 — Targeted G6f virtual-memory policy test (NO new EC2)

Latest diagnostics confirm NVIDIA driver 580.159.03 and the L4-3Q GPU are
functional, but the `nvc:[driver]` container helper was refused virtual
memory reservations under `vm.overcommit_memory=0`. Its segfault followed
three `__vm_enough_memory` failures. Linux reported 7.1 GB available RAM,
3.9 GB default commit limit, and no swap. This is a **virtual-address
reservation** bottleneck, not evidence the GPU needs 8 GB of physical VRAM.
NVIDIA container toolkit issue #1324 describes a nearly identical failure.

The isolated budget pilot now exposes `memory-repair`: on the **existing,
stopped g6f.large only**, with an exact typed confirmation, it starts EC2,
temporarily sets `vm.overcommit_memory=1`, checks Docker GPU passthrough, and
starts Kokoro. **On failure, it restores the original policy and does not
run a benchmark.** Only after the GPU smoke test and Kokoro HTTP readiness
both pass does it persist `/etc/sysctl.d/91-tot-budget-gpu-overcommit.conf`
for future reboot/benchmark; the CPU narrator and T4 pilot are never touched.
The command requests an EC2 stop on every completion path, in addition to the
30-minute watchdog. Physical RAM is not increased: Linux can still OOM-kill
processes if actual allocations exceed capacity.

Operators, after installing Pass 61B.11:

```bash
bash scripts/aws/story-time-gpu-budget.sh status
bash scripts/aws/story-time-gpu-budget.sh memory-repair
# type: TEST GPU MEMORY OVERCOMMIT
# on success, wait until EC2 is stopped:
bash scripts/aws/story-time-gpu-budget.sh start
bash scripts/aws/story-time-gpu-budget.sh benchmark
bash scripts/aws/story-time-gpu-budget.sh fetch
bash scripts/aws/story-time-gpu-budget.sh status
```

No CPU/T4 migration or production cutover is implied. A successful HTTP
readiness test is not yet proof of healthy text-to-speech inference or audio
quality. Clean up the isolated pilot after obtaining and verifying its A/B
MP3 artifacts.

### Pass 61B.10 — Runtime RPC/memory diagnostics before any further repair

The existing g6f.large now loads GRID and `nvidia-smi` reports the L4-3Q 3 GB
slice, but NVIDIA's Docker hook still fails with `driver rpc error: failed to
process request: unknown` **after persistence mode was enabled**. This does not
prove a persistence problem; host RAM usage alone does not establish Linux
virtual-memory commitment limits either. NVIDIA container-toolkit reports on
other small hosts show similar errors when `nvc:[driver]` requests more virtual
memory than the host allows; that cause remains UNCONFIRMED for this EC2 host.

The read-only `diagnose` command now prioritizes the *saved* runtime repair log,
NVIDIA CLI debug log, kernel allocation/segfault/OOM messages from current and
previous boot, and `vm.overcommit_memory` / `/proc/meminfo`. These appear before
the old GRID installer messages so they aren't truncated by AWS SSM's inline
output cap. `diagnose` never starts EC2, changes sysctls, downloads images or
runs a container. Because the pilot is stopped, host logs need **one explicit,
billable start of the existing instance**, followed by a diagnosed SSM Online
state and an automatic stop request; no new stack or driver reinstall.

Do not set `vm.overcommit_memory=1`, add swap, or persist a sysctl until the
`nvc:[driver]` kernel logs actually establish a memory-commit failure. Do not
start another benchmark until GPU passthrough smoke testing succeeds.

### Pass 61B.8 — DRM/GEM kernel modules needed by GRID on AL2023

Confirmed in failed g6f.large installer output: `nvidia.ko` compilation succeeds, then module loading fails with `Unknown symbol drm_gem_object_free (err -2)`. AL2023 packages DRM/GEM in `kernel-modules-extra-$(uname -r)` for our pinned kernel. The G6f user-data now installs that version-matched package before GRID and loads `drm`; 6.12 and 6.18 naming are also supported for future operator consistency. The first-boot CloudFormation change **does not retroactively fix the existing stopped instance**.

To avoid another CloudFormation redeployment, after applying this overlay run:

```bash
bash scripts/aws/story-time-gpu-budget.sh status
bash scripts/aws/story-time-gpu-budget.sh repair
# Requires typing REPAIR BUDGET GPU PILOT. Starts existing billable EC2,
# uses SSM to finish driver/Docker provisioning, requests stop on exit.
bash scripts/aws/story-time-gpu-budget.sh status
# Once repair succeeds and EC2 is fully stopped:
bash scripts/aws/story-time-gpu-budget.sh start
bash scripts/aws/story-time-gpu-budget.sh benchmark
bash scripts/aws/story-time-gpu-budget.sh fetch
bash scripts/aws/story-time-gpu-budget.sh status
```

Check that status is `stopped` after each run; the repair and benchmark both request shutdown, and the 30-minute watchdog remains the safety fallback. Never skip the audio quality A/B checks. Repair is restricted to `g6f.large`, does not target CPU narrator or T4, and may fail for another AWS-specific reason; no real repair has yet been performed.

### Pass 61B.7 — NVIDIA `nvidia.ko` failure: capture the missing log

The fractional L4 driver installer reached the module-load step and failed with
`Unable to load the kernel module 'nvidia.ko'`. Do not assume nouveau, a kernel
mismatch or a specific G6f incompatibility without the installer evidence.
Previously `diagnose` printed hundreds of DNF package lines; SSM's inline
24,000-character stdout limit cut off `/var/log/nvidia-installer.log`.
The fixed `diagnose` displays compact installer error context first, then
kernel messages (including previous boot when available) and hardware facts.
It is read-only: running it does **not** start or stop EC2. When EC2 is stopped,
console-only diagnostics are still available; detailed installer logs require
an explicitly authorized, billable start of that **existing** instance.
Do not redeploy or repeat an inference benchmark before reading these logs.

# Pass 59B — Isolated GPU performance pilot (NOT a production narrator migration)

## Pass 61B.5 — G6f AL2023 kernel package correction (operator-only)

The second budget run's console log showed the precise bootstrap failure:
`No match for argument: kernel-devel-6.18.54-121.166.amzn2023.x86_64`.
AWS changed AL2023's default AMI to kernel 6.18 in August 2026. Kernels 6.12 and
6.18 use `kernel6.12-devel-<uname -r>` and `kernel6.18-devel-<uname -r>` instead.
For the next new G6f pilot, select AWS's version-specific AL2023 **kernel 6.1**
x86_64 AMI and verify the matching development headers before downloading GRID.
The user-data package selector also handles kernels 6.12 and 6.18 correctly.
This addresses the observed package-install failure, but **does not yet prove**
that the NVIDIA driver or CUDA container runs on fractional L4.

**Important:** The old budget instance is currently stopped, but changing local
YAML does not rerun EC2 user data. First clean up the old budget stack; then
explicitly deploy a replacement if further testing is worth the expense. Cleanup
deletes existing benchmark bucket data, so fetch any results first. No app
release is needed for the isolated pilot. The CPU/T4 pilots are untouched.

AWS kernel reference: https://docs.aws.amazon.com/linux/al2023/ug/kernel-update.html

## Pass 61B.3 — G6f fractional-vGPU GRID driver correction (operator-only)

The first budget G6f test failed **before Kokoro started**: on the OSS NVIDIA
Deep Learning AMI, `nvidia-smi` could not communicate with the driver. EC2 and
SSM functioned, and the benchmark safely requested a stop. AWS requires GRID
vGPU 18.4 through 19.5 on G6f; the generic Tesla / OSS kernel driver does not
work with this fractional device.

This correction changes **only new budget-pilot deployments** to use a clean
Amazon Linux 2023 base AMI and install an AWS-hosted, pinned GRID vGPU 19.5
(`580.159.03`) guest driver, falling back to 19.4 (`580.126.09`) if present.
The pilot's EC2 role receives **read-only** permission to AWS's official GRID
binary bucket, with no additional access to the game cache. A supported version
must be found; there is no fallback to unsupported `latest` or open drivers.
The host then installs NVIDIA Container Toolkit and starts the same pinned
Kokoro GPU image. Successful inference, GRID installation and startup timing
are **not yet verified against AWS**.

Do **not** restart the existing failed instance expecting this updated user data
to apply. To retry, from the Mac (after confirming the instance is stopped):

```bash
bash scripts/aws/story-time-gpu-budget.sh status
bash scripts/aws/story-time-gpu-budget.sh cleanup
bash scripts/aws/story-time-gpu-budget.sh plan
bash scripts/aws/story-time-gpu-budget.sh deploy
bash scripts/aws/story-time-gpu-budget.sh benchmark
bash scripts/aws/story-time-gpu-budget.sh fetch
bash scripts/aws/story-time-gpu-budget.sh status
```

`cleanup` requires explicit confirmation and deletes **only** the budget pilot
and its S3 benchmark results, instance and EBS volume. The other T4 pilot and
CPU narrator are independent. There is an independent 30-minute watchdog and
the benchmark also requests EC2 stop on failure. After finishing, use budget
`cleanup` to remove the new pilot's persistent EBS and S3 costs as well.
Inspect `/var/log/tot-story-time-gpu-setup.log` if the driver or image startup
fails. The instance's 3 GiB vGPU budget could still be insufficient for
Kokoro; do not assume compatibility based on the full T4 result.

AWS references:
- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/install-nvidia-driver.html
- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/nvidia-GRID-driver.html

## Pass 61B.2 — Lowest-price on-demand NVIDIA budget benchmark (g6f.large)

**No deployment or live backend routing change.** A separate budget pilot can run
three identical MP3 samples on AWS `g6f.large` (one-eighth NVIDIA L4, 3 GiB vGPU VRAM;
8 GiB system RAM). Compare with existing T4 `g4dn.xlarge` measurements. The new
CloudFormation stack and private S3 bucket are **not** shared with the original
pilot; all commands for the original pilot remain the same.

Use `bash scripts/aws/story-time-gpu-budget.sh plan` first. Its `deploy` command
requires typing `CREATE BUDGET GPU PILOT`, provisions **billable** compute and
at least 50 GiB encrypted gp3 EBS (automatically raised to the AMI snapshot minimum), and installs the **same** pinned Kokoro GPU image.
The 6 GiB Docker memory limit fits the 8 GiB host; GPU memory cannot exceed the
approximately 3 GiB hardware allocation. The template uses AWS's current
Deep Learning Base OSS Nvidia Driver GPU AMI for AL2023; AWS lists G6f as a
supported EC2 family, but NVIDIA vGPU support and a CUDA container are still
an **unverified compatibility hypothesis** until the instance runs `nvidia-smi`
and serves the test requests. No network port is exposed publicly.

Commands (from root):

```bash
bash scripts/aws/story-time-gpu-budget.sh plan
bash scripts/aws/story-time-gpu-budget.sh deploy
bash scripts/aws/story-time-gpu-budget.sh status
bash scripts/aws/story-time-gpu-budget.sh benchmark
bash scripts/aws/story-time-gpu-budget.sh fetch
bash scripts/aws/story-time-gpu-budget.sh cleanup
```

The budget watchdog requests a stop after 30 minutes of uninterrupted running,
checked every five minutes. `benchmark` requests immediate stop on success or
failure after confirmation. Also manually verify status; **the root EBS volume
remains billable while the instance is stopped**, until `cleanup` deletes the
stack. Download results BEFORE cleanup; private S3 artifacts also expire after
48 hours. Files download to `~/Downloads/tales-of-two-gpu-budget/`.

`g6f.large` on-demand compute was ~$0.202/hour in us-east-1 as of October 2026,
versus ~$0.526/hour for T4 `g4dn.xlarge`, **excluding** EBS/network/other services.
This does not guarantee cheaper cost **per narration** until benchmarked. If
G6f is incompatible or much slower, stop and clean it up rather than modifying
the production narrator. Because this is an isolated benchmark, do **not** run
the full application `release-staging.sh` merely to provision it.

---


This pilot answers one question: can full-quality NVIDIA Kokoro generate Tales of Two's
**unique Director-created chapter text** fast enough for 0.5–2× playback? It does
not change the live backend, CPU narrator, voice settings, caches or story order.

## Environment and isolation

- A **separate** `AdventurePlatformNarratorGpuPilot-staging` CloudFormation stack.
  Defaults to `g4dn.xlarge` (NVIDIA T4, 16 GiB RAM). Optional `g6.xlarge`
  by setting `STORY_TIME_GPU_TYPE=g6.xlarge` at initial deployment.
- AWS-recommended ECS-optimized **Amazon Linux 2023 GPU AMI**; NVIDIA driver,
  Docker GPU runtime and SSM support. An outbound-capable public subnet is
  reused from the original narrator. This GPU pilot has **no inbound
  security-group rules**, and the container binds to **127.0.0.1:8880** only.
  It is only accessible through an AWS Systems Manager shell/Run Command.
- Pinned upstream container `ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126`;
  80-GiB encrypted gp3 root EBS; separate EC2 SSM instance role and optional
  private S3 artifacts bucket with two-day object expiration.
- **Automatic stop after 120 minutes of continuous EC2 running time**, checked
  every five minutes by its own restricted Lambda. This is *not a hard billing
  ceiling*: billing continues for up to the next check, plus persistent EBS
  and AWS services. User explicitly stops after benchmarks. Start/stop does
  not touch the original t3a.medium or production watchdog. An operator can
  delete the pilot entirely afterward.
- **No production integration in this pass:** don't expose port 8880, rewire
  ECS, change the canonical narrator CDK stack, or edit the production cache.
  The room-based wake/keepalive design will follow benchmark acceptance.

## Expected costs (approximate; verify your AWS rates)

For us-east-1 on-demand `g4dn.xlarge` compute, approximately **$0.526/hour**
(~$1.05 for two hours), plus EBS (80 GiB gp3 while attached/stopped),
public IPv4 while running, Lambda/SSM/S3 costs, and network transfer.
The deployment **starts billing immediately**, before Kokoro is ready.
The EBS disk **keeps charging when stopped**, until the pilot stack is deleted.
GPU capacity/quotas may need to be requested from AWS. Configure a separate
AWS Budget alert; the watchdog is a safety backstop, not guaranteed spend cap.

## Mac commands — from the Tales of Two project root

All commands run the existing `scripts/aws/check-aws.sh` account validation,
using `AWS_PROFILE` (defaults `adventure-staging`) and `AWS_REGION` (defaults
`us-east-1`). There is **no need to run `release-staging.sh`**, because the
pilot has no game/React/Fargate changes. The files are locally overlaid.

**1. Inspect plan, without provisioning:**

```bash
bash scripts/aws/story-time-gpu-pilot.sh plan
```

**2. Explicitly create billable pilot:**

```bash
bash scripts/aws/story-time-gpu-pilot.sh deploy
```

Read the configuration printed and type `CREATE GPU PILOT` when prompted.
It loads the published GPU-AMI ID via the AWS SSM public parameter, discovers
VPC/subnet from the running or stopped *existing* narrator instance, and
creates an independent stack. Docker pulls the GPU image during first boot;
this may take several minutes. If GPU quota is unavailable, CloudFormation
may roll back; review events before retrying.

**3. Check status and run the same three samples as Pass 59A:**

```bash
bash scripts/aws/story-time-gpu-pilot.sh status
bash scripts/aws/story-time-gpu-pilot.sh benchmark
```

Benchmarking uses SSM (no SSH), waits up to 10 minutes for Kokoro startup,
then measures Michael short, Bella short, and Michael long (exact same text as
CPU baseline), MP3 frame duration, wall-clock synthesis time, `audio/wall`
throughput, Docker CPU and sampled GPU utilization/VRAM. A value **above
2× real-time** can in theory keep up with a 2× listener, but we prefer **5×
or more** to provide buffering, concurrency and chapter-turn headroom.
The benchmark **requests EC2 stop on success or failure after its SSM command
completes**, and the independent watchdog stops forgotten test instances.
This does not measure time-to-first-audio (streaming will be a separate test).

**4. Download the GPU samples to listen to quality:**

```bash
bash scripts/aws/story-time-gpu-pilot.sh fetch
```

Default local destination: `~/Downloads/tales-of-two-gpu-pilot/`.
Listen against current Michael/Bella previews in the game, particularly
names, character voices, emotional delivery and pauses. GPU image uses v0.9.0
while existing CPU uses v0.8.0; quality should be assessed, not assumed identical.

**5. Clean up pilot resources completely when done:**

```bash
bash scripts/aws/story-time-gpu-pilot.sh cleanup
```

This requires typing `DELETE GPU PILOT`. It stops EC2, deletes pilot S3
objects, and deletes the independent CloudFormation stack, including EBS.
If deletion fails, inspect CloudFormation events and resolve; don't assume
costs have stopped. Cleanup only affects the GPU pilot stack.

If manually debugging, use `bash scripts/aws/story-time-gpu-pilot.sh stop`
or `start`; on EC2 inspect `sudo tail -100 /var/log/tot-story-time-gpu-setup.log`,
`sudo docker logs story-time-gpu`, `nvidia-smi`, and
`curl http://127.0.0.1:8880/v1/audio/voices` from SSM Session Manager.

## How to decide whether to adopt GPU

- **Output correctness:** same voice IDs, real MP3s, no missing words.
- **Quality:** Michael and Bella sound at least as natural as existing CPU.
- **Throughput:** measured audio seconds / wall seconds, especially long text.
- **Concurrency:** stage a later two-player test before production adoption.
- **Cost:** total running and startup time, S3/EC2 overhead per *adventure*.
- **Reliability:** validate production-ready GPU cold starts, queued jobs,
  independent lobby/adventure leases and watchdog behavior before integrating.

**Not yet implemented:** chapter-aware GPU pre-generation, sentence streaming,
room-lifecycle EC2 keepalive, shared jobs across players, and automatic backend
migration. None should be implied by a successful pilot benchmark.

## Pass 61B — repeatable baseline and A/B comparison (operators only)

The following preparation is safe to install/release in the game project; it does
not create a GPU instance. **No benchmark was executed against AWS by this pass.**
Do not try `deploy` until AWS confirms the selected G-instance quota.

1. Collect Pass 61A real-play browser diagnostics from an actual Story Time
   adventure (WAIT, SERVER, INFERENCE and GENERATED/MEMORY/S3/REPLAY counts).
   These values are a separate end-to-end baseline, not the localhost synthetic
   CPU/GPU measurement.
2. For a fresh CPU baseline, ensure the CPU narrator is running and held awake.
   From the Mac project root:

   ```bash
   bash scripts/aws/story-time-control.sh start 90
   bash scripts/aws/benchmark-story-time-remote.sh
   bash scripts/aws/story-time-control.sh stop
   ```

   The CPU helper requires SSM managed-node `Online`, not just EC2 `running`.
   It now waits up to 120 seconds for a newly awakened narrator. On a persistent
   `InvalidInstanceId`, it reports EC2 health, IAM profile, subnet and public IP
   before aborting without starting inference. For immediate diagnostics use
   `STORY_TIME_SSM_WAIT_SECONDS=0 bash scripts/aws/benchmark-story-time-remote.sh`.
   If SSM never comes Online, investigate the agent, attached IAM role, and
   outbound 443 network access; additional waiting alone cannot repair these.

   This creates a fixed-text CSV at
   `~/Downloads/tales-of-two-benchmarks/cpu/<run-id>/results.csv` on the Mac.
   It uses the same MP3 duration parser as the GPU test, without requiring
   ffprobe on the EC2 host. If the CPU benchmark fails, still stop CPU EC2.
3. Once quota is approved, **and only when intentionally approving billable
   infrastructure**, create and benchmark the isolated GPU pilot as described
   earlier in this document:

   ```bash
   bash scripts/aws/story-time-gpu-pilot.sh plan
   bash scripts/aws/story-time-gpu-pilot.sh deploy
   bash scripts/aws/story-time-gpu-pilot.sh benchmark
   bash scripts/aws/story-time-gpu-pilot.sh fetch
   ```

   `benchmark` requests instance stop on success **and error**, while the
   independent watchdog is the fallback. Verify `status` yourself. If the
   pilot already exists and is stopped, use the explicit `start` subcommand.
4. Compare one CPU CSV and one GPU CSV from the synced GPU results folder:

   ```bash
   python3 scripts/aws/story-time-compare-benchmarks.py \
     --cpu "$HOME/Downloads/tales-of-two-benchmarks/cpu/<run-id>/results.csv" \
     --gpu "$HOME/Downloads/tales-of-two-gpu-pilot/<run-id>/results.csv" \
     --output "$HOME/Downloads/tales-of-two-benchmarks/comparison.md"
   ```

   Replace both `<run-id>` placeholders with real run folders. Listen to the
   GPU MP3s against the existing CPU Michael/Bella voices and manually mark
   pronunciation, pauses, missing words, timbre, warmth, and artifacts. The
   CPU/GPU upstream container versions may differ and audio length may vary.
   A larger audio/wall factor is better; **5×** is a target, not a guarantee.
5. When finished, run `bash scripts/aws/story-time-gpu-pilot.sh cleanup` to
   explicitly remove GPU stack/storage charges. This is **not** part of the
   standard staging release script. Do not automate creating billable GPU
   resources or a switch to the GPU as part of routine releases.

### Measurement boundaries

Each script sends the three public fixed sentences to an already running local
Kokoro service, measures the complete HTTP+MP3 response and computes the
MP3's real playable duration. These are **single-trial** benchmarks, not a
confidence interval, cold-start measurement, queue/concurrency load test,
streaming time-to-first-byte measurement, or proof of Story Time responsiveness.
Collect those before approving GPU for shared live adventures.

### Pass 61B.4 — Diagnose G6f driver bootstrap before another benchmark

A second budget deployment reported `NVIDIA driver missing on pilot host` before
Kokoro started. This message comes from a preflight `command -v nvidia-smi` check;
it does not identify whether cloud-init is unfinished or failed. SSM being Online
is **not** a guarantee that EC2 user data completed installing a GRID driver.

With the budget instance **stopped**, run:

```bash
bash scripts/aws/story-time-gpu-budget.sh diagnose
```

The new, read-only command prints the most recent EC2 boot console (if available)
without turning on EC2. If the instance is already **running** and SSM is Online,
it also collects limited cloud-init, driver installer, kernel/package and GPU
visibility diagnostics. It never starts EC2, changes drivers or containers,
triggers a benchmark, or changes the production narrator.

If console output lacks the failure, **explicitly** start the stopped pilot for
billable SSM log inspection, wait for SSM Online and run `diagnose` again, then
stop it and verify status. Do not redeploy or clean up until logs are captured.
The 30-minute watchdog remains a fallback, not a billing cap.

### Pass 61B.6 — Budget AL2023 curl-minimal conflict fixed; wait for boot

The third G6f attempt failed in `dnf install` before it reached the NVIDIA
installer: AL2023 already includes `curl-minimal` and explicitly installing the
full `curl` RPM caused DNF conflicts. The budget user-data now relies on the
preinstalled HTTPS-capable `curl-minimal`, while still verifying the `curl`
executable. This is an infrastructure-package fix, **not a successful GRID or
Kokoro GPU inference run**.

Before running the benchmark workload, the SSM command now waits for
`cloud-init status --wait --long`, then checks `nvidia-smi` and that the
`story-time-gpu` Docker container is running. A failed bootstrap causes a clear
diagnostic and an automatic EC2 stop request rather than misreporting a GPU
inference failure. Normal 30-minute watchdog remains unchanged.

**Operator sequence** (after installing the 61B.6 ZIP into the Mac checkout):

```bash
bash scripts/aws/story-time-gpu-budget.sh status
bash scripts/aws/story-time-gpu-budget.sh cleanup   # explicit deletion confirmation
bash scripts/aws/story-time-gpu-budget.sh plan      # no resources created
bash scripts/aws/story-time-gpu-budget.sh deploy    # explicit billable creation confirmation
bash scripts/aws/story-time-gpu-budget.sh benchmark # explicit benchmark confirmation
bash scripts/aws/story-time-gpu-budget.sh fetch
bash scripts/aws/story-time-gpu-budget.sh status
# Stop if still running. Clean up the successful/failed pilot after fetching.
```

Do not run a new deployment against an existing stack. Stopped EBS still bills;
clean up after logs/results are no longer needed. The original working T4 pilot
and the production CPU narrator are not affected.

### Pass 61B.9 — G6f NVIDIA container-runtime recovery (isolated pilot only)

The existing budget `g6f.large` now loads the AWS GRID driver after matching
DRM modules were installed, but the Kokoro container failed to start with
`nvidia-container-cli: initialization error: driver rpc error: failed to process
request: unknown`. Driver persistence being off is a documented candidate,
**not yet a confirmed diagnosis**. No GPU inference/benchmark is claimed.

Added a guarded **`runtime-repair`** command for only the *stopped* budget pilot.
With explicit confirmation it uses SSM to test NVIDIA persistence and UVM,
run `nvidia-container-cli` independently, check a short-lived Docker GPU
container, and only then start Kokoro and check the localhost HTTP endpoint.
It captures bounded kernel / memory / toolkit failure diagnostics, and requests
EC2 stop on every completion/failure path. If persistence solves the runtime
error, the host installs a pre-Docker boot service to preserve that fix across
subsequent EC2 starts. It does not reinstall GRID, deploy EC2, or modify the
CPU narrator. The 30-minute watchdog still applies. An unsuccessful smoke test
must be diagnosed before another benchmark attempt.

Command, after installing the overlay and verifying status is `stopped`:
`bash scripts/aws/story-time-gpu-budget.sh runtime-repair`.

