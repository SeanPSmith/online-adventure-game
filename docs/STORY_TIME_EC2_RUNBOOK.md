# Pass 58B — Shared, on-demand Story Time (AWS staging)

**This is an OPTIONAL infrastructure deployment.** The ordinary `release-staging.sh`
changes application code only and does not buy or start a narrator instance.
Run this section only after the local Pass 58B verification succeeds.

## Resources and costs

The optional `AdventurePlatformNarrator-staging` CDK stack creates:

- One Amazon Linux 2023 **t3a.medium** in the existing `us-east-1` staging VPC:
  2 burstable vCPUs, 4 GiB RAM, CPU credits in **standard** mode (no
  unlimited-mode surplus-credit billing).
- **30 GiB encrypted gp3 EBS** root disk; persistent when instance is stopped.
- Public subnet and ephemeral public IPv4 for outbound SSM and GHCR image pulls;
  there is **no public inbound speech, SSH, or SSH key**. TCP/8880 accepts only
  traffic from the backend's security group, over the stable private VPC IP.
- EC2 instance role with Session Manager permissions.
- Private, encrypted S3 narration cache with a **30-day lifecycle rule**.
- DynamoDB on-demand activity/quota state, and an EventBridge-triggered Lambda
  watchdog checking idle and approximate runtime every **5 minutes**.
- The existing ECS backend gets minimum required EC2 wake, cache and activity
  permissions and `KOKORO_BASE_URL`, instance ID, bucket and table environment
  variables when its CDK stack is deployed.

At us-east-1's published ~$0.0376/hour for t3a.medium, **60 compute hours is
~$2.26**, plus approximately **$2.40/month** for persistent 30 GiB gp3 and
IPv4 while running, S3, DynamoDB, Lambda and traffic. Budget **$5–10/month**
for initial private testing. This is an estimate, not a guaranteed maximum;
AWS fees vary. The watchdog's **60-hour/month quota is approximate to 5-minute
sampling and is not a hard AWS billing limit**. Set a separate AWS Budget
(e.g., $10/month with email alerts) and review your Costs Explorer. First boot
is chargeable, even before Story Time is used. Watch usage.

## Deployment (run from the project root on your Mac)

1. Overlay the Pass 58B ZIP. Run `./scripts/check-project.sh` to verify all
   current Python, JavaScript, frontend and CDK tests. Fix any failing check;
   **do not deploy infrastructure on a failing build**.
2. Push the application code using the normal release command:
   `./scripts/release-staging.sh "Pass 58B: prepare on-demand hosted Story Time and shared narration cache"`
   In this state, voice still reports unavailable because no EC2 stack exists.
3. Preview (no resources created):
   `bash scripts/aws/deploy-story-time-staging.sh`
4. When ready to incur AWS charges, run:
   `bash scripts/aws/deploy-story-time-staging.sh --deploy`
   This checks AWS account identity, builds CDK, presents a diff, requires two
   explicit confirmations, and deploys **only the Narrator stack**.
5. Find `adventure-platform-staging-story-time` in EC2, select **Connect →
   Session Manager**. Give cloud-init a few minutes for Docker to download:

   ```bash
   sudo systemctl status docker --no-pager
   sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
   curl --max-time 15 http://127.0.0.1:8880/v1/audio/voices
   sudo tail -100 /var/log/cloud-init-output.log
   ```

   **Amazon Linux 2023 package recovery (first-boot failure):** If `cloud-init`
   reports `scripts-user` failed and logs mention a `curl-minimal` versus `curl`
   conflict, the original startup script exited before installing Docker. Do
   not rerun all cloud-init stages. In Session Manager, recover the existing
   instance with these commands (the CDK source no longer installs full curl):

   ```bash
   sudo dnf install -y docker
   sudo systemctl enable --now docker
   sudo docker pull ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0
   sudo docker rm -f story-time 2>/dev/null || true
   sudo docker run -d --name story-time --restart unless-stopped \
     --memory=3g --cpus=2 --pids-limit=512 -p 8880:8880 \
     -e API_LOG_LEVEL=WARNING ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0
   sudo docker ps
   curl --max-time 30 http://127.0.0.1:8880/v1/audio/voices
   ```

   A `cloud-init status: error` record from the failed first boot can remain
   even after the service is repaired. Verify Docker and the voice endpoint
   directly. Do not redeploy the infrastructure stack merely to update EC2
   user data; CloudFormation updates can restart the existing instance and
   user-data scripts generally are not automatically rerun on every boot.

   If the container was still pulling at first check, wait. Pin the image to a
   tested digest before wider public access; staging uses the upstream v0.8.0
   CPU release tag. A container crash or missing image requires repair before
   connecting the game backend. Docker restarts automatically after EC2 boot.
