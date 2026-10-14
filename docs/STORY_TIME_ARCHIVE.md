# Story Time — completed adventure audio archive (Pass 61C.1)

## Player behavior

- Story Time remains optional. Speech chunks are collected **only** when an
  authenticated, online participant actually requests them, and only when the
  requested text and voice match the current server-side room scene.
- Both `My Adventures` → Completed → `LISTEN TO CHRONICLE` and `Sealed
  Chronicles` use an authenticated, same-origin backend audio stream.
- A participant of the completed adventure can hear the **original saved MP3**
  without waking EC2. Other accounts receive 404 for both manifest and clips.
- No old adventures are backfilled and muted/unplayed passages won't be present.
  The archive is a playlist of *actually requested* passage chunks, not a
  synthesized full audiobook. If a chunk is missing, no background regeneration
  is triggered.

## Storage and cost boundaries

- The backend CDK stack provisions a **new private S3 archive bucket**. The
  existing narrator cache remains separate and retains its 30-day expiration.
- `pending/<sha256(history_id)>/<clip_id>.mp3` expires after 30 days to limit
  cost for abandoned rooms. `completed/<sha256(history_id)>/<clip_id>.mp3`
  has no automatic expiration while the Chronicle exists.
- S3 SSE-S3 encryption, Block Public Access, SSL enforcement, and task-role
  read/write permissions are applied. No public or presigned S3 URLs are sent
  to browsers. Raw room IDs, user IDs and spoken text are not part of S3 keys.
- The SQL `adventure_audio_clips` table stores deterministic opaque clip IDs,
  turn/position, voice, and archived status. It doesn't duplicate MP3 bytes.
- Audio capture is best effort. Failed S3 writes/copies are logged without
  blocking Story Time or the Director. An authorized archive open retries
  pending promotions. `completed/` objects are retained by CloudFormation
  stack removal policy and therefore require explicit data-retention/deletion
  tooling in a later pass. The current site privacy notice discloses retention.

## Release and verification

The normal `./scripts/release-staging.sh` release deploys the Backend stack,
which provisions the dedicated bucket and passes `KOKORO_ARCHIVE_BUCKET` to
Fargate. Do not deploy the opt-in Narrator or GPU pilot stacks for this change.
Confirm the backend task role has access to the new bucket, run an opted-in
staging adventure with narration and finish it, then open Completed → Listen.
The narrator instance may remain asleep for archive replay. Inspect CloudWatch
for `story_time_archive_*_failed` if clips are missing.

## Remaining work

Room-aware G6f production routing and idle lifecycle, migration of existing
CPU narrator traffic, concurrent-room load, configurable retention/deletion
controls, complete chapter transcript replay, and a robust backfill/recovery
job are **not** part of 61C.1. Keep the CPU narrator and working G6f pilot
unchanged until a measured, separately approved cutover.
