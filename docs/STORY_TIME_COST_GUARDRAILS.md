# Story Time — distributed narrator cost and abuse controls (Pass 62A.2)

## What actually ships

Staging backend has a separate private DynamoDB `NarrationMeter` table. Its
`id` primary key supports conditional five-minute request counters and atomic
daily inference reservations. A `DayIndex` secondary index serves the private
Admin Control Room's last-seven-day aggregate dashboard. The table uses TTL;
operational counters remain ~45 days and rate windows ~2 days (actual AWS TTL
deletions are eventual). No speech text, voice audio, or room names are saved.

`POST /api/narration/speech` still **first** requires authenticated online
membership in a current started room and an exact already-revealed scene
passage (62A.1). Then the backend:

1. Atomically counts each authorized HTTP speech request against a per-user,
   shared five-minute, **fixed-window** request quota (50 by default). Even
   memory/S3 hits must pass this rate limit. Over-limit returns 429.
2. Reads daily user/global generation counters **before waking the GPU** after
   cache misses. An exhausted quota returns 429, with no EC2 wake.
3. Rechecks caches after awaiting the per-process synthesis semaphore. Just
   before an actual uncached Kokoro call, a DynamoDB transaction atomically
   reserves the user/day **and** global/day generation count and characters.
   Both either succeed or fail together. A rejected or unavailable transaction
   never initiates inference; infrastructure errors fail closed with 503.
4. Reports successful cache hits/generations and recognized synth failures to
   bounded daily per-account and global aggregate usage records. Metrics use
   best-effort writes, so a metrics-write failure cannot destroy already
   generated voice audio. Rate/quota denials are reflected in the operator
   dashboard at most once per account, reason, and five-minute window. Reservations are conservative and not refunded on
   failed calls, because attempted inference can still consume GPU time.
5. Voice previews and previously archived Chronicles stay on their own S3 read
   paths; their playback never spends a generation allowance.

All time-based quotas use UTC. `STORY_TIME_METER_TABLE` is assigned by CDK;
without it, local developer runs still use the old in-process limiter. Do **not**
run public staging without this environment variable and functioning table.

### Starting limits (operator-adjustable CDK container environment)

| Variable | Default | Unit |
| --- | ---: | --- |
| `STORY_TIME_WINDOW_REQUEST_LIMIT` | 50 | Requests per account per fixed 5 minutes |
| `STORY_TIME_USER_DAILY_GENERATIONS` | 300 | New synthesis attempts per user UTC day |
| `STORY_TIME_USER_DAILY_CHARACTERS` | 180000 | Synthesized characters per user UTC day |
| `STORY_TIME_GLOBAL_DAILY_GENERATIONS` | 9000 | New synthesis attempts across all accounts UTC day |
| `STORY_TIME_GLOBAL_DAILY_CHARACTERS` | 5000000 | All synthesized characters UTC day |

The global cap reduces the risk of a large number of authorized accounts
bypassing an individual limit. It is **not** a fixed USD or EC2 time cap.
Long adventures and co-op with different narrators may need adjustment after
we collect representative usage; do not promise paid users uninterrupted
narration without confirming the allowances support long play sessions.

### Admin dashboard

`GET /api/auth/admin/narration-usage` requires superuser authentication and
returns last-7-day generated, cache-hit and failed clip counts, output MP3 bytes
and inference milliseconds, top 20 user IDs and high-usage flags for users
whose **today** generation count reaches 70% of the default daily quota.
The Control Room polls this view once per minute. These values are NOT the AWS
bill, a complete account-wide security event history, or a profitability model.
The admin list can identify heavy users and administrators can use existing
account suspension, AI pauses, and usage allowance controls separately.

### Still required before public paid release

- Add AWS WAF/IP-level throttling, signup/identity abuse prevention, and a
  perimeter rate ceiling. Conditional DynamoDB denials still incur AWS API
  traffic; the application cannot economically resist unlimited internet spam
  by itself.
- Global GPU **concurrency** controls or queueing across ECS replicas. Current
  semaphore is per-process; this pass addresses request frequency and daily
  spend reservations, not instantaneous GPU memory contention.
- Unified AI Director/adventure/room/host billing quotas and confirmed
  entitlement enforcement. This pass meters *narrator* generation only.
- Server-side abuse alert delivery (SNS/email/webhooks) and actionable audit
  traces. The dashboard's alert list is informational; no automatic ban.
- AWS Cost Explorer/CloudWatch/Budgets and OpenAI invoices for actual costs.
  S3 storage, EC2 idle time, Fargate/RDS/ALB and network are not attributed
  per user by this service.
- Concurrent backend replica tests on actual DynamoDB, quota rollover,
  30–60min and 4h live adventures, mobile cold starts, and interrupted rooms.

### Deployment guardrail fix (Pass 62A.3)

The operator script must flatten the nested ECS `containerDefinitions[].environment[]`
array before filtering `KOKORO_INSTANCE_ID` or `STORY_TIME_METER_TABLE`.
Pass 62A.2 initially omitted the second flatten operation and incorrectly
reported `None` even for a healthy dedicated GPU ECS task definition. The
fixed script keeps the same **fail-closed GPU routing check** and checks the
actual value, rather than bypassing or assuming it. `plan` and `verify` are
read-only. If `plan` still reports a mismatched instance after this fix,
inspect the ECS task definition and investigate the routing before deploying.
No GPU cutover or extra narrator stack deployment is required for the fix.

### Deployment

The CDK backend stack adds **one** DynamoDB table and task-role permissions.
No new narrator EC2, narrator stack, or GPU pilot changes. The backend ECS task
needs deployment. Verify the backend diff does not propose replacing the running
Fargate service's database, narrator instance, cache buckets, or GPU. A task
definition revision is expected. The new table is `RemovalPolicy.RETAIN` to
avoid accidental loss of usage records; review stale resource retention later.

Deployment order is important because the standard release script pushes code
**but not infrastructure**. Install the overlay, then run the gated metering
stack plan and deploy BEFORE the normal staging release:

```
bash scripts/aws/deploy-story-time-guardrails.sh plan
bash scripts/aws/deploy-story-time-guardrails.sh deploy
bash scripts/aws/deploy-story-time-guardrails.sh verify
./scripts/release-staging.sh "Pass 62A.2: Distributed narrator quotas and admin monitoring"
```

The deployment command sets GPU cutover variables explicitly, refuses a route
mismatch, and targets `AdventurePlatformBackend-staging --exclusively`. It MUST
not propose replacing GPU/CPU EC2, RDS, ALB, or narrator S3 resources. Read the
CDK diff carefully and refuse if it does. The new DynamoDB table will cost
money per request and stored byte (PAY_PER_REQUEST); no new EC2 is created.
After release, verify admin `STORY TIME // USAGE & ABUSE PROTECTION` is
**configured** and run a real authenticated adventure. Callers receive 429 for exceeded quotas and 503
for metering outages; generated audio remains optional, gameplay continues.
