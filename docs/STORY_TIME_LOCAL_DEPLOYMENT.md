# Pass 57 — Story Time browser-local narrator

This is the current supported narration path. **No AWS model server is required.**

## One-time install before release

From the project root:

```bash
bash scripts/prepare-pass57-story-time.sh
./scripts/release-staging.sh "Pass 57: Story Time local narration, consent, and privacy notices"
```

The install script adds pinned `kokoro-js@1.2.1` and updates `frontend/package-lock.json` locally. **Review the lockfile and commit it along with the release.** The ZIP contains `frontend/package.json`, but not a fabricated lockfile: npm registry access was unavailable in the packaging environment.

## Player experience

- In Account → Preferences, toggle **ENABLE STORY NARRATION**. First enable shows a consent modal that explains an approximately 350 MB download and the third-party model host, on-device resource usage, browser caching, and privacy implications. Nothing is fetched without consent. Both Account Settings and adventure quick-toggle use the same approval flag.
- The full-precision Kokoro 82M ONNX model (`fp32`, about 326 MB) is downloaded at runtime into the browser's cache when possible, with voice/runtime assets on top. The model isn't bundled in the frontend ZIP, app backend, or CloudFront app assets.
- A Web Worker performs model inference; WebGPU is tried when supported, then WebAssembly CPU fallback. Model files normally download only once per browser profile but may be evicted by the browser. Player devices may run out of RAM or take a long time, especially mobile.
- Story Time is optional. No text is sent to `/api/narration/speech`. Generated story context still flows through the existing game AI service; narration does not add model API costs.
- Read Chapter, Read Choices, per-choice Listen, playback, voice/speed/volume, and automatic reading reuse Pass 56 controls. SFX remains separately configurable. No microphone or speech-to-text.
- Third-party model download requests (for example Hugging Face/model delivery hosts) can reveal connection metadata such as IP address to those hosts. The `/privacy` notice explains this. Technical credits and Apache 2.0 license text are accessible at `/legal/story-time-third-party-notices.txt` without prominent brand placement on the game screens.

## Samsung mobile QA checklist

Test Chrome on the Galaxy S24+ and S23, ideally Wi-Fi with other tabs closed:

1. With Story Time off, refresh the page and verify no model download starts.
2. Enable it: verify the consent dialog appears and model downloads **only** after tapping Download & Enable.
3. Wait for **STORY TIME IS READY**, then test voice previews and chapter/choice narration.
4. Change voice and speaking speed; test pause, resume, stop and repeated chapter playback.
5. Background the app, reload the page, reconnect a co-op room, and ensure no stale chapter unexpectedly plays.
6. Check RAM pressure, first-load duration, speech generation latency, data consumption, and model cache survival after refresh.
7. If device inference fails, gameplay must remain usable with narration off. Capture error text and browser version; do not silently downgrade the player's explicitly requested full-quality model.

**Not yet verified:** end-to-end browser inference on either Samsung model, `npm run build` with the new installed dependency, and the AWS frontend deployment. Those must pass on the Mac and staging.

## License and branding

Players see **Story Time**, not the model vendor name. Model and library names are identified in third-party notices, which must remain publicly accessible. The core model conversion and `kokoro-js` library identify as Apache-2.0 licensed. Review transitive dependency notices before commercial release.

## Pass 57 build compatibility and npm advisory triage

The browser package install can introduce Node-specific type declarations into the
frontend TypeScript graph. `window.setTimeout()` produces browser `number` IDs:
Arcade timers should use `useRef<number | null>`, not an inferred `Timeout`
return type. In the Web Worker, validate the incoming narrator voice against
`KOKORO_VOICES` before invoking the typed `kokoro-js` API.

`npm audit --omit=dev` includes vulnerabilities under the installed
`@huggingface/transformers -> sharp` and `onnxruntime-node` dependency paths.
These are Node-native components; Transformers.js selects the web variant for
browser bundles. **An audit warning is still relevant to the development and
supply chain.** Do not treat its presence as proof of browser exposure, or its
absence from browser assets as proof of complete security. Verify that the
`dist/` artifact doesn't contain native Node dependencies and re-run audits
whenever updating dependencies.

The separate `source-map-js` advisory is fixed by 1.2.2. From `frontend/`, run
`npm audit fix` (without `--force`), review `package-lock.json`, and rerun both
`npm audit` and `npm run build`. Any remaining advisories need to be triaged
against what runs at build time versus what ships as static assets. Do not
silence audit errors, disable type checking, or upgrade model dependencies
across major versions solely to make the report appear green.
