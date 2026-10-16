#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

say() {
  printf '\n==> %s\n' "$1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 1
  }
}

require_command "$PYTHON_BIN"
require_command node
require_command npm

cd "$ROOT_DIR"

say "Python regression suite"
"$PYTHON_BIN" -m pytest tests -q

say "Legacy browser JavaScript syntax"
node --check app/web/author/author.js
node --check app/web/adventure_ui.js

say "Adventure reconnect regressions"
node --test scripts/tests/adventure-recovery.cjs

say "Lazy route and page-load recovery regressions"
node --test scripts/tests/route-loading.cjs

say "Adventure turn presentation regressions"
node --test scripts/tests/turn-flow.cjs

say "Audio/SFX browser regression checks"
node --test tests/frontend/audio-sfx.cjs

say "Kokoro narration browser regression checks"
node --test tests/frontend/kokoro-narration.cjs

say "Story Time hosted inference regression checks"
node --test tests/frontend/story-time-browser.cjs

say "Story Time playback-speed and cache diagnostics regressions"
node --test tests/frontend/story-time-playback-speeds.cjs

say "Story Time bounded lookahead, pause and cancellation regressions"
node --test tests/frontend/story-time-buffered-playback.cjs

say "Pass 63.4 gameplay fairness and narration presentation regressions"
node --test tests/frontend/pass63-4-gameplay.cjs

say "Story Time co-op narrator and reconnect regressions"
node --test tests/frontend/story-time-coop.cjs

say "Story Time dramatic pacing and dialogue regressions"
node --test tests/frontend/story-time-dramatic-pacing.cjs

say "Story Time expanded voice library and mid-adventure narrator switching"
node --test tests/frontend/story-time-voice-library.cjs

say "Story Time cancellation, stale playback, and startup reliability regressions"
node --test tests/frontend/story-time-reliability.cjs

say "Story Time cache-source and latency diagnostics regressions"
node --test tests/frontend/story-time-performance.cjs

say "Completed Chronicle audio archive regression checks"
node --test tests/frontend/story-time-archive.cjs

say "Completed adventure quality and cost diagnostics"
node --test tests/frontend/playtest-diagnostics.cjs

say "Hero Hall and Graveyard browser regressions"
node --test tests/frontend/hero-legacy.cjs

say "Author AI proposal review and explicit apply regressions"
node --test tests/frontend/author-ai-review.cjs

say "React production build"
(
  cd frontend
  npm run build
)

say "AWS CDK TypeScript build"
(
  cd infra
  npm run build
)

printf '\nPROJECT CHECKS PASSED\n'
