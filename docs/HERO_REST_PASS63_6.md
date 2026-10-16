# Pass 63.6 — Passive Hero Rest and Recovery

## Rule

- Every *living* Hero, including retired Heroes, automatically regains **ceil(10% of max HP)** for each **complete hour** out of an active adventure, capped at max HP.
- A Hero in an active room cannot rest; it must leave or finish first. The room authority is checked on the server, not inferred from a browser flag.
- `0 HP` is terminal: dead or buried Heroes are never revived by time, account refresh, level progression, or resting.
- Recovery is computed lazily when the owner lists or opens a Hero; no scheduled jobs or sleep-time server charges. The timestamp is persisted to the Hero's JSON record. The first read of a legacy wounded Hero uses its existing `updated_at` timestamp as the beginning of the resting window.
- Each committed story turn resets `rest_recovered_at`, avoiding credit for time spent in an active adventure. Wounded Heroes are persisted even on a turn with no XP or additional health damage so that the rest clock is not stale.
- Each resting read uses a compare-and-swap UPDATE on the character JSON payload; parallel reads must not stack healing. A future inventory/economy service should still apply the same state-version guard.

## Deferred by design

Currency-based healing, inns, purchases, resurrection and Story Credit integration are **not implemented**. Currency should be added only after a server-authoritative currency ledger and idempotent transactions exist. Do not charge real Story Credits for a heal during this pass.

## Acceptance

1. Finish a live adventure with a Hero at less than maximum HP; confirm no immediate heal.
2. Check the Hero Hall after a full hour outside all active rooms; HP should increase by the documented amount.
3. Refresh repeatedly; HP must not keep increasing until the next whole hour has elapsed.
4. While a Hero is in an active room, HP must not increase from passive rest, including when the owner visits the Hero Sheet.
5. Verify a dead Hero remains at 0 HP after days and still appears in legacy/graveyard, never among playable Heroes.

## Infrastructure

No database table migrations, AWS stack changes, narrator changes or costs associated with a recovery poll. The state uses the existing `characters.payload` JSON; old records deserialize without new required fields.
