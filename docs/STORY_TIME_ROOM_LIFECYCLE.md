# Pass 59C: Adventure-aware Story Time (staging)

This overlay does **not** replace the working CPU narrator or deploy the GPU pilot.
The normal game release builds the API and web application; it does **not** update
an existing CloudFormation watchdog Lambda.

## Deployment order

1. Apply overlay and run `python -m pytest tests/narration -q` and
   `node --test tests/frontend/*.cjs`.
2. Run `./scripts/check-project.sh` with the normal project virtual environment
   and npm dependencies. **Do not deploy if any verification fails.**
3. Deploy the backward-compatible watchdog update first:
   `bash scripts/aws/deploy-story-time-watchdog-hotfix.sh --deploy`.
   This changes only the existing Lambda code and DynamoDB TTL, not EC2.
4. Release application:
   `./scripts/release-staging.sh "Pass 59C: adventure-aware Story Time leases and private prefetch"`.
5. Test one private opt-in lobby, including a partner on another browser; verify
   EC2 wakes from the lobby, normal text-only players never wake it, the instance
   stays on while at least one opted-in player is connected, and stopping the
   last listener eventually permits normal idle shutdown (~15-minute grace,
   watchdog schedule checks every five minutes, additional launch grace).
6. Observe the new `room#` rows in the **existing** narrator DynamoDB table,
   and verify `expires_at_epoch` increases during active play and then expires.
   Do not assume physical DynamoDB TTL deletion happens immediately.

## Privacy and turn safety

- `/api/narration/heartbeat` accepts `{ "room_code": "...", "enabled": true }`
  from an authenticated online room member. Disabling sends `enabled: false`.
  The original empty-body heartbeat remains no-wake for compatibility.
- **Only committed**, server-owned chapters enter the speculative queue. No
  scene text is transmitted to clients by prefetch. Players must still complete
  intermission and dice acknowledgement to reveal the next scene normally.
- Background work is optional and errors are isolated from gameplay. It uses
  the current configured narrator and the same `model + text + voice` shared
  cache key as foreground speech. The browser splits chapter text into the same
  280-character chunks. Already cached audio is not regenerated.
- This is a bounded **in-memory** per-backend-worker queue, not a durable SQS
  queue. Restarting Fargate can discard pending speculative work without losing
  story state. Duplicate work across multiple backend instances remains a
  follow-up for global claims/locks; sharing S3 minimizes repeat work after
  generation completes.
- Continuous buffered browser playback, new GPUs, word timings, hardware
  acceleration, and hard billing caps are **not** part of this pass.

## Rollback

Roll back the game release if there is an application issue. The new watchdog
recognizes old `generation#` leases and operates correctly with no room rows.
Older browsers use an empty-body, no-wake heartbeat; a prior-version frontend
therefore retains the old on-demand-per-request behavior. There is no required
DynamoDB schema migration. Do not redeploy the narrator CloudFormation stack
just to revert the Lambda code.
