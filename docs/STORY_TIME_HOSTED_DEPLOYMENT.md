# Story Time — Pass 58A application deployment

This pass does not create or start an EC2 instance. The existing backend speech proxy remains disabled until `KOKORO_BASE_URL` is supplied through the CDK backend deployment. The game functions normally without voice.

1. Extract patch at project root.
2. Run `bash scripts/prepare-pass58-story-time.sh`. This uninstalls the browser model package and updates `frontend/package-lock.json` using npm, then checks the React build. Do not run `npm audit fix --force`.
3. Run `./scripts/release-staging.sh "Pass 58A: hosted Story Time client, host-selected voice, and generate Chapter One on begin"`.
4. On staging, check new AI adventure: synopsis and party first; Begin Adventure generates Chapter One once, no opening Arcade/dice; afterward normal choice, dice and intermission loop. Confirm an old in-progress adventure still resumes unchanged.
5. Story Time controls may show unavailable until a separately benchmarked Kokoro service is configured.

**Privacy:** Narrated passages are sent to the authenticated game backend and its private speech service. Players do not download models. No microphone or voice input. Narration is optional and must never gate game-state progression.

**Later infrastructure design (not deployed here):** private VPC CPU EC2 service, controlled access from backend SG, workload queue and shared cache, active-session wake/sleep with monthly runtime quota, budget alarms, word-level audio timestamps and sync with StoryReveal after intermission. Benchmark latency, memory and EBS/network costs before purchasing.
