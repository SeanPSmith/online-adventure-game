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
