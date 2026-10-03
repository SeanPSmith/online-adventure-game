# Tales of Two — Intermission Arcade Micro-Engine

The Intermission Arcade exists to occupy Director generation latency without delaying story generation. A cabinet is a disposable React module running inside the shared intermission shell. It must never own or mutate authoritative adventure state.

## Runtime contract

All cabinets implement `ArcadeGameProps`:

- `score`: current local intermission score, clamped by the shell/server.
- `onScoreChange(score)`: report a new local score.
- `storyReady`: the Director has completed and the shared countdown is running.
- `turnNumber`: deterministic per-turn context for procedural variations.
- `playMode`: `solo` or `coop`.

Cabinets do not submit scores directly, own Socket.IO listeners, call the Director, write Hero XP, or change room state. `IntermissionRuntime` owns score submission and the story-ready handoff.

## Registry

`frontend/src/features/arcade/ArcadeGameRegistry.tsx` is the cabinet catalog. Each definition provides:

- stable cabinet ID
- display title
- category
- short description
- solo/co-op capability
- touch support
- control summary
- `live` status
- React component

New cabinets should be registered as `live: false` first and tested in the Arcade Lab before entering the real intermission rotation.

## Compatibility rule

The backend currently emits six historical intermission slot IDs. Those IDs are still authoritative for score validation and persisted adventure recovery. The React registry maps those server slots to concrete cabinet implementations.

Do not casually change the backend rotation: a persisted turn may have been created under the older deterministic mapping. New cabinet experimentation belongs in the lab until a versioned server-side rotation contract is introduced.

## Arcade Lab

Authenticated route: `/game/arcade`

The lab runs cabinets locally without a room, Director request, Hero progression, or adventure state. Use it for controls, mobile layout, scoring, and feel testing.

## Shared engines

### Three-phase timing shot

`useTimingShotEngine` provides the reusable sequence:

1. aim
2. power
3. modifier
4. resolving

The modifier can represent spin, hook/slice, accuracy, release angle, English, etc. Bowling and Pixel Links are the first consumers.

Good future consumers include darts, pool, field goals, penalty kicks, free throws, skee-ball, shuffleboard, baseball batting, and fishing casts.

## Cabinet rules

1. Story generation starts before the cabinet. Never wait on arcade state to call the Director.
2. A cabinet must tolerate being unmounted at any moment.
3. Clean up timers, animation frames, and listeners on unmount.
4. Keyboard and touch must both work when the mechanic permits it.
5. A broken cabinet must not break the story; `IntermissionGameBoundary` owns the safe fallback.
6. Arcade score is cosmetic/intermission-only. Do not grant Hero XP or mechanical RPG advantage.
7. Prefer procedural layouts/rounds so repeated cabinets still vary.
8. Keep the visual language intentionally cheap: ASCII, CP437/VGA-like geometry, chunky pixels, limited animation. Input and feedback should still feel modern and responsive.

## Contractor boundary

A future developer should normally be able to implement a cabinet inside `frontend/src/features/arcade/games/`, register it, and test it in `/game/arcade` without editing Director, room, persistence, Hero, or AWS code.

## Current cabinet set after Pass 14

Live intermission mapping keeps the six historical server slot IDs stable while choosing these React cabinets:

- `rune_catch` → Find the Outlier
- `lantern_keep` → Terminal Pong
- `relic_scramble` → Missile Defense
- `sigil_memory` → Highway 84
- `ward_breaker` → Maze Runner
- `shadow_step` → Word Cabinet

Arcade Lab additionally exposes Gorilla Artillery, Bowl-O-Matic, Pixel Links, Wall//Breaker, Data Snake, Light//Cycles, and the retired Archery Range. Lab-only cabinets should remain there until playtesting says they are worth promoting.

### Motion-first rule

Timing inputs are not enough by themselves. When a cabinet represents a physical action—bowling, golf, artillery, batting, darts, etc.—the resolve phase should visibly animate the consequence of the player's input. The cheap VGA presentation is intentional; lack of feedback is not.

## Game-feel rules after Pass 17

The arcade now treats readability as part of the engine contract, not optional polish.

- Timing cabinets should expose visible good-result windows and use forgiving meter speeds by default.
- Meaningful outcomes should use the shared `ArcadeFeedback` overlay so hits, misses, wins, crashes, strikes, clears, and score deltas are unmistakable.
- Repeated cabinets should vary board dimensions, speed, traffic density, layout, wind, lane conditions, or other safe local parameters where practical.
- Variation is local/cosmetic unless a versioned server contract says otherwise; it must never change authoritative adventure state.
- Canvas remains the preferred renderer for 2D and pseudo-3D VGA cabinets. Add Three.js only when a cabinet truly benefits from a 3D scene graph/camera (for example first-person racing, a 3D dungeon, or pinball), not merely for animation.
