# Tales of Two — Pass 61C.2 dedicated G6f Story Time service

**State: code ready for Mac validation; no AWS infrastructure or application cutover has been performed by this patch.**

## What happens in play after a successful rollout?

A participant enables Story Time in a live adventure lobby (including synopsis/readiness). The existing authenticated room heartbeat creates/renews a five-minute lease in this GPU service's DynamoDB table and wakes its stopped EC2. While the Director writes a chapter, the service can finish warming up. Completed-chapter chunks are synthesized asynchronously and cached privately in S3. The narration NEVER gates a dice roll, a turn, story reveal or Arcade. Concurrent eligible rooms share one G6f, and foreground generation is serialized to prevent GPU OOM on the 3 GiB slice.

After the last listener stops heartbeating or the room closes, room leases expire naturally. The five-minute EventBridge watchdog refuses to stop while any room lease or generation lease is still live; after roughly five minutes idle (plus poll interval), and only after an EC2-start minimum of ten minutes, it requests EC2 stop. Cached MP3 and completed Chronicle replay work with EC2 stopped. This isn't a GPU-per-turn start/stop cycle: EC2 cold starts and Kokoro model loading are much slower than inference, so we preserve responsiveness for active rooms.

## Isolation and costing

- **Dedicated GPU narrator**: separate `AdventurePlatformNarratorGpu-staging` CDK stack, `g6f.large` (1/8 NVIDIA L4, 3 GiB VRAM), approximately $0.202/h On-Demand in us-east-1 at initial testing. Recheck pricing in AWS. 50 GiB encrypted gp3 EBS and other AWS services bill separately. Automatic stop makes *compute* cost zero while stopped; the volume remains billable.
- **CPU fallback**: original `AdventurePlatformNarrator-staging` is not altered or terminated. If GPU health or quality fails, explicitly restore CPU backend routing.
- **Benchmark pilot**: `AdventurePlatformNarratorGpuBudgetPilot-staging` is separate, has zero inbound ports and its own 30-minute hard-stop. **Do not use the pilot for gameplay.** Its GPU proof does not prove the newly provisioned service boots cleanly.
- **Network**: the service's 8880 port accepts traffic only from backend ECS security group; no SSH inbound. AWS SSM provides operator diagnostics. Fargate uses fixed private EC2 IP via CloudFormation output for that instance (changes if it is replaced, not on stop/start).
- **Cache**: GPU v0.9.0 cache key and bucket separate from CPU v0.8.0. The completed-adventure S3 archive is independent. Keeping audio for a finished adventure is generally cheaper than another cold GPU start.
- **Budget protection**: approximately 30 GPU running hours/month on the watchdog (~$6.06 compute at the tested rate), no new rooms when exhausted; an existing live room can finish. This is NOT a hard financial cap. Configure AWS Budgets email alerts separately and monitor GPU/EBS/IPv4 costs. Active rooms, watchdog polling, billing lag and emergency manual actions can exceed the nominal allowance.

## Operator commands on Mac

1. Install the ZIP with `scripts/install-overlay.sh` and run `./scripts/release-staging.sh "Pass 61C.2: Dedicated budget GPU Story Time with idle control and opt-in rollout"`. The normal source release neither creates the GPU nor switches narration.
2. Read-only preview: `bash scripts/aws/story-time-gpu-service.sh plan`.
3. To authorize a NEW, billable GPU instance: `bash scripts/aws/story-time-gpu-service.sh provision`; inspect the CDK diff, then confirm again. This is a distinct stack, **not** the existing working pilot and does not resize CPU.
4. Initial provisioning starts EC2. Wait until setup completed, then `bash scripts/aws/story-time-gpu-service.sh smoke` while it runs. If the watchdog already stopped it, use `bash scripts/aws/story-time-gpu-service.sh start` explicitly and run smoke. If smoke fails, STOP it and inspect SSM `/var/log/tot-story-time-gpu-setup.log`, Docker, GRID and cloud-init; do not switch.
5. With a passing GPU smoke, `bash scripts/aws/story-time-gpu-service.sh cutover`. This performs another GPU smoke and CDK diff, requires typed explicit approval, then deploys the Backend stack to reference the GPU instance, its own cache and activity table. Only **staging** is targeted.
6. Confirm with active one-room and two-room tests: lobby prewarm; real audio first chapter; no early story/audio reveal; Michael/Bella voices; cache hit while GPU stopped; archive replay; no duplicate generation; no stops while a live room/generation job exists; idle stop after leases lapse; wake after stop; browser 503/starting retry and no gameplay blocking. Confirm AWS EC2 stopped when finished.
7. On fault: `bash scripts/aws/story-time-gpu-service.sh rollback`. It requires typed approval and deploys Backend config back to the untouched CPU narrator. Stop the dedicated GPU manually only when idle.
8. For later Backend **CDK infrastructure redeploys**, `deploy-backend.sh` requires explicit `TOT_STORY_TIME_GPU_CUTOVER=0` (CPU) or `1` (GPU) if the dedicated GPU stack exists. This prevents accidentally changing inference routing. Ordinary source-only `release-staging.sh` does **not** redeploy CDK or change routing.

