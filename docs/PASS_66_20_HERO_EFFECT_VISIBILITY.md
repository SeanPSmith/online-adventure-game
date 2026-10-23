# Pass 66.20 — Hero effects are understandable everywhere

The server already owns finite Hero effect modifiers (per-effect check modifier cap +/-2; total effects per check cap +/-4), turn duration and check-use duration. The UI previously hid the mechanical bonus/penalty and its check budget in most places. In some views it also counted inactive effects as active.

## Included
- A single read-only effect formatter and ledger shared by the active Inkbound sidebar, classic gameplay Hero panel, full Hero Sheet and private Inkbound Hero folio.
- Show the effect's actual stat/skill bonuses, name, optional description and **both** remaining turn and check budgets; do not confuse a permanent passive effect with a three-turn bonus.
- Filter server-expired/inactive records, including migrated zero-duration records, so empty views are truthful.
- New effects earned on a turn are explained in the existing dice/after-action receipt and in the level-up folio. The result receipt still comes from the server.
- Compact mobile treatment and a count of any conditions hidden by a four-effect sidebar limit.
- Deterministic Node tests compile and execute the pure TS display helper; a static integration assertion covers its readers.

## Intentionally unchanged
- Python character models and actual effect mechanics; no new effect grants, no dice or XP changes, no database or AWS migration.
- Existing room lock/rollback, Director metering/recovery, scene-art jobs, narration and authoring.
- This is a visual description of server values, not an estimate of final check chance. The check engine still selects the strongest relevant modifier per effect, with a combined +/-4 effect cap.

## Acceptance
Run `bash scripts/install-overlay.sh ../assets/AWS/pass66_20_quillairo_hero_effect_clarity.zip && ./scripts/release-staging.sh` from `root`. Verify that a boon and a wound show correct signs, names and lifetimes in the reader and Hero Sheet, then check that a depleted status disappears after an authoritative turn. Confirm the dice breakdown still matches the server, including multiple effect caps. Check mobile sidebar and all six paper palettes.