6. Explicitly attach the new narrator to the existing backend (does not redeploy
   the rest of the game):

   ```bash
   bash scripts/aws/deploy-backend.sh
   ```

   The deploy helper detects the existing narrator stack and preserves its
   backend references. Running raw `cdk deploy Backend` **without**
   `TOT_ENABLE_NARRATOR_STACK=1` can disconnect the narrator; always use the
   helper or supply that flag when narrator is deployed.
7. Stop the newly provisioned EC2 instance **after** the health check to save
   compute charges:
   `bash scripts/aws/story-time-control.sh stop`
   Confirm it is stopped:
   `bash scripts/aws/story-time-control.sh status`
8. Log into staging on a phone/desktop. Enable Story Time. Merely opening
   Settings does not wake EC2. On the first **uncached** chapter narration,
   the browser requests audio; the backend starts EC2 and retries asynchronously
   until voice is ready (up to about three minutes). Reading, decisions, dice,
   intermissions, game state and chapter reveal do **not** wait on audio. The
   optional narration can be delayed or skipped without gameplay impact.
9. Test two accounts in one adventure and another adventure concurrently. The
   adventure's host-selected voice remains fixed, and identical audio is cached
   per text/voice/model-version irrespective of which player requested it.

## Shutdown / safety controls

- **Ordinary usage**: EC2 runs when a passage not already in S3 is requested.
  While playing with Story Time enabled, the browser periodically renews a
  lease. After ~30 minutes without an opted-in player's heartbeat or requests,
  the watchdog stops EC2. Cache hits **do not wake it**.
- **Runtime allowance**: default 60 approximate EC2 running hours per UTC
  month. The Lambda stops EC2 after the allowance is exceeded. Allow up to
  five minutes sampling error plus AWS billing delay. The app will not submit
  fresh inference after the allowance is recorded.
- **Manual control**:
  `bash scripts/aws/story-time-control.sh status|stop|start`.
- **Emergency disable new narration**: in DynamoDB, locate the output
  `NarratorActivityTable`, item `{ "id": "narrator" }` and set a Boolean
  attribute `disabled = true`; then manually stop EC2. Re-enable by removing
  the attribute or setting it to false. Cached audio can still be served by
  the existing speech endpoint. Changing the database flag is an operator
  action, not exposed to players.
- **Financial alerts**: manually create an AWS Budgets monthly cost budget and
  email alert. A budget alarm is not an instantaneous spending cutoff.
- **Limits**: default one concurrent Kokoro generation inside each backend
  task. This small CPU machine has **not** been benchmarked for ten parallel
  players; the actual response time will depend on text length and load.

## Scope boundaries

The existing canonical gameplay presentation stays:
**new adventure: synopsis → ready → BEGIN ADVENTURE → generated Chapter One**;
**subsequent turns: choice → intermission while Python freezes dice and Director
writes → close intermission → show committed dice/outcome → reveal next chapter**.

Audio is always optional and never plays behind intermission/dice. This pass
prepares MP3s, browser playback and shared audio caching. **Accurate word-level
speech timestamps, synchronized progressive text fade, and Admin voice lab are
Pass 58C work**, after measuring real CPU speech latency and timestamps.
No claim of completed live EC2 deployment or tested phone inference is made.

## Watchdog hotfix — safe live benchmarking (2026-10-10)

**Problem identified during first manual tests:** direct requests to `127.0.0.1:8880`
from Session Manager bypass the authenticated Tales of Two backend, so the
DynamoDB idle heartbeat was not renewed. EC2 correctly stopped after the
watchdog idle interval, even while the operator was evaluating the narrator.

**Fix:** the backend now acquires a unique, expiring DynamoDB `generation#...`
lease around every uncached synthesis. Active jobs renew that lease while
running, and release it on success or error. The watchdog checks for those
active leases before any stop, including when the approximate monthly quota
has just expired. Abandoned leases expire automatically; DynamoDB TTL cleans
up their records. A manual maintenance hold protects direct EC2 testing,
without bypassing the monthly quota. Voice remains optional and does not
participate in the game turn state machine.