## Validation and limits

- The original pilot has proven `ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126` works after correct AWS GRID driver/DRM package and `vm.overcommit_memory=1`, with the user approving voice quality. This **new** production-capable stack's first-boot and reboot behavior are not yet field-tested.
- AMI is pulled from the 6.1 SSM parameter with a stable CDK context lookup; review the pinned image before reprovisioning. Deployment may fail if compatible kernel packages or driver artifacts disappear in later AWS releases.
- 10-minute minimum uptime reduces cold-start shutdown risk; `cloud-init` and model pull can still take longer. The watchdog is not a health controller and does not automatically repair broken GPU containers.
- No Spot usage or third-party inference service is enabled. No old benchmark pilot teardown is performed automatically; clean up unused pilot stacks separately after documenting results.

## Pass 61C.3 — First-deploy Launch Template collision recovery

First provisioning can fail with `InvalidLaunchTemplateName.AlreadyExistsException` at `NarratorInstance/LaunchTemplate`. Do **not** delete other EC2 launch templates; the conflict may refer to a resource controlled by another stack. The dedicated GPU template now removes the explicit `LaunchTemplateName` property at synth time so CloudFormation generates a unique physical name. The existing CPU and budget pilot stacks are unchanged.

Wait for the dedicated `AdventurePlatformNarratorGpu-staging` stack to enter `ROLLBACK_COMPLETE`. Then use `bash scripts/aws/story-time-gpu-service.sh clear-rollback`, confirm by typing `DELETE FAILED GPU STACK`, and allow it to finish. This action refuses to delete other stack states or other stacks. Review any resources retained by CloudFormation (e.g. private buckets) separately. Rerun `plan` and `provision`, then `smoke` *before* `cutover`. Do not delete a launch template manually.

The CDK egress line `${NarratorSecurityGroup.GroupId} Out Everything Everyone (IPv4)` is not an Internet ingress rule; it's due to `allowAllOutbound: true`. Port 8880 inbound remains restricted to the backend security group. Review the rest of the CDK diff for unintended inbound rules before approval.

### Pass 61C.4 — Launch Template construct compatibility and synth guard

The first 61C.3 retry failed locally because `ec2.Instance.node.tryFindChild("LaunchTemplate")` was incorrectly assumed to return a `CfnLaunchTemplate`. In CDK, launch templates can be wrapped in higher-level constructs. The GPU-only stack now applies an Aspect to every synthesized `CfnLaunchTemplate`, deleting the explicit `LaunchTemplateName` property. The GPU `provision` command **fails closed** unless an independent JSON-template check confirms exactly one `g6f.large` Launch Template without a fixed name. This safety check runs before any AWS changes or deploy confirmation. The CPU instance is untouched. The failed CloudFormation stack was already successfully deleted; **do not run `clear-rollback` again while the stack is absent**.

### Pass 61C.5 — First dedicated GPU smoke readiness and diagnostics (2026-10-13)

The dedicated `AdventurePlatformNarratorGpu-staging` CDK stack successfully deployed with
CloudFormation-generated Launch Template name, instance `i-0c640e1e1de05a336`
(`g6f.large`). The initial `smoke` reached a running L4-3Q GPU and completed cloud-init
but hit `curl: (56) Recv failure: Connection reset by peer` when checking Kokoro.
That alone does **not** show whether Kokoro was still starting or had crashed.
No backend cutover was performed.

The dedicated-service `smoke` now waits up to three minutes for a successful HTTP
`/v1/audio/voices` response and then synthesizes a short, fixed Michael
health-check MP3 without game/story content. If readiness fails, it reports the Docker container's
exit/OOM state and recent logs. `diagnose` is a separate read-only SSM inspection of
container state, Kokoro logs, systemd, GPU, and HTTP. Both require the **existing**
instance to be running; neither starts EC2 or changes live narrator routing.

Operator workflow: `story-time-gpu-service.sh status`, and if running,
`story-time-gpu-service.sh smoke`. On a failure,
`story-time-gpu-service.sh diagnose`; save the output before stopping an idle
GPU with `story-time-gpu-service.sh stop`. If already stopped, start manually
only when ready to incur compute charges. Do not run `cutover` unless smoke passes.

This patch is **Mac-side operator tooling only**. No CDK stack update, new
EC2 instance, or backend deployment is required to use these commands.
