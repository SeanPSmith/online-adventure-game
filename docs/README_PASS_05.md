# Tales of Two — React Intermission Arcade Pass 05

This pass replaces the broken ASCII artillery slot with a broader native React arcade/puzzle cabinet.

## Backend changes

None.

The existing Python intermission contract remains authoritative:

- `story_advancing.game_id`
- `story_advancing.turn_number`
- `submit_intermission_score`
- intermission win tracking
- Director timing
- story-ready timing

The six existing server `game_id` values are intentionally reused, so active/persisted adventures remain compatible.

## Current cabinet mapping

- `rune_catch` -> Find the Outlier
- `lantern_keep` -> Terminal Pong
- `relic_scramble` -> Missile Defense
- `sigil_memory` -> Archery Range
- `ward_breaker` -> Maze Runner
- `shadow_step` -> Word Cabinet
  - first cycle: Word Search
  - next cycle: Hangman
  - alternates every time that server slot comes around

ASCII Artillery is removed from the React rotation for now.

## Controls

### Find the Outlier
Mouse/touch or WASD/arrows + Enter.

### Terminal Pong
W/S or Up/Down. Mouse/touch tracks the left paddle.

### Missile Defense
Click/tap the sky to launch. WASD/arrows move reticle; Space fires.

### Archery
Mouse/touch or WASD/arrows move reticle. Click/tap, Space, or Enter shoots.

### Maze Runner
WASD/arrows or on-screen directional controls.

### Word Search
Select the first and last letter of a listed word. Words may be forward or backward.

### Hangman
Click/tap letters or type letters on a physical keyboard.

## Resilience

The cabinet now has a React error boundary. A render/lifecycle failure in an individual mini-game falls back to a simple safe scoring interaction rather than replacing the entire intermission surface.

## Install

Replace the entire current:

`frontend/src/`

with the `frontend/src/` contained in this package.

No backend files change and there are no new npm dependencies.

Then:

```bash
cd frontend
npm run dev
```

## Recommended smoke test

Because the Python server rotates through six deterministic game IDs, the easiest development test is to temporarily exercise the components through normal turns or use React dev editing to map the current `game_id` to the desired component locally.

For each game verify:

1. score changes
2. mouse input
3. keyboard input where applicable
4. touch layout at narrow width
5. Skip still submits score
6. Story Ready gives the existing final countdown
7. score is submitted only once
8. Adventure proceeds into the authoritative turn-resolution theater
