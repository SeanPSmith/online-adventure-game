## 2026-10-01 — Gameplay Stability Pass 06

### Practical changes
- Hardened Director failure recovery so unexpected generation/runtime exceptions preserve authoritative TurnFacts and surface a retryable state rather than trapping the client in an intermission.
- Added an always-visible Adventure sidebar recovery control for pending Director retries in addition to the Turn Theater recovery screen.
- Closed the accidental co-op-as-solo resolution path: co-op rooms must reach the configured party size before Python will resolve a turn; explicit solo mode remains one-player authoritative.
- Added confirmation before converting an empty co-op room to solo.
- Rebalanced failed-check XP to award partial credit based on authoritative total-vs-DC proximity, with a 15% floor, 65% normal-failure ceiling, and 20% critical-failure ceiling. Success and critical-success bonuses remain intact.
- Added check total/DC/proximity details to server-owned XP breakdowns.
- Added a generated-adventure synopsis preflight to the React Adventure Hall using the seed's `player_synopsis` metadata before room creation.
- Added session-scoped last-game-route memory so Account and the full Author Console return to the active Adventure when possible instead of the public homepage.
- Activated the Party Chat ASCII-face picker that had previously been disabled during the React migration.

### Validation
- 39 focused backend tests passed across progression, co-op/solo room behavior, generated synopsis, rooms, micro-events, and Director runtime.
- Changed backend modules compile successfully.
- Changed TS/TSX files pass TypeScript syntax transpilation.
- Author Console JavaScript passes Node syntax validation.
