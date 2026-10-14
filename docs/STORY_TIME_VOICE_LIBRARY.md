# Story Time narrator voice library — Pass 61D.1

## Scope

- All **28 American/British English Kokoro v1.0** voices are exposed in Story Time. This is a verified model catalogue, not yet a guarantee that every voice has been successfully auditioned on the deployed `ghcr.io/remsky/kokoro-fastapi-gpu:v0.9.0-cu126` image. Other languages stay disabled until separately reviewed.
- The original five (Heart, Bella, Sky, Michael, George) remain featured at the top. Search finds all voices by name, accent, gender, or ID.
- Host preference sets the initial room narrator/prefetch default. **Each participant's browser uses their own narrator preference**, including mid-adventure, without mutating the room, Director, choice state, or anyone else's voice. Preferences currently persist in local browser storage, **not** synchronized across devices/accounts.
- A change lets the current audible chunk finish. Prepared next chunks with the old voice are cancelled; the following chunk uses the new voice. If a clip was already generated for that voice and text, it can be reused from local/S3 speech cache. Playback speed remains client-side and does not change synthesis keys.
- A completed Chronicle preserves each successfully narrated voice variant. If co-op players saved multiple variants of the same turn/position, the Chronicle player plays one per position and exposes a preferred voice track selector, falling back to other recorded variants where necessary. This is **not** voice-conversion of old recordings.

## Zero-inference player samples

Player `▶ PLAY` sample uses **only** `GET /api/narration/previews/{voice}`, which reads an authenticated object from the existing private `KOKORO_ARCHIVE_BUCKET`. This route has no host/EC2 or TTS generation calls. If a sample has not been seeded, it returns 404 and the UI explains that samples are awaiting preparation. Previews are synthetic text, not private story content.

The administrator **explicitly** seeds samples from **Account → Settings → Story Time → ADMIN // PREPARE VOICE PREVIEWS**. This is visible only to the `admin` permission. It calls CSRF-guarded `POST /api/narration/previews/seed/{voice}` in order, one voice at a time, retrying `503` during GPU wakeup. Each voice is generated once using a fixed, safe sample passage and stored under `previews/kokoro-v0.9-gpu-english-v1/{voice}.mp3` in the existing archive bucket. The archive's 30-day expiration applies only to `pending/`, not to these previews. Re-running is idempotent and reads cached MP3s. Ordinary visitors **cannot** trigger any preview inference or preview GPU startup.

### Deployment/acceptance sequence

1. Install Pass 61D.1 over 61C.6 and run `./scripts/release-staging.sh "Pass 61D.1: Full English narrator library and personal mid-adventure voices"`. This invokes Python/browser regression checks and React/CDK build on the developer Mac.
2. Administrator signs into staging, opens Account → Settings → Story Time, and selects **ADMIN // PREPARE VOICE PREVIEWS** while the narrator is available. It is acceptable if the GPU is stopped; the authorized seeding process should wake it via its existing budgeted backend. This step is **optional but required for playable sample buttons**. It incurs a one-time small amount of GPU runtime, not per-player inference. Monitor progress; if an image does not support a listed voice, it will show an error for that voice without pretending the catalog is fully ready.
3. In two separate signed-in browsers/co-op participants, enable Story Time and select Michael in one and Bella in the other. Both should hear their own selections; there should be no effect on the other user's narrator or game state.
4. Switch from Michael to Bella while a chapter is being read. The audible clip finishes, next clip uses Bella. Test switching back to Michael and compare replay/cache diagnostics. **Changing the voice does not change playback rate.**
5. After a completed game, check Chronicle audio still plays privately, including switched voices, without waking GPU. Allow GPU to idle and confirm EC2 returns to `stopped`. Player `▶ PLAY` samples still work while EC2 is stopped if administrator seeded them.
6. Existing GPU routing, watchdog, monthly-budget settings, deployment infrastructure, AWS stacks, security groups, and fallbacks are unchanged by this code-only overlay.

### Limits and cost

- The deployed Docker image has been verified on GPU for **Bella and Michael**, not independently auditioned for all 28 voices. Administrator sample generation doubles as a first model-compatibility smoke test; player live requests can return 502 if a specific voice is unsupported by the running runtime.
- Switching voice **never incurs a per-voice software license or character fee**. Additional new audio may use GPU compute; the EC2 instance still accrues compute charges while running. Prefetched old-voice chunks cancelled after initiation may already have consumed some GPU work. S3 preview reads and storage have small normal AWS charges.
- No user-facing request generates previews on the fly. Samples will show as unavailable until the admin generation step succeeds.
- The full front-end/CDK production build and end-to-end staging validation must run on the Mac/AWS environment. No staging deployment was triggered from this patch-building environment.
