# Pass 66.74 — Kokoro narration parity in Quillairo (fixes the Pass 66.73 release gate)

Pass 66.73 removed the Classic reader. Narration itself (Story Time, Kokoro voices, auto-read, caching, buffering,
co-op narrators, archive audio) was never touched, but several narration *controls* had only existed in the
Classic layout, and six Node regression checks in `tests/frontend/*.cjs` (which the release gate runs, and my
Pass 66.73 verification wrongly skipped) were pinned to Classic's labels. This pass fixes both.

## Restored in the Quillairo menu / choice cards
- **Follow voice** toggle (on/off, default on)
- **Narration status** line: preparing voice, buffering next passage, reading, paused, error
- **Voice performance · this browser** panel: replay / memory / S3 / generated counts, last source and timings, Reset counters
- **Your voice · name · volume** label next to the voice picker
- **Listen** button on every choice card: reads one choice aloud without selecting it (a sibling of the choice
  button, not nested inside it)

Already present and unchanged: Story Time on/off, voice picker, reading speed, dramatic pacing, read chapter
aloud, read choices aloud, pause / resume / stop, auto-read.

## Tests
Node: hero-effects, kokoro-narration, story-time-buffered-playback, story-time-coop, story-time-dramatic-pacing,
story-time-performance, story-time-playback-speeds now assert the Quillairo labels. New pytest
`test_pass66_74_kokoro_narration_parity.py`. Verified with the real `scripts/check-project.sh` (all stages,
including every Node narration suite, the production build and the CDK build): PROJECT CHECKS PASSED.
