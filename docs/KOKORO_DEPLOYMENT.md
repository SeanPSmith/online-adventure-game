# Pass 56 — Kokoro narration deployment and testing

**Status:** Game/backend code is implemented. The Kokoro model server is **not** deployed by the normal release script. Until configured, Account → Preferences correctly reports that narration is unavailable, and story reading controls are disabled. No speech-to-text, microphone, or voice input exists.

## Architecture

```
Browser (logged-in) -> same-origin POST /api/narration/speech -> Tales of Two FastAPI
                  -> KOKORO_BASE_URL/v1/audio/speech -> private Kokoro-FastAPI
                  <- MP3 audio bytes (up to 5 MiB) <-
```

The normal app remains small; do **not** install Kokoro/Torch in its existing 512 CPU / 1024 MiB Fargate container. The narration service is a separate resource with its own compute cost. Authenticated game requests have bounded input (1,800 chars), an allowlist of voices, a per-process rate limit, a two-request inference concurrency cap, and an ephemeral 24 MiB server cache. The player tab retains only a small in-memory object URL cache. There are no persistent recordings or text-to-audio files. The provider is not directly exposed to web clients.

## Local development smoke test

1. Install Docker. Run a self-hosted Kokoro OpenAI-compatible server (upstream project: https://github.com/remsky/Kokoro-FastAPI). This is an **example for local experimentation**; pin an explicit upstream release tag before production deployment:

   ```bash
   docker run --rm --name tot-kokoro -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
   ```

   The first run may download a large container/model image. An Apple Silicon Mac can run the CPU image; listen locally on port 8880. Verify it is running using `curl http://127.0.0.1:8880/v1/audio/voices`.

2. Start your Tales of Two Python backend in a **separate shell**, with:

   ```bash
   export KOKORO_BASE_URL="http://127.0.0.1:8880"
   # Start your existing backend development command normally.
   ```

3. Sign in, open **Account → Preferences**, enable narration and select a narrator. Enter an adventure and select **READ CHAPTER** or **READ CHOICES**. Ensure audio begins only when you request it (or enable auto-read and the browser permits it). The server splits larger passages into bounded requests.

## AWS staging rollout (separate from source release)

The staging release command `./scripts/release-staging.sh "..."` only updates source/images/assets. **It does not deploy CDK infrastructure or a Kokoro server.**

1. Provision a dedicated Kokoro-FastAPI CPU/GPU container on a private reachable host in your AWS VPC (ECS, EC2, etc.). Size and budget the inference resource, configure security groups for *game backend -> narrator* traffic, and test response latency. Keep its port **private**; never publish the unauthenticated Kokoro endpoint to the Internet. Pin a tested container tag. Use TLS where crossing an untrusted network.
2. Set the stable **private base URL** in the infra deployment environment, for example:

   ```bash
   export TOT_KOKORO_BASE_URL="http://kokoro.internal:8880"
   ./scripts/aws/deploy-backend.sh
   ```

   The provided hostname is illustrative, **not** a real deployed hostname. This pass forwards the setting through `infra/config/staging.ts` → `infra/lib/backend-stack.ts` as `KOKORO_BASE_URL` on the ECS task definition. Keep `TOT_KOKORO_BASE_URL` set on subsequent backend-stack deployments so you do not unintentionally clear it. Verify ECS task replacement completes and the new environment variable is present. A standard source deployment cannot set this variable.
3. With a logged-in account, GET `/api/narration/status` on the public site; it should report `available: true`. Then press READ CHAPTER. `available` means **configured**, not that live model health has been proved; validate an actual MP3 response with a brief passage.

## Acceptance checks

- Narration defaults **OFF**; turning off SFX has no effect on narration.
- READ CHAPTER speaks only the current generated chapter body; READ CHOICES reads each option in order, while an individual LISTEN button speaks just its choice.
- None of the reading buttons lock in a choice; they do not use microphone permission.
- Pause/resume/stop and speaker speed/volume settings work independently on each player's browser.
- Scene changes, turn theater, QTEs, and death stop stale playback. Reconnect, refresh and duplicate socket snapshots don't automatically re-read a previously auto-read chapter.
- Replaying unchanged text/voice/speed hits in-memory cache. Settings persist on that browser, not across devices. Audio blocked by browser autoplay policies shows an actionable error and works with manual READ.
- Test at least one long generated scene, solo and two-player rooms, and mobile Safari/Chrome.

The Kokoro-FastAPI speech contract uses OpenAI-compatible `POST /v1/audio/speech` (`model`, `input`, `voice`, `speed`, `response_format`). See https://github.com/remsky/Kokoro-FastAPI for supported runtime modes and deployment options.