Deploy the application patch normally first, and update the **existing
watchdog Lambda only** using the separate hotfix helper. Do **not** redeploy
the whole narrator CloudFormation stack just to fix the watchdog: changes to
EC2 user data might interrupt or replace the repaired instance.

```bash
# Mac, project root: release app changes through the normal staging pipeline.
./scripts/release-staging.sh "Pass 58B: protect narration jobs and manual tests from idle shutdown"

# Preview target resources (no AWS changes):
bash scripts/aws/deploy-story-time-watchdog-hotfix.sh

# Explicitly approve updating only the existing Lambda and enabling DDB TTL:
bash scripts/aws/deploy-story-time-watchdog-hotfix.sh --deploy

# Start the existing EC2 and protect your direct benchmark for 90 minutes:
bash scripts/aws/story-time-control.sh start 90

# Extend an ongoing manual session before expiry, if needed:
bash scripts/aws/story-time-control.sh hold 60

# At the end of testing:
bash scripts/aws/story-time-control.sh stop
```

The manual hold covers the operator's *direct* curl tests, but does not wake
EC2 by itself (`hold` versus `start`). It expires after 5–120 minutes, and
`start` defaults to 90 minutes. `release` removes the hold immediately,
allowing normal 30-minute idle rules to apply. It does not disable the quota.
For automatic narration from Tales of Two, no manual hold is necessary.

The Lambda-code helper intentionally does not run CDK, change the EC2 instance,
or start it. It updates the function directly; the source under
`infra/narrator/watchdog.py` is also changed for the next ordinary CDK deploy.
If you later deploy the narrator CloudFormation stack, review `cdk diff` for
any instance replacement or user-data changes before confirming.

### Measured CPU performance and next test

The initial t3a.medium produced a valid ~103 KB MP3 in **20.4 seconds** and a
~142.5 KB MP3 in **28.0 seconds**. Idle memory was **1.24 GiB** out of a 3 GiB
container limit. The available observations don't establish active CPU usage,
credit throttling, or full-chapter latency. A `t3a.large` offers more RAM but
still only 2 vCPUs; don't resize solely to increase memory.

Once the maintenance hold is active, use a short sample and capture CPU **while
it is generating**. Check `CPUCreditBalance` and `CPUSurplusCreditBalance` in
CloudWatch, and note elapsed seconds and audio duration. If CPU inference is
still substantially slower than real time, benchmark an optimized ONNX
implementation or a genuinely faster vCPU family before scaling spend.
Keep the monthly runtime quota and normal gameplay fallback enabled.

## Pass 59A inference benchmark (existing EC2, no infrastructure changes)

For an apples-to-apples baseline, first run this on the Mac in the Tales of Two project root:

```bash
bash scripts/aws/story-time-control.sh start 90
```

From your Mac, run the benchmark through AWS Systems Manager (SSM) without copying files to the instance manually:

```bash
bash scripts/aws/benchmark-story-time-remote.sh
```

Alternatively, reconnect with AWS Session Manager, wait until `curl http://127.0.0.1:8880/v1/audio/voices` succeeds, then run **on EC2** after transferring the script:

```bash
bash benchmark-story-time-ec2.sh
```

The `scripts/aws/benchmark-story-time-ec2.sh` script lives in the local ZIP/repository, not automatically on the remote instance. The wrapper sends it through SSM Run Command; no public SSH port is needed. The script saves a small CSV and MP3 examples locally on EC2, samples Docker CPU/memory during inference, and never changes the model or AWS instance. `ffprobe` is optional for measuring true audio duration; do not estimate exact real-time factor from MP3 size alone. Gather `CPUCreditBalance` and `CPUSurplusCreditsCharged` in CloudWatch for the benchmark window. Stop EC2 after testing:

```bash
bash scripts/aws/story-time-control.sh stop
```

The narrator's HTTP response headers (`X-Story-Time-Cache`, `X-Story-Time-Server-Ms`, `X-Story-Time-Inference-Ms`) independently distinguish S3/memory hits from genuine synthesis. Changing browser playback rate between 0.5× and 2× must never force audio regeneration.
