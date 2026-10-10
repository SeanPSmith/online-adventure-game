# Pass 55 — Web Audio / SFX plan (proposal, not implemented)

## Goals
Use subtle, fantasy-appropriate sounds to clarify player actions and increase emotional impact without slowing turn flow or obscuring prose. The game remains completely usable with sound off.

## Technical approach
- Introduce one `AudioDirector` service wrapping the browser Web Audio API (`AudioContext`). Create/unlock it on a **real user gesture**; never autoplay at page load. Respect mobile Safari resume requirements.
- Two-tier assets: synthesize lightweight UI ticks, confirmations and dice impacts with oscillators/noise envelopes; supply short compressed OGG/MP3 samples for richer arcade cues and climactic moments. Lazy-load the assets only where needed.
- Central sound categories: `ui`, `story`, `dice`, `qte`, `arcade`, `alert`. Volume mixer with master, effects, optional ambient; user preference persisted to local storage/account settings when available.
- Browser/mobile policies: one-shot sounds only after consent/gesture, cap concurrent voices, stop on unmount, mute background tabs, respect OS audio and reduced-motion preferences. No narration/video/audio automatically injected.
- De-duplicate by stable turn receipt / QTE event ID, not rerenders or socket event count, so recovery never replays a celebration or death sound.

## Suggested sound palette
- **UI:** parchment click, quiet button press, selection lock, modal open/close.
- **Dice:** restrained roll/rattle, result settle; distinctive but brief success, failure, critical, and critical fail flourishes.
- **Story:** page turn, opening-chapter swell, next-chapter reveal, low-volume suspense pulse while Director writes (opt-in, not continuous by default).
- **Combat & progression:** injury thud, restoration, XP sparkle, level-up fanfare; solemn fatal bell for the death acknowledgment.
- **QTE:** three low-key warning pulses, one crisp confirmation, separate neutral and fail cues; sound never substitutes for the visual timer.
- **Arcade:** cabinet-specific interaction effects with shared volume and mute settings; no high-frequency score spam.

## Rollout and tests
1. Core audio service, mute/volume settings and explicit audio unlock.
2. UI + dice + XP/death cues, keyed to server-authoritative event IDs.
3. QTE and Arcade cues, voice caps and throttling.
4. Manual QA: Chrome/Safari/Firefox, iOS/Android, keyboard, silent mode, tab switching, reconnects, accessibility, performance, no console errors.

**Acceptance:** muted by default until user activation, visual-only play remains identical, repeated socket snapshots never repeat cues, no clipped/distorted stacking, and no audio that overrides assistive technologies.
