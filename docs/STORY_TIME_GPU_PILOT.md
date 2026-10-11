# Pass 59B — Isolated GPU performance pilot (NOT a production narrator migration)

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
