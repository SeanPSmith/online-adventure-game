# Tales of Two — Audio & Narration roadmap

## Pass 55 — Browser SFX foundation (implemented locally)

- Browser-native, lightweight Web Audio oscillators: no new server service, network download, or audio file dependency.
- Effects are **off by default**. The browser unlocks an `AudioContext` only after a physical pointer or keyboard action. Unsupported/suspended audio never blocks gameplay.
- Account → Preferences exposes on/off, master, story/effects, and Arcade volume. Settings are retained **per browser** in `localStorage`, not account-synced yet. Every adventure has a quick SFX mute/unmute button.
- Short cues: selection, lock, chapter transition, authoritative dice animation and result, XP, injury, level-up, Hero death, QTE appearance/resolution, and Arcade entry. No high-frequency score sound spam.
- Stable room/turn/Hero/scene/QTE/Arcade event IDs prevent duplicate cues from React rerenders, extra socket snapshots and same-tab refresh/reconnect. Cues are skipped in hidden tabs and when muted.
- `tests/frontend/audio-sfx.cjs` exercises mute/unlock/preferences, event-ID deduplication, zero-volume/background cases and all cue definitions; `scripts/check-project.sh` executes it in the normal release gate.
- **Limits:** The effects are synthesized/retro rather than sampled cinematic assets; Arcade cabinet-specific audio is a later refinement. The test harness validates behavior without playing through mobile browsers; perform a manual iOS Safari, Android Chrome and desktop browser listen test before public rollout.

## Pass 56 — Kokoro TTS narration (NOT implemented)

This is **text-to-speech only**. There must be **no** speech-to-text, voice input, microphone capture or push-to-talk anywhere in the feature.

- Optional Kokoro narration for the story/chapter body and generated choice labels. A player can play a chapter, play all choices in order, or tap a speaker icon on a single choice.
- A continuous listening mode reads the scene, then choices, and waits for a normal click/tap choice before proceeding.
- Independent, per-player preferences for narration enabled, auto-read chapter, auto-read choices, voice, playback speed and narration volume; in-story pause, resume, replay and stop.
- Generate and cache narration keyed by exact published scene text, choice text, voice, and rate; no repeated model inference merely to replay the same audio. Ensure old scene audio stops on scene changes or QTEs.
- Serve synthesis separately from the existing AWS Fargate app and expose an explicit opt-in API. Do not block Director/gameplay responses on narration or ship unvetted model weights in the game container.
- Desktop and mobile browsers must still support a completely text-only experience. Both co-op players choose playback independently.

## Operational and accessibility checks

- Real browser gesture-unlock and mute test, including mobile Safari re-entry/reload and background tabs.
- No duplicate sounds after reconnect, delayed receipts, or returning to an already resolved turn.
- Preserve keyboard/assistive navigation and all visual gameplay feedback; audio never communicates vital information exclusively.
- Avoid sudden loud audio or overlapping looping sounds. SFX and narration must have independent mute and volume controls once narration ships.
