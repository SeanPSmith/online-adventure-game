# Tales of Two — Practical Development Changelog

This file tracks player-visible behavior, architecture changes, validation results, and important implementation notes. Future patch bundles should append to this file.

---

## 2026-10-01 — Scoped AI Author Helpers + Admin Control Room Telemetry

### Authoring helper safety
- Replaced the broad whole-document **AI POPULATE GAPS** control with contextual AI helpers. Static prose fields now receive a compact **AI** pill and every repeatable Author item (World Truth, Location, NPC, Lore/Secret, Moment, Forbidden Rule, Story Thread) receives an **AI ITEM** pill.
- All helpers open one focused modal that asks for a single rough sentence. Field mode rewrites only the explicitly selected text field; item mode expands only blank/default fields inside the selected repeatable item while preserving authored canon.
- Added strict server-side field-path allowlisting. AI field assistance cannot target slug/document identity metadata, selects, booleans, ranges, or arbitrary JSON paths.
- Field requests use the economy Author model with a smaller output ceiling than full structured item expansion, reducing latency and token waste for tiny edits.
- Existing draft-save, stale-revision protection, autosave, versioning, and Author permissions remain authoritative. AI still never publishes source material automatically.

### Superuser control room
- Added read-only `/api/auth/admin/analytics`, protected by the existing administrator dependency. The first telemetry pass derives data from tables and runtime state the game already owns rather than injecting new writes into turn resolution.
- Added live operational counts for current rooms, online players, solo/co-op rooms, room state, current adventure/turn, and the usernames/Heroes attached to each active room.
- Added account/activity totals: registered accounts, Authors, recently active authenticated users, completed adventures, completed turns, average run length, generated stories, and approved generated stories.
- Added Popular Adventures, Top Players by completed turns, recent completions, and a 14-completion-day activity view. The Admin page refreshes telemetry every 10 seconds so the Control Room behaves like a live operations surface.
- Added a direct **ARCADE LAB** action to the Control Room and an Admin-nav **ARCADE** item.
- Analytics v1 intentionally reports durable completed-history statistics plus current live rooms. It does not yet instrument abandoned/incomplete historical runs or detailed arcade cabinet usage; those can be added later through a dedicated event ledger without risking the story hot path.

### Validation
- Added field-assist safety tests, including repeatable-item text paths and rejection of protected slug mutation.
- Added SQLite analytics aggregation coverage for accounts, auth activity, completed adventures, turns, player rankings, and recent history.
- Updated Author/UI contract coverage for scoped modal helpers, live Admin telemetry, and Arcade navigation.
- Full Python regression suite: **147/147 passing**.
- Legacy Author JavaScript syntax validation passes.

## 2026-10-01 — Intermission Arcade Micro-Engine Pass

### Arcade framework
- Added a typed React arcade registry that separates server intermission slot IDs from concrete cabinet implementations. The existing six live intermission games remain mapped exactly as before, so persisted adventures and score validation are unchanged.
- Migrated the React `IntermissionRuntime` away from a hard-coded game switch and onto the registry/component contract. Existing score submission, story-ready countdowns, skip behavior, error boundary, and Director sequencing remain intact.
- Added shared arcade metadata for category, input support, solo/co-op capability, controls, description, and live/lab status so future cabinets can be added without changing the intermission shell.
- Added a reusable three-phase timing-shot micro-engine (`aim -> power -> modifier -> resolve`) driven by `requestAnimationFrame`, plus shared VGA meter UI. This is the base mechanic for bowling, golf, darts, pool, penalty kicks, and similar timing games.
- Added `docs/ARCADE_MICRO_ENGINE.md` documenting the cabinet contract, safety boundaries, live-vs-lab promotion rule, and contractor-facing extension path.

### New cabinets / testing lab
- Added **BOWL-O-MATIC**, a VGA/ASCII three-tap bowling prototype with aim, power, spin, strike detection, touch button, and keyboard controls.
- Added **PIXEL LINKS**, a closest-to-the-pin golf prototype with aim, power, shot shape, wind, touch button, and keyboard controls.
- Registered the existing ASCII projectile duel as **GORILLA ARTILLERY** so it can be exercised through the same cabinet interface.
- Added authenticated `/game/arcade` **INTERMISSION ARCADE LAB** plus an Adventure Hall link. The lab can launch, restart, and score every registered cabinet without starting an adventure or making a Director request.
- New experimental cabinets are intentionally marked `LAB ONLY`; they are not yet added to the live server rotation. This lets us test mechanics and mobile behavior without changing in-progress adventure compatibility.

### Validation
- Added source-contract coverage for registry-driven intermission rendering, preservation of all six existing server slot IDs, the Arcade Lab route, and the shared timing engine.

## 2026-10-01 — AI-Assisted Authoring + Storefront Copy Pass

### Author workflow
- Added a reusable server-backed AI authoring assistant at `/api/author/assist`, protected by the same private Author write policy as normal source edits.
- Added **ONE-SENTENCE POPULATION** to the Author console. A rough note can now fill blank fields and untouched template defaults across a sparse World or Adventure Brief while preserving document identity, canon, and already-authored text.
- Added per-item **AI EXPAND** controls for world truths, locations, NPCs, lore/secrets, moments, forbidden rules, and story threads. This supports deliberately rough notes such as an unnamed riddle-speaking entity or an ordinary farm field that should matter later.
- AI assistance uses the configured economy model / low-reasoning profile by default so authoring help stays fast and inexpensive without changing runtime Director quality.
- AI changes remain draft-only and are never published automatically. The helper saves the current draft before generation, refuses to apply a stale result if the document changes while the model is working, then feeds accepted changes back through the existing autosave/versioning flow.
- Merge behavior is intentionally conservative: non-empty authored text is preserved; list sections are populated only when empty; document title/slug/type identity cannot be rewritten by the helper; explicit unnamed-NPC constraints prevent the helper from assigning a proper name.

### Generated adventure storefront copy
- Strengthened Adventure Seed instructions so `player_synopsis` must be finished player-facing teaser copy rather than cleaned-up Author notes.
- Added a quality guard that detects a too-short, single-sentence, or near-copy synopsis. Weak copy receives one separate fast economy-model storefront pass using only spoiler-safe public planning data.
- Synopsis polishing is non-fatal: a failure in the optional copy pass never prevents an otherwise valid Adventure Seed from being generated.
- Runtime catalog behavior is unchanged: generated adventures still expose `player_synopsis` to the Adventure Hall while premise, hidden truths, and Director planning data remain internal.

### Validation
- Added merge-safety coverage for whole-document population and structured NPC expansion, including explicit unnamed-character constraints.
- Added storefront-copy detection coverage proving raw Author-pitch echoes are polished while distinct multi-sentence teasers are retained.
- Added Author UI contract coverage for the document and per-item AI controls.
- Full Python regression suite: **140/140 passing**.
- Legacy Author JavaScript syntax and modified Python module compilation pass.

## 2026-10-01 — Recovery Escape + Director Hard-Timeout Hotfix

### Recovery safety
- Added a server-backed emergency exit directly to the React Adventure Hall. Hosts can permanently abandon a wedged active room without reopening it; non-host members can leave their Hero from the dashboard. A confirmation modal prevents accidental deletion.
- Active-journey rows now expose durable Director state (`DIRECTOR WORKING`, `RECOVERY REQUIRED`, `TURN FROZEN`, or `READY`) so a persisted generation problem is visible before entering the room.
- Added a 12-second resume watchdog. Restoring an existing adventure is local state/database work and should never leave the browser on `RESTORING THE THREAD` indefinitely; a stalled restore now resolves to a visible error with a direct return to the Adventure Hall.

### Director lifecycle
- Replaced the nominal `asyncio.wait_for()` wall-clock guard with an explicitly tracked Director task plus `asyncio.wait()`. At the hard deadline the room immediately returns to its durable retry state instead of waiting for a provider coroutine to finish cancellation cleanup.
- Added per-room Director task tracking and cancellation. Abandoning a room (or removing its final member) cancels any in-flight generation first.
- Added a pre-commit existence/identity guard so a late OpenAI response can never resurrect a room/session that was abandoned while generation was running.
- Director failure paths now refresh the account adventure list after the retry state is persisted, keeping dashboard recovery status current.

### Regression coverage
- Added UI-contract coverage for dashboard abandon/leave controls, recovery-state visibility, the resume watchdog, and tracked Director-task cancellation.

---

## 2026-10-01 — Legacy Solo Room Recovery Hotfix

### Gameplay flow
- Fixed a post-retry deadlock affecting adventures that were created by an older build as `coop` rooms with only one Hero. The newer co-op party gate correctly requires two room members, so after a recovered Director turn committed successfully, the next locked choice could sit forever at `LOCKED` without emitting the countdown/intermission/generation transition.
- Added a narrow durable migration: a one-player room still marked `coop` is converted to `solo` only when the session proves gameplay already started (`turn_number > 1`, a committed `last_resolution`, or frozen `pending_turn_facts`). Fresh one-player co-op lobbies are never auto-converted and continue waiting for a second Hero.
- The repair runs both when the adventure is resumed and immediately before the normal party gate after a choice submission, so an already-open stranded adventure can recover without being recreated.
- Repaired play mode is persisted back to the room snapshot and broadcast so subsequent turns, intermissions, and reconnects consistently behave as solo.

### Regression coverage
- Added tests proving progressed/frozen legacy one-player co-op sessions migrate to solo.
- Added a guard proving a fresh one-player co-op lobby remains co-op.
- Added source-contract coverage that both resume and choice-submission paths invoke the compatibility repair before the normal co-op party gate.

---

## 2026-10-01 — Director Retry Recovery Hotfix

### Gameplay reliability
- Fixed a recovery deadlock where a Director timeout correctly preserved `pending_turn_facts`, but `retry_pending_turn` then re-ran the current room/submission readiness gate and could reject the already-frozen turn as "incomplete."
- A persisted `pending_turn_facts` snapshot is now treated as the authoritative retry contract. Retry reuses the exact locked choices and dice results without requiring players to re-lock, reroll, or reconstruct transient readiness state after a reconnect/restart.
- The normal initial-turn party gate remains unchanged; co-op still cannot resolve a fresh turn until the required Heroes are present and locked.

### Recovery UI
- Consolidated Director generation failure/retry presentation into the existing centered Turn Theater modal.
- Removed the duplicate sidebar recovery panel.
- If a retry attempt itself returns an error while the server still advertises `director_retry_required`, that message now stays in the retry modal instead of rendering as a clipped red sidebar error.
- The generic `ASK THE SERVER WHAT HAPPENED` panel remains available for non-Director errors only.

### Regression coverage
- Added source-contract coverage that the retry handler does not re-run `all_players_ready()` once authoritative pending TurnFacts exist.
- Added frontend coverage that Director retry errors remain in Turn Theater and no duplicate sidebar retry panel is rendered.

---

## 2026-10-01 — Repository Guardrails + Gameplay Stability Regression Lock

### Infrastructure / workflow
- Added a source-only `scripts/package-for-review.sh` archive command that excludes dependencies, build products, caches, historical backups, local databases, logs, Git history, credentials, certificates, and `.env` secrets.
- Added `scripts/check-project.sh` as the single local preflight command for Python tests, legacy browser-JavaScript syntax, the React production build, and the CDK TypeScript compile.
- Added `.gitignore` coverage for generated/dependency/secret material and `_packages/`.
- Added `.nvmrc` and Node engine metadata requiring Node 22.22.0+, matching the React Router 8 toolchain requirement.
- Added `requirements-dev.txt` so a clean development/CI environment installs the production/AWS dependencies plus pytest explicitly.
- Added `.github/workflows/ci.yml`. GitHub now has a CI-only pipeline for backend tests, React production build, legacy browser-JavaScript syntax, and CDK compile on pushes/pull requests/manual runs. CI intentionally does not deploy AWS yet.
- Added `docs/DEVELOPMENT_WORKFLOW.md` documenting the local check, Git push, AWS staging deploy, and review-package commands.

### Baseline regression cleanup
- Restored native spellcheck to the Author document form and dynamically-created text controls.
- Restored structured NPC authoring controls for availability, introduction timing, occupation/affiliation, introduction conditions, location constraints, and forbidden uses.
- Reattached those structured NPC fields as deterministic hard canon constraints for seed generation while leaving default `flexible` / `anytime` values unconstrained.

### Gameplay stability coverage
- Added React-source regression coverage for the AI-generated player synopsis handoff, Director retry control, contextual Return to Game route memory, and interactive ASCII chat picker.
- Existing server tests continue to cover co-op party gating, explicit solo behavior, frozen-turn retry, proximity-scaled failure XP, and generated synopsis persistence.

### Validation
- Full Python regression suite: 125/125 passing.
- `author.js` and `adventure_ui.js` syntax checks pass.
- Shell syntax checks pass for the new project-check and review-package scripts.
- Review package generation was exercised successfully and produced a source-only archive of roughly 0.5 MB from this snapshot.
- React/CDK compilation is also enforced by GitHub CI; local dependency reinstall could not be completed in the review container before its package-manager transport timeout.

---

## 2026-09-28 — Production UI Pass 02: Definitive Adventure Skin

### Practical changes
- Replaced the conservative first UI pass with a visually explicit Modern Terminal adventure skin so the live Adventure screen immediately reflects the approved design direction.
- Strengthened the main story frame with hard rectangular borders, dark terminal panels, brighter green hierarchy, and a framed ASCII scene-art stage.
- Increased player-facing story and small-system-text contrast for readability while preserving the monochrome terminal language.
- Rebuilt live choices as a fixed two-column desktop grid with one-column mobile fallback, square cards, separate inspector controls, and inverse selected/hover states.
- Restyled live turn resolution as two side-by-side result cards on desktop while preserving the existing authoritative dice/roll implementation.
- Tightened the right control rail so Turn Status, Hero HUD, and Party Chat read as one coherent control surface rather than unrelated legacy panels.
- Restyled Party Chat as a dense IRC/terminal transcript with square controls and stronger text contrast.
- Preserved all existing Director, dice, XP, effects, persistence, intermission, and gameplay-state behavior; this pass is presentation/layout only.

### Validation
- `app/web/adventure_ui.js` JavaScript syntax validation passed.
- Existing production UI behavior from Pass 01 remains intact; only the visual skin/cache version changed in this pass.

---

## 2026-09-26 — Phase I: Quick Micro-Events

### Practical changes
- Added lightweight, deterministic micro-events between selected AI-directed story nodes.
- Micro-events appear every third resolved story turn, never during wrap-up/finale, to break the repeating story → choice-menu rhythm without becoming spammy.
- Events are generated entirely on the server from current story context; they do not make another AI/model request.
- Each living Hero answers independently in co-op; main story choices remain locked until all required Heroes have responded.
- Added four event families: Quick Reaction, Gut Check, Found Something, and Split Second.
- Reactions persist through refresh/reconnect and become durable narrative facts in `micro_event_history` plus per-Hero world flags.
- Recent micro-event outcomes are supplied to the Story Director as established continuity on later turns.
- Added a dedicated responsive quick-event modal with mobile containment and a short party-resolution reveal.
- Preserved the Phase-B transition contract: quick events never visually leak through the intermission or `STORY READY` countdown.

### Result
- The core loop now has short player interactions between some full Director turns without increasing model cost or adding a second source of story authority.
- Quick-event state is server-authoritative, durable, reconnect-safe, and cannot be skipped by submitting a normal story choice.
- Live regression suite: 99/99 tests passing.
- Python compile validation passed.
- `adventure_ui.js` JavaScript syntax validation passed.

---

## 2026-09-25 — XP / Level Progression Pass

### Practical changes
- Replaced flat/check-only XP rewards with deterministic risk-weighted XP.
- Added six XP risk bands: Safe, Low, Moderate, High, Severe, Extreme.
- Higher-level Heroes now receive a small fixed XP-rate multiplier (+4% per level, capped at 1.75x).
- Success and critical success increase earned XP, while failure still earns the risk reward.
- Resolved turns now carry a complete XP breakdown (`base_xp`, risk, level multiplier, outcome multiplier, final XP).
- Choice rows now preview risk and a Hero-level-adjusted XP amount/range before lock-in.
- Hero HUD now displays the current XP-rate multiplier.
- Server now explicitly detects threshold crossings and reports `leveled_up`, previous/new level, and levels gained.
- Added an ASCII-style level-up celebration after the intermission/story reveal.
- Added `docs/PROGRESSION_SYSTEM.md` as the authoritative progression reference.

### Result
- XP and level calculations are server-owned and deterministic; the Director cannot invent XP values.
- Riskier choices are materially more rewarding.
- Leveling is now a visible event rather than a silent number change.
- Live regression suite: 84/84 tests passing.
- Python compile validation passed.
- `app.js` and `adventure_ui.js` JavaScript syntax validation passed.

---

## 2026-09-25 — Story Pacing Pass

### Practical changes
- Shortened resolution narration to roughly 1–2 short paragraphs.
- Shortened current scene prose to roughly 2–4 short paragraphs.
- Reduced memory-summary and choice-description size limits.
- Director explicitly avoids re-explaining already established context.
- Increased late-game provider output headroom without increasing desired player-facing prose.

### Result
- Faster-reading turns with less repeated context.
- Reduced pressure on strict structured output during late-game/finale turns.
- Reported validation: 70/70 live tests passing.

---

## 2026-09-25 — Director Choice Quality Pass

### Practical changes
- Choices now carry title/description plus archetype, tone, risk, reward, impact, possible gains, and possible costs.
- Director must provide meaningful tactical and tonal contrast instead of six near-equivalent actions.
- Requires multiple risk bands and multiple archetypes in larger choice sets.
- Requires at least one genuinely high-risk option and one scene-shifting option.
- Prevents a repetitive free "safe" option from appearing as the default answer every turn.
- Rich choice metadata is preserved in the server scene model for later Fallout-style card UI.

### Result
- Choice generation has stronger risk, personality, aggression, weirdness, and consequence diversity.
- Reported validation: 70/70 reconstructed tests passing.

---

## 2026-09-25 — Story Stability Pass

### Practical changes
- Increased Director output headroom after late-turn JSON truncation was observed.
- Added one constrained malformed/truncated JSON completion/repair path.
- Previous-turn recap/results were moved directly below the Hero HUD and above the current story.
- Intermission entry/exit countdowns were shortened to 3 seconds and rendered with ASCII numerals.

### Result
- A nearly complete generated turn is less likely to be discarded only because output was cut off mid-JSON.
- Turn presentation now reads: Hero → Previous Turn / Dice / Resolution → Current Story.
- Reported validation: 75/75 tests passing.

---

## 2026-09-25 — Author Access + Turn Reveal Pass

### Practical changes
- Existing authored-document ownership now qualifies a user for Author access even when an explicit author allowlist exists.
- Resolved story content is buffered while the intermission modal remains active.
- Dice/results/current story reveal only after the final intermission fade.
- Adventure story pane resets to the top for every newly generated turn.

### Result
- Existing creators are no longer accidentally locked out of `/author` by allowlist configuration.
- New story content no longer renders underneath an active minigame/intermission modal.
- Reported validation: 75/75 tests passing.

---

## 2026-09-24 — Director Structured Output / Recovery Work

### Practical changes
- Added detailed Director request/response timing and payload instrumentation.
- Confirmed OpenAI transport and structured-output API path independently.
- Fixed strict-schema/Pydantic boundary mismatches for consequence mechanical modifiers.
- Added deterministic normalization and a constrained repair pass for semantically fixable structured output.
- Added hard Director wall-clock timeout behavior with hidden SDK retries disabled.
- Frozen turn facts are retained across retry; retry does not reroll player choices/dice.
- Socket reconnect automatically resumes the active adventure after server/network reconnect.

### Result
- Failures became diagnosable by stage rather than appearing as an indefinite "thinking" state.
- Successful Director generation was confirmed in production logs after the fixes.
- Retry safely reuses authoritative turn facts.

---

## 2026-09-24 — Turn Lock / Intermission Flow

### Practical changes
- Clicking a choice now selects it; an explicit `LOCK IN CHOICE` action commits it.
- Once all required Heroes are locked, a countdown begins before story generation/intermission.
- Minigame modal remains active for the entire Director/API wait.
- `STORY READY` triggers a final countdown and fade into the resolved turn.
- Solo intermissions use score/run behavior rather than fake competitive wins.
- Intermission state can be reconstructed from durable game state after a dropped transient socket event.

### Result
- Turn commitment feels deliberate and dramatic instead of an accidental one-click submit.
- Waiting time is now a first-class product surface rather than dead latency.
- Reported validation reached 84/84 tests during this sequence.

---

## 2026-09-24 — Hero HUD / Persistence / Mechanical Effects

### Practical changes
- Added live ASCII Hero HUD with HP, level, XP progress, core stats, and active effects.
- Added persistent Hero XP and idempotent XP event storage.
- Added persistent consequences/effects to Hero records.
- Status effects can apply bounded server-authoritative stat/skill modifiers to checks.
- Effect duration is consumed only by relevant checks.
- Lifetime adventure/check/critical statistics are stored independently of truncated Director prompt history.

### Result
- Hero state survives reconnects and future adventures.
- Status effects are visible and mechanically meaningful without letting the AI directly alter roll math.
- Reported validation reached 83/83 tests for the mechanical-effects pass.

---

## 2026-09-24 — Solo Adventure Mode

### Practical changes
- Added one-way `START SOLO` conversion while the host is alone before play begins.
- Solo rooms require one locked choice; co-op rooms continue requiring both Heroes.
- Director receives explicit solo-mode context and adapts scenes around one player-controlled Hero.
- Solo state persists across reconnect/restart and blocks late second-player joins.

### Result
- The same adventure engine now supports one-player and two-player play without a separate forked rules engine.
- Reported validation: 74/74 tests passing at initial solo-mode completion.

## Adventure Finale / Journey Closure

### Practical change
Completed adventures now have an explicit closure flow instead of leaving the player trapped on the final scene.

### Player experience
- The final generated scene remains on screen so players can read the ending at their own pace.
- A new `END THE JOURNEY` action appears only after the Director marks the adventure complete.
- Activating it runs a short 3-second archival countdown and opens the finale recap.
- The finale works for solo and co-op rooms.
- Each Hero receives a Journey Rank and a progression recap.
- The recap shows starting level, ending level, XP earned during the adventure, check/success/critical totals, and level-up turns.
- Co-op finales show both Heroes and a party-level rank.
- `RETURN TO ADVENTURES` closes the completed run and returns to the adventure/lobby view.

### Architecture
- Adventure-scoped progression stats now retain `starting_level`, `ending_level`, `xp_earned`, and level-up milestones alongside the existing authoritative check totals.
- Completion payloads are built server-side so both players see the same authoritative finale data and reconnect state does not depend on browser-only arithmetic.
- Existing completed-adventure history recording remains intact.

### Files changed
- `app/main.py`
- `app/game/session.py`
- `app/web/adventure_ui.js`
- `app/web/adventure_ui.css`
- `app/web/index.html`
- `docs/PROJECT_CHANGELOG.md`

### Validation
- 83/83 reconstructed current regression tests passed.
- Python compile validation passed for the modified server/session files.
- Browser JavaScript syntax validation passed for `adventure_ui.js`.

## Finale Resume Recovery

- Completed adventures now rebuild and resend their finale payload when resumed.
- Resuming from the final turn restores the END THE JOURNEY state instead of leaving the player on a dead completed scene.
- The adventure pane resets to the top when the completed/finale state is restored.
- The existing finale flow remains explicit: read the ending first, then choose END THE JOURNEY to launch the recap/countdown.
- Updated adventure UI cache version to v053.
- Validation: Python compile and JavaScript syntax checks passed.



## Finale visibility + fantasy copy

- Moved the completed-adventure `END THE JOURNEY` call-to-action directly beneath the final scene body instead of leaving it at the bottom of the entire game panel.
- Completed adventures resumed from a saved final turn continue to restore the finale payload and now expose the ending action in the actual story flow.
- Rewrote finale UI copy in a more fantasy-RPG voice (`THE LAST WORD HAS BEEN SPOKEN`, `SEALING THE CHRONICLE`, `PARTY RENOWN`, `RETURN TO THE HALL OF ADVENTURES`).
- Added a short closing invitation beneath the final scene so the player understands that the tale is complete and the recap awaits.
- No server, Director, XP, status-effect, or persistence mechanics changed in this patch.


## Critical Roll Celebration Overlay

### Practical change
- Critical successes now trigger a three-second green fantasy-terminal celebration splash when the resolved die outcome is revealed.
- Critical failures trigger a three-second red/glitch splash with an ASCII blood-streak treatment.
- The splash is presentation-only: no roll, XP, Director, persistence, or progression logic changed.
- Multiple critical outcomes are queued so co-op crits cannot visually overlap one another.
- Reduced-motion preferences disable the jolt/pulse animation while preserving the result announcement.

### Result
- Critical rolls are now unmistakable player events instead of being conveyed only by the roll card text.
- The effect runs during the existing previous-turn resolution reveal, after the intermission transition has cleared.

## 2026-09-25 — Sustained Adventure Doctrine + Party Wrap-Up

### Practical changes
- Promoted sustained-adventure pacing into the permanent Story Director instructions.
- Target length is explicitly treated as a soft pacing budget rather than a countdown.
- Director is instructed to reuse established NPCs, locations, clues, threats, relationships, and unresolved threads; side paths and failures must meaningfully alter the adventure.
- Preserved the richer choice contract: contrasted archetypes, visible risk/reward/impact metadata, possible gains/costs, varied DCs, and at least one consequential high-risk/scene-shifting option in larger menus.
- Preserved short player-facing story beats and bounded late-game token headroom to reduce reading load while avoiding structured-output truncation.
- Added `WRAP UP ADVENTURE` for AI-directed journeys after play has begun.
- Solo: one confirmation starts a three-resolution finale runway.
- Co-op: every Hero in the room must acknowledge the wrap request before it activates.
- Wrap-up vote state and remaining turns persist through snapshots/resume.
- During wrap-up the Director is forbidden from opening major new threads and must converge existing story state.
- The first two wrap-up resolutions advance convergence without completing the adventure; the third resolution must complete the story and return an epilogue.
- Added fantasy-flavored live status text for votes and final-chapter countdown state.

### Validation
- Python compile validation passed for Director, schema, session, persistence, and main server files.
- `adventure_ui.js` syntax validation passed.
- Live reconstructed test suite: **86/86 passing**.
- Added regression coverage for wrap-up snapshot restoration and three-turn countdown decrement.

## 2026-09-25 — Authoritative Hero HP / Damage / Healing Foundation

### Practical change
- Director consequences can now propose an immediate `health_delta` alongside narrative/status-effect consequences.
- Server remains authoritative over HP and clamps all applied health changes.
- Damage cannot reduce HP below 0; healing cannot exceed max HP.
- Per-turn net health movement is capped to -5 damage / +4 healing.
- Applied health consequences receive durable idempotence keys so a consequence carried forward in story state cannot repeatedly damage/heal the Hero on later turns.
- Character persistence now stores the applied-health-event ledger.
- Hero progression payload now includes health before/after/change and health-event details.
- Live Hero HUD updates immediately after resolution and surfaces WOUNDED / CRITICAL CONDITION / FALLEN states.
- HUD status line reports immediate wound/recovery feedback and the Director-described cause.

### Director guidance
- HP loss is reserved for genuine bodily danger (attacks, falls, burns, poison, crushing force, etc.).
- Social/investigative failure should normally cost trust, time, leverage, opportunity, position, or information instead of HP.
- Physical damage scales roughly with declared choice risk, but failure does not automatically cause damage.
- Healing is rare and requires actual medicine, rest, magic, or equivalent fictional recovery.

### Deliberate boundary
- Reaching 0 HP is now mechanically possible and visible, but permanent death/choice-lockout is intentionally deferred to the next isolated Hero-lifecycle patch.

### Validation
- Reconstructed live suite: 85/85 tests passing.
- Character health-event persistence round-trip smoke test passed.
- Python compile checks passed for changed server/schema files.
- `adventure_ui.js` syntax check passed.

## 2026-09-25 — Level-Scaled Health, Effects, and Fallen Heroes

### Practical changes
- Added deterministic max-HP growth by Hero level. The curve starts at 10 HP and reaches roughly 100 HP around level 50 without scaling linearly.
- Reinterpreted Director `health_delta` as a bounded injury/recovery severity tier rather than literal HP.
- Server converts injury/recovery severity into actual HP using Hero level, max HP, and diminishing veteran resilience.
- Level-ups now increase max HP mathematically and grant the new HP immediately while preserving existing wounds.
- Finite negative status effects expire faster for veteran Heroes; finite beneficial effects can persist slightly longer.
- Reaching 0 HP now marks a Hero as fallen and records the room, turn, and narrative cause.
- Fallen Heroes cannot submit further choices.
- Co-op turn readiness ignores fallen Heroes so surviving party members may continue.
- If no Heroes remain alive, the adventure is forced into a fallen-Hero finale state.
- Finale Hero cards now show SURVIVED/FALLEN, remaining HP, and recorded cause of death.

### Health math
- Director severity tiers remain `-5..+4` for strict structured-output compatibility.
- Damage tiers map to level-scaled fractions of max HP with veteran resilience.
- Healing tiers map to level-scaled fractions of max HP with bounded recovery efficiency.
- Stacked same-turn health consequences are bounded as a fraction of max HP rather than a fixed point cap.

### Validation
- 6/6 dedicated health-scaling/death tests passed.
- 39/39 targeted progression, room, history, Director-runtime, and health regression tests passed in the reconstructed current workspace.
- Python compile checks passed.
- `adventure_ui.js` syntax validation passed.

## 2026-09-25 — Hero Advancement Allocation Foundation

### Practical change
Connected character creation and long-term leveling to one deterministic advancement economy.

### Rules
- Every level gained earns 1 Skill Point.
- Reaching an even-numbered level earns 1 Stat Point.
- Creation caps remain Stat 3 / Skill 2.
- Post-creation advancement caps are Stat 6 / Skill 5.
- Advancement points earned during a journey are tracked in adventure state and only banked onto the Hero when the journey completes.
- Fallen Heroes cannot allocate advancement points.

### Finale UI
Added **HERO ASCENDANCY** to the adventure finale for the local Hero. Players can spend earned points on eligible stats and skills directly from the finale. Unspent points persist for later allocation.

### Persistence / safety
- Added persistent unspent stat/skill point fields and advancement history to Character serialization.
- Completion commit is idempotent and persisted with the room snapshot to prevent duplicate awards after restart/resume.
- Allocation is validated server-side through `/api/characters/{character_id}/advance`.

### Validation
- Dedicated advancement math and Character serialization assertions passed.
- 37/37 unaffected room, adventure-history, auth-permission, and adventure regressions passed.
- Python compilation passed.
- `adventure_ui.js` syntax validation passed.
- The original base project's Director-schema fixture is stale relative to the newer choice-quality schema and was not modified as part of this character-only patch.

## 2026-09-25 — Client State Boundary + Session/Creator UI Stability

### Problem
- Starting or joining a different adventure with a different Hero could retain the previous room's turn recap, dice/check cards, Hero status notice/effect presentation, or other transient presentation state.
- The Session dropdown laid out poorly for guests because hidden host-only controls and wrap-up status text shared a fixed three-column grid.
- Character creation still jumped vertically when spending stat/skill points because the allocation DOM was destroyed and rebuilt on every increment/decrement.

### Changes
- Added an explicit room/Hero presentation boundary reset before a newly selected room/character is rendered.
- Cleared stale resolution animation state, prior dice cards, resolution narration, scene/choice/readiness content, transient Hero HUD notices, finale/intermission state, and chat presentation at that boundary.
- Session controls now use responsive auto-fit columns, with wrap-up status occupying its own full-width row; host/guest state classes are applied explicitly.
- Character allocation controls now update in place rather than re-rendering the full builder for every point adjustment.
- Added `overflow-anchor: none` to the character builder as an additional browser-level safeguard.
- Bumped app/adventure UI asset versions to prevent stale cached scripts/styles.

### Scope / Risk
Client-only stability pass. No Director, XP, leveling, damage, persistence, or server mechanics changed.

### Validation
- `node --check app/web/app.js`: pass
- `node --check app/web/adventure_ui.js`: pass
- CSS contains real line breaks; no escaped newline insertion was used.

## Choice Inspection + Structured Effect Names

### Practical changes
- Choice cards now expose a dedicated `[ i ]` inspector that does not select or lock the choice.
- The inspector shows the full choice description plus risk, reward, archetype, tone, scene impact, check/DC, estimated success odds, XP, possible gains, and possible costs.
- Compact choice rows now surface risk alongside check/DC/XP without expanding the whole card.
- Director consequences now include a short `effect_name` field intended specifically for the Hero HUD (for example `BURNED HAND`, `SHAKEN NERVE`, `LANTERN BLESSING`).
- Effect narration remains separate in `description`; raw narrative sentences are no longer used as the prominent effect name.
- Legacy saved effects with overlong/dialogue-like names are normalized in the UI to a compact mechanical fallback while retaining their original description in detailed views/tooltips.
- Character Sheet effect rows now separate title, mechanical metadata, and descriptive prose.

### Why
Choice metadata had already been added to the Director contract, but the live client still exposed only the short choice heading. Persistent effects also inherited whole narrative sentences as their display name, making the Hero HUD unreadable.

### Validation
- Python compile: PASS (`main.py`, `director.py`, `director_schema.py`)
- JavaScript syntax: PASS (`app.js`, `adventure_ui.js`)
- Asset cache versions bumped for app/adventure UI/CSS.

## 2026-09-26 — Phase A1: Completed Journey / Hero Refresh Boundary

### Why
Full-length playtesting showed that a successfully completed adventure could still appear as an active/in-progress room after returning from the finale, while Hero Home could continue displaying stale pre-finale character data even though advancement had been persisted server-side.

### Changes
- Adventure-list payloads now explicitly expose completed state and ending label.
- Completed adventures still remain resumable until the player has viewed/closed their finale.
- Completed adventure cards use `VIEW FINALE` rather than looking like a normal in-progress resume.
- `RETURN TO THE HALL OF ADVENTURES` now leaves the completed room membership instead of merely hiding the adventure UI.
- Co-op players close their own completed-room membership independently; one player's return does not dismiss the other player's finale.
- Leaving a journey now reloads the authoritative Character list from the server so finale XP, level, HP, effects, unspent advancement points, and allocated stat/skill changes appear immediately on Hero Home.
- Added defensive fallback for legacy finale payloads that do not contain room identity.

### Result
The completion boundary now behaves like an actual transaction boundary from the player's perspective: finish the chronicle, return home, completed room no longer masquerades as active, and Hero Home refreshes from persisted server state.

### Validation
- 35/35 relevant room/history/adventure tests passed.
- `app/main.py` Python compile passed.
- `app/web/adventure_ui.js` syntax validation passed.

## 2026-09-26 — Phase B: Immediate Director Launch + Intermission Sequencing

### What changed
- The 3-second locked-choice countdown is now presentation-only.
- The server begins resolving the locked turn and launches the Story Director immediately after the final required Hero locks in.
- The intermission payload can arrive while the opening countdown is still active without replacing or interrupting that countdown.
- Once the opening countdown ends, the waiting/minigame state begins in the same transition modal.
- When the Director returns, the existing 3-second `STORY READY` countdown remains the reveal boundary.
- A fast Director response is queued behind the opening countdown so the two countdown states cannot overlap.
- Durable game-state recovery follows the same sequencing rules after reconnects.

### Practical result
The dramatic countdown no longer adds 3 seconds of artificial API latency. Story generation overlaps the countdown, while players still get the full transition presentation and the new scene remains gated until the modal closes.

### Validation
- 70/70 reconstructed live tests passing.
- `app/main.py` Python compile clean.
- `app/web/adventure_ui.js` syntax clean.

## 2026-09-26 — Phase C: RPG Effects / Perks

### Practical changes
- Converted active Hero effects into a bounded RPG mechanic instead of a mirror of Director narration.
- Narrative-only consequences are no longer added to the Hero's active effect tray.
- Legacy sentence-length, non-mechanical effects are retired from the active tray the next time Hero progression resolves; their story meaning remains in story/history state.
- Mechanical effects now last by **resolved turn**, not by number of relevant checks.
- Finite mechanical effects last at most **3 resolved turns**.
- A Hero can have at most **3 active finite mechanical effects**.
- A Hero can gain at most **1 new mechanical effect per resolved turn**.
- Positive boons are gated to exceptional execution (normally natural 18+ / critical success) when the Director proposes a matching boon.
- Critical success can strengthen a modest positive effect to +2; critical failure can strengthen a modest negative effect to -2. Server caps remain authoritative.
- Negative effects are limited to meaningful failure/fallout rather than ordinary failed dialogue or investigation.
- Core Hero stats now display active effect math directly, e.g. `STR 3 (+1 FX)`.
- Active effect chips now show compact named mechanics and remaining **turns**.
- Added a 3-second fantasy-styled **BOON / BANE ACQUIRED** popup when a new mechanical effect is earned.
- Updated Director doctrine to keep active effects rare, named, short-lived, and mechanically meaningful.

### Validation
- 63/63 unaffected current regression tests passed (excluding legacy Director-schema fixtures that predate the richer choice/effect schema).
- Dedicated three-turn effect lifecycle/modifier check passed.
- Python compilation passed for modified server/effect/Director modules.
- `adventure_ui.js` syntax validation passed.
- CSS brace/newline sanity checks passed.

## 2026-09-26 — Phase D: Director Freshness + Canon Continuity

### Practical changes
- Recent offered choices are now persisted into Director history and sent back on later turns as an explicit do-not-repeat set.
- Recent scene openings are persisted and supplied to the Director so new beats can vary their opening structure and imagery instead of repeatedly re-establishing location/characters.
- The Director instructions now prefer immediate hooks (dialogue, action, discovery, reaction, interruption, sensory detail, consequence) over routine location summaries.
- Added semantic repetition detection for common repeated approaches (for example `ASK/QUESTION`, `SEARCH/INVESTIGATE`, `WAIT/OBSERVE`, `ATTACK/FIGHT`).
- If a generated active turn is too similar to recent offered choices or recent opening hooks, the Director gets one constrained low-reasoning freshness repair pass that preserves the story outcome and authoritative facts.
- Named `major_npcs` are explicitly treated as important characters, not permission to introduce or recast them immediately.
- Authored NPC `role`, `relationship`, and `canonical_facts` are now deterministically copied into generated seed canon constraints so facts such as employment, relationships, or "reserved for later" guidance cannot be silently dropped during seed generation.
- Director canon rules now prohibit changing a named NPC's occupation/relationship/timing merely to fill a convenient scene role; an unnamed minor NPC should be used instead.

### Practical result
Turn openings should feel less formulaic, choice menus should stop carrying the same generic option across multiple scenes, and authored NPC/lore constraints survive the Author -> Seed -> Runtime Director pipeline more reliably.

### Validation
- 66/66 regression tests passed with legacy Director-schema-only fixture excluded.
- Targeted choice-similarity, opening-history, and NPC canon-preservation assertions passed.
- Python compilation passed for `director.py`, `openai_provider.py`, and `session.py`.

## 2026-09-26 — Phase E: Choice Inspector Mobile / Viewport Cleanup

### Practical changes
- Finished the dedicated visual treatment for the existing `[ i ]` Choice Inspector.
- Choice rows now use a stable two-column card layout so the inspector control is visually separate from the selection button and cannot accidentally act like part of the choice target.
- Choice dossiers now use a wider desktop presentation with structured risk/reward/check/odds/XP metadata and paired possible-gains / possible-costs panels.
- The dossier is explicitly capped to the viewport and owns its own vertical scroll surface, preventing long choice details from escaping the screen on phones or short browser windows.
- Mobile inspector metadata collapses to one column and keeps the return action accessible while the body scrolls independently.
- Updated the stale Director-schema fixture with the Phase C consequence fields so the current live suite can validate against the actual structured-output contract again.

### Validation
- Full current `/tests` suite passes.
- `adventure_ui.js` syntax validation passes.
- Phase E is client/presentation-only; no Director generation, dice, progression, effects, or persistence behavior changed.


## 2026-09-26 — Phase F: Parallel Recap / Story Generation

### Practical changes
- Split each live AI turn into two independent requests that launch together from the same frozen authoritative `TURN FACTS`.
- The main Story Director remains the only authority for the next scene, choices, continuity, `story_state`, consequences, pacing, completion, and memory.
- Removed `resolution_narration` from the main Director structured-output schema so the expensive story request no longer spends output budget rewriting the turn that just resolved.
- Added a low-reasoning economy-model recap path that writes only the concise previous-turn bridge shown before the new scene.
- The recap request receives current scene context, Hero identities, existing memory/story state, and the exact frozen server turn facts, but it cannot mutate canonical state.
- If the recap model errors or returns invalid output, the turn does **not** fail. The server uses its deterministic authoritative roll/action resolution text as the player-facing fallback.
- Added separate recap provider/usage metadata under `director_meta.parallel_recap` so latency/token behavior can be measured independently from the main Director.
- Existing Director JSON repair and freshness repair continue to operate only on the authoritative story-turn schema.

### Practical result
The previous-turn narration and next-scene generation now overlap instead of running serially inside one large response. The expensive Director has a smaller output contract, while story correctness still depends on exactly one authoritative AI path plus server-owned mechanics.

### Validation
- Full current `/tests` suite passes, including dedicated parallel-recap schema, success-path, and fallback tests.
- Python compilation passes for modified Director/schema modules.

## 2026-09-26 — Phase G: Player-Facing Adventure Synopsis

### Practical changes
- Added a dedicated `player_synopsis` field to the generated Adventure Seed contract.
- The generation prompt now treats that synopsis as storefront/player copy: 2–4 punchy sentences that establish the hook and flavor without exposing hidden truths, planned twists, finale details, author notes, or mechanical instructions.
- Explicitly tells generation not to copy the raw Adventure Brief into the player-facing synopsis.
- Generated runtime adventures now use `player_synopsis` as the catalog/card/synopsis-modal description instead of `core_goal` or author-planning premise text.
- Internal `premise`, `core_goal`, locations, threads, constraints, and hidden truths remain available to the runtime Director and are not replaced by marketing copy.
- Existing generated adventures created before this field existed remain loadable; they fall back to `core_goal`, then `premise`, exactly as before.
- The deterministic mock generator now produces a compatible player synopsis for local/offline generation tests.

### Practical result
The first adventure-selection surface now speaks to the player rather than exposing Author-side design material, while the Director keeps the richer planning seed behind the scenes.

### Validation
- Added regression coverage proving player synopsis wins over internal premise/core-goal copy in the runtime catalog.
- Added backward-compatibility coverage for legacy generated seeds without `player_synopsis`.
- Full current `/tests` suite passes.


## 2026-09-26 — Phase H: Author Spellcheck + Structured NPC Constraints

### Practical changes
- Enabled native browser spellcheck/autocapitalization on Author text inputs and textareas, including dynamically-created repeatable fields.
- Expanded NPC authoring with explicit `availability`, `introduction_timing`, canonical occupation/affiliation, introduction conditions, location constraints, and forbidden-use/miscasting fields.
- Existing NPCs remain backward compatible: missing metadata defaults to flexible availability and anytime introduction.
- Structured NPC metadata is deterministically promoted into generated seed `canon_constraints`; the seed model cannot silently discard reserved/hidden/offstage status, timing gates, occupation, location rules, or forbidden casting instructions.
- Default/flexible NPC settings do not add unnecessary canon noise.
- Human-readable Author previews now include the new prose constraint fields.
- Updated the Author guide to explain when to reserve important NPCs structurally instead of relying on vague prose.

### Practical result
Authors can now state things like “Bob is reserved until late, is a retired surveyor, cannot appear behind the counter, and must never be cast as staff” in fields the generation/runtime pipeline treats as hard continuity contracts. Routine writing also gets normal browser spelling assistance with no external service required.

### Validation
- Added NPC canon-promotion tests for reserved/timed characters and default-flexibility behavior.
- Added Author UI regression coverage for native spellcheck and structured NPC controls.
- Full current `/tests` suite passes.

## 2026-09-26 — Phase J: Intermission Game Variety

### Practical changes
- Expanded the deterministic intermission rotation from three games to six while preserving the existing Director-first transition contract.
- Added **SIGIL MEMORY**, a four-pad sequence-memory game whose rounds grow progressively longer and more valuable.
- Added **WARD BREAKER**, a reaction game where players break the currently charged ward before its timer discharges; false hits cost points.
- Added **SHADOW STEP**, a three-lane dodge game with touch/click and keyboard controls.
- Existing **RUNE CATCH**, **LANTERN KEEP**, and **RELIC SCRAMBLE** remain unchanged in the rotation.
- Server-owned game selection, recovered intermission state, and client fallback rotation all use the same six-game order, so refresh/reconnect cannot select a different waiting-room game for the same turn.
- New games remain presentation-only: they do not spend model tokens, mutate story state, alter dice/progression, or delay Director generation.
- Bumped intermission JS/CSS asset versions so deployed clients receive the new game set immediately.

### Practical result
Longer adventures now cycle through six distinct waiting interactions instead of repeating the same three every few turns, without adding another dependency to the authoritative story loop.

### Validation
- Added deterministic six-game rotation coverage, including wraparound.
- Added static client-contract coverage proving all six game IDs are recognized by the intermission renderer and reconnect fallback.
- Full live test suite and JavaScript/Python syntax checks pass.

---

## 2026-09-29 — Production UI Pass 02 Hotfix: Choice Visibility

### Problem
- The Pass 02 adventure skin accidentally set the live `#game-panel` to `overflow: hidden`.
- The real game correctly continued rendering story choices below the scene body, but longer scenes clipped that lower content out of the accessible story pane, making the choices appear to be missing.

### Changes
- Restored the live Adventure story pane to `overflow-y: auto` while keeping horizontal overflow hidden.
- Restored contained story-pane scrolling so generated choices, lock-in controls, resolution content, and later story content remain reachable regardless of scene length.
- Bumped Adventure UI JS/CSS cache versions so deployed browsers receive the hotfix immediately.
- No Director, choice generation, choice selection, dice, progression, persistence, or server mechanics changed.

### Validation
- Confirmed the choice renderer still creates `.choice-card`, `.choice-button`, and inspector controls normally.
- `adventure_ui.js` JavaScript syntax validation passed.
- Patch is limited to the overflow regression and cache-buster update.

---

## 2026-09-29 — Production UI Pass 03: Turn State Sidebar Placement

### Problem
- The new Adventure sidebar correctly created the Turn State panel in the right control rail.
- A legacy initialization block later moved that same `turnFlowPanel` back into the story pane before the scene title.
- The result was the old large CHOOSING ACTION / readiness block still occupying the top of the main story surface.

### Changes
- Removed the legacy story-pane relocation of `turnFlowPanel`.
- Turn State now remains permanently in the right control rail.
- Right rail ordering is now: Turn State → Hero HUD → Party Chat.
- The main Adventure pane no longer reserves the large readiness/status block above the scene.
- Bumped Adventure UI JS/CSS cache versions to `v063`.
- No choice, Director, dice, progression, persistence, intermission, or server mechanics changed.

### Validation
- Confirmed the Turn State panel is initially prepended to `.adventure-sidebar`.
- Confirmed no later code moves `turnFlowPanel` back into `#game-panel`.
- `adventure_ui.js` JavaScript syntax validation passed.

---

## 2026-09-29 — Production UI Pass 04: Lab Composition Reconciliation

### Goal
Bring the real Adventure screen into the same structural hierarchy as the approved UI lab while preserving the live game's existing mechanics and state.

### Changes
- Reordered the real story surface to: ASCII scene art → compact scene/turn bar → turn resolution → story body → choices.
- Hid the legacy `LIVE ADVENTURE` heading from active play.
- Hid the duplicate story-pane `PARTY STATUS` block because readiness/turn state now lives in the right control rail.
- Renamed the player decision section to `CHOOSE YOUR MOVE`.
- Kept live choice rendering and lock-in behavior intact while presenting choices in a two-column desktop grid and one-column narrow/mobile layout.
- Added an explicit `TURN STATE` title to the real sidebar turn-state component.
- Tightened Turn State density so it no longer dominates the right rail.
- Preserved right-rail ordering as Turn State → Hero HUD → Party Chat.
- Preserved the Pass 02 choice-visibility scroll hotfix; the story pane remains vertically scrollable.
- Removed the legacy JS relocation that moved the resolution panel away from its intended story position.
- Bumped Adventure UI assets to `v064`.

### Scope
Presentation/layout only. No Director, dice math, choice generation, choice locking, XP, effects, progression, persistence, intermission, or server behavior changed.

### Validation
- `adventure_ui.js` JavaScript syntax validation passed.
- Confirmed all live gameplay IDs (`scene-art`, `scene-title`, `turn-number`, `resolution-panel`, `scene-body`, `ready-list`, `choice-list`) remain present for existing runtime code.
- Confirmed story pane retains vertical scrolling and choices remain reachable.


---

## 2026-10-01 — Arcade Content Pass 14: Motion, Racing, and Classic Cabinets

### Goal
Move the Intermission Arcade from framework proof-of-concept toward a genuinely varied retro arcade: fix broken artillery, make timing-sport games visibly animate their outcomes, retire the weakest live cabinet, and add several low-risk classic-mechanic games for rapid playtesting.

### Changes
- Fixed **GORILLA ARTILLERY** projectile simulation so shots begin above the ground, travel upward according to angle/power, continue through an off-screen apex when necessary, and descend back into the playfield instead of immediately colliding with the launch ground.
- Fixed artillery score updates to use an authoritative local score ref so rapid exchanges do not award against stale React props.
- Rebuilt **BOWL-O-MATIC** presentation around an animated VGA-style lane canvas. The chosen aim/power/spin now visibly drives the ball down a perspective lane, curves the delivery, impacts the pin deck, and shows knocked/down pins before the next frame.
- Rebuilt **PIXEL LINKS** presentation around an animated VGA-style golf canvas. Shots now visibly launch from the tee, arc toward the generated target, respond to wind/shape, show the landing position, and include a small top-down dispersion inset for lateral error.
- Retired **ARCHERY RANGE** from the live six-slot intermission rotation while keeping it available in Arcade Lab for reference/testing.
- Reassigned the historical `sigil_memory` server slot to the new **HIGHWAY 84** cabinet without changing the server-owned six-ID rotation or persisted intermission protocol.
- Added **HIGHWAY 84**, a continuous three-lane traffic-dodging racer with keyboard and pointer/touch steering, escalating speed, clean-pass scoring, and collision penalties.
- Added **WALL//BREAKER**, a classic paddle/ball brick-breaker with keyboard and pointer/touch control.
- Added **DATA SNAKE**, a grid-based Snake cabinet with keyboard and touch D-pad controls.
- Added **LIGHT//CYCLES**, a trail-survival duel against a lightweight machine opponent with keyboard and touch D-pad controls.
- Added `racing` as an Arcade registry category and registered all new cabinets in Arcade Lab. New cabinets other than HIGHWAY 84 remain Lab-only until playtested.

### Safety / scope
- No Director generation, adventure state, Hero progression, room persistence, backend intermission IDs, or score-submission protocol changed.
- Existing server intermission IDs remain authoritative; only the React registry maps one existing slot to a different visual cabinet.
- New games remain client-side latency camouflage and do not affect RPG progression.

---

## 2026-10-02 — Hero System Pass 15: Bio, Attributes, Skills, Talents, and Intentional Advancement

### Goal
Turn the existing Hero progression scaffold into a deliberate RPG build system without invalidating existing Heroes or destabilizing live adventure resolution.

### Changes
- Added a player-authored **Hero Bio** (up to 800 characters) to character creation and the persistent Hero record.
- Added Bio editing to the Hero Sheet through a dedicated profile endpoint.
- The Story Director now receives the Hero Bio as player-authored canon and may use it for characterization/callbacks without contradicting or mechanically rewriting it.
- Expanded Core Attributes from six to seven by adding **Luck** while preserving every existing Attribute and its stored value.
- Expanded the skill catalog from 12 to 20 with **Brawl, Sleight, Medicine, Mechanics, Navigation, Insight, Performance, and Composure**.
- Added descriptive metadata for every Attribute and Skill so creation communicates what each choice actually means.
- Increased new-Hero creation budgets to **9 Attribute Points** and **8 Skill Points** while retaining creation caps of 3/2.
- Increased long-term advancement caps to **7 Attributes** and **6 Skills**.
- Reworked level rewards into a deliberate cadence:
  - every level gained: **+2 Skill Points**;
  - every even level: **+1 Attribute Point**;
  - levels 3, 5, 7, ...: **+1 Talent Point**.
- Added persistent **Talents** and Talent Points with an initial 12-Talent catalog, including Sleuth, Gearhead, Field Medic, Silver Tongue, Hard Case, Ghost, Pathfinder, Lucky Break, and others.
- Talent bonuses are server-owned and now participate directly in authoritative check math; check results expose the Talent modifier/details separately from temporary story effects.
- Added progression-v2 migration for existing Heroes. Existing stats/skills are preserved; older Heroes receive only the additional Skill/Talent currency introduced by the new system.
- Expanded the Hero Sheet into a real RPG record with:
  - XP progression meter;
  - editable Director-canon Bio;
  - segmented old-school Attribute/Skill bars;
  - grouped Skill families;
  - persistent Talent cards and selectable Talent advancement;
  - unified Attribute/Skill/Talent advancement commit.
- Expanded the Hero Hall cards with Bio snippets, available progression currency, and Talent count.
- Replaced the placeholder Rulebook page with real player-facing documentation for checks, Bio canon, Attributes, Skills, XP, advancement, and Talents.

### Compatibility / safety
- Existing Hero attribute and skill values are never renormalized or reset.
- New Luck and new Skills default to zero on legacy Heroes.
- Progression migration is versioned and idempotent.
- Talent bonuses are bounded and remain subordinate to the d20 + Attribute + Skill foundation.
- The Director receives Bio/Talent context but remains non-authoritative over all mechanics.

### Validation
- Full Python regression suite: **157 passed**.
- TypeScript project type-check: `tsc -p frontend/tsconfig.json --noEmit` passed.
- Added dedicated regression coverage for Hero v2 migration, Bio/Talent persistence, expanded creation rules, level reward cadence, server-owned Talent check modifiers, and Hero UI/Director contracts.

---

## 2026-10-02 — RPG Systems Pass 16: Level-Aware Challenge Scaling

### Goal
Make Hero advancement matter without turning the world into a level-scaled treadmill. Experienced Heroes should outgrow routine obstacles while the Story Director presents more consequential challenges appropriate to their capability.

### Changes
- Added a server-owned **Challenge Profile** for AI-directed adventures using the active party's effective level and the authored adventure difficulty.
- Added slow DC progression: roughly **+1 final DC per five effective Hero levels**, capped at +10 so high-level play remains inside a readable d20 range.
- Added conservative authored adventure adjustments (`introductory/easy` -1, standard/moderate 0, hard/challenging +1, brutal/extreme +2).
- Kept the Story Director's structured `difficulty` field in its existing 3-16 range, but redefined it as a **relative challenge seed**, not the authoritative final DC.
- Added relative challenge tiers: **Easy, Standard, Hard, Severe, Legendary**.
- The server now converts each AI-proposed relative difficulty into the final shared DC before the choice is persisted or shown to players.
- Persisted check data now retains the balancing breakdown: base difficulty, challenge tier, effective party level, level adjustment, adventure adjustment, and final DC.
- Added Hero level to frozen turn facts for recovery/audit fallback without changing roll authority.
- Expanded Director context with a `challenge_profile` including capability band and the final DC ranges currently in effect.
- Tightened Director instructions so progression scales the **fictional challenge**, not mundane objects: routine actions can become automatic for veteran Heroes, while meaningful checks should involve more consequential threats, constraints, opposition, or stakes.
- Mixed-level co-op parties use one shared effective party level (rounded party average) so the choice menu and displayed DC stay consistent for both players; each Hero's own Attributes, Skills, Talents, effects, and roll still determine their individual result.
- Choice cards, the Choice Inspector, and Turn Resolution Theater now show the relative challenge tier alongside the final server DC when available.
- Added Rulebook documentation explaining level-aware challenge scaling and the server/Director authority split.

### Compatibility / safety
- Hand-authored/static adventure DCs are unchanged; this pass only scales AI-directed choices where the Director can also scale the fiction appropriately.
- Existing persisted dynamic choices without scaling metadata remain playable as-is and naturally transition to the new system on subsequent generated turns.
- The Director still cannot choose the final DC or alter authoritative rolls.
- XP continues to use the final server DC for failure proximity while risk remains the primary reward driver.

### Validation
- Full Python regression suite: **163 passed**.
- TypeScript project type-check: `tsc -p frontend/tsconfig.json --noEmit` passed.
- Added dedicated regression coverage for DC progression, authored difficulty modifiers, tier mapping, mixed-level party averaging, level-50 scaling, and persisted final-DC metadata.

---

## 2026-10-02 — Arcade Polish Pass 16A: Golf Live Top View

### Goal
Make Pixel Links' overhead view communicate the actual shot instead of displaying a mostly static decorative inset.

### Changes
- Rebuilt the golf `TOP VIEW` as a true live course map.
- Vertical position now represents carry distance; horizontal position represents lateral miss.
- The map plots the same aim, shot-shape, and wind components used to calculate the landing result.
- Added a predicted shot curve, a brighter traveled path, a live ball marker, pin/green position, and predicted landing marker.
- Added live yardage plus left/right dispersion readout so visibly different shots now produce visibly different overhead results.
- Updated the post-shot footer to report left/right miss direction instead of only absolute offline distance.

### Compatibility / safety
- Shot scoring, timing controls, wind math, and arcade progression are unchanged.
- This is a presentation-only correction to Pixel Links; no Director, room, Hero, or persistence behavior changed.

---

## 2026-10-03 — Arcade Game-Feel Pass 17: Forgiving Timing, Visible Outcomes, and Cabinet Variation

### Goal
Make the arcade feel immediately readable and rewarding: timing should be approachable, every hit/miss/win should be visually obvious, and repeated cabinets should vary enough that they do not feel like the same board every time.

### Changes
- Slowed the shared timing-shot engine defaults so aim/power/modifier meters are easier to read and stop successfully.
- Added visible target bands to timing meters, allowing sport cabinets to communicate the useful aim/power/spin windows instead of forcing blind timing.
- Added a reusable arcade feedback overlay for large retro outcome callouts (`STRIKE`, `DIRECT HIT`, `YOU WIN`, `CONTACT`, score deltas, etc.).
- Rebuilt **Pixel Links** around a behind-the-player pseudo-3D 16-bit golf presentation:
  - perspective fairway/rough/green/bunker geometry;
  - blocky golfer swing;
  - visible flag and generated hole shape;
  - animated ball flight in the same perspective space;
  - small secondary overhead hole map;
  - recommended club and target-power readout;
  - broader success windows and more forgiving scoring;
  - randomized hole length, wind, pin placement, dogleg, bunker side, and green size.
- Improved **Bowl-O-Matic** with slower meters, visible timing windows, lane-oil variations, a learnable aim guide, stronger impact feedback, and unmistakable pin/strike result overlays.
- Added explicit hit/miss/defeat overlays to **Gorilla Artillery** so projectile outcomes cannot be missed.
- Added per-run difficulty/board variants to several cabinets:
  - **Highway 84**: 3/4-lane modes, traffic density and speed variants, clean-pass streak bonuses;
  - **Wall//Breaker**: multiple board dimensions/patterns, paddle sizes, speeds, and combo feedback;
  - **Data Snake**: three board sizes/speeds from relaxed to turbo;
  - **Light//Cycles**: three arena sizes/speeds with matching AI behavior changes.
- Kept all of this in Canvas/React rather than introducing Three.js. The current 2D/pseudo-3D VGA style benefits from direct pixel control and has no need for a full 3D scene graph yet.

### Compatibility / safety
- No Director, room, Hero, progression, persistence, or server intermission contracts changed.
- Existing cabinet IDs and live server-slot mappings remain unchanged.
- Three.js was intentionally not added as a dependency; it remains a future option for genuinely 3D cabinets such as first-person racing/dungeons/pinball rather than a requirement for the current retro renderer.

---

## 2026-10-03 — Arcade Presentation Pass 18: Bowl-O-Matic VGA Perspective

### Goal
Bring Bowl-O-Matic up to the same presentation standard as the rebuilt golf cabinet: a clear behind-the-player sports view where timing inputs produce an obvious physical action and the player can immediately read line, hook, impact, and result.

### Changes
- Rebuilt Bowl-O-Matic around a behind-the-bowler pseudo-3D VGA lane instead of the previous schematic lane diagram.
- Added a blocky animated bowler delivery with a visible ball release.
- Reworked the lane into a true perspective composition with approach, lane boards, gutters, target arrows, pinsetter, pin deck, and ten individually rendered pins.
- The animated ball now follows the same aim/spin/oil-derived impact line used by scoring, including a visible hook path and motion trail.
- Added individual pin knockdown/scatter animation plus an impact flash/camera bump so contact cannot be missed.
- Added in-canvas lane/oil/pin HUD and live `STRAIGHT BALL` / `HOOKING LEFT` / `HOOKING RIGHT` feedback during the roll.
- Slowed Bowl-O-Matic's aim/power/spin timing periods again and widened its success bands to keep the cabinet approachable during short intermissions.
- Preserved DRY/HOUSE/OILY lane variation and existing scoring, including the large arcade feedback overlay for strikes and pin counts.

### Compatibility / safety
- No server intermission IDs, room state, Director behavior, Hero state, scoring transport, or persistence contracts changed.
- This is a client-side presentation/game-feel rebuild of the existing `bowling` cabinet ID.

---

## 2026-10-03 — Gameplay UI Consolidation Pass 19

### Goal
Turn the live adventure screen into one coherent terminal-RPG interface now that the game systems are mature enough to deserve a real presentation pass. Keep story and choices dominant, keep the Hero readable at a glance, keep chat compact, and surface dice/progression feedback where the player naturally looks for it.

### Changes
- Added a compact adventure-mode header so active play spends less vertical space on global navigation while preserving all existing routes.
- Replaced the bulky sidebar Turn State panel with a sticky in-story command strip showing each player's lock/online state, Director state, room mode, and compact session actions.
- Rebalanced the desktop adventure layout toward the story while keeping a dedicated Hero/sidebar column.
- Reduced the scene-art footprint and standardized scene metadata, current-scene hierarchy, turn labels, story width, and spacing.
- Refined choice cards with stronger numeric hierarchy plus discrete check/challenge/DC, risk, and XP tags.
- Made the choice commit bar sticky on desktop and added the selected choice description so intent remains visible while scrolling.
- Rebuilt the live Hero panel around the RPG system:
  - authored Hero bio preview;
  - compact HP/XP treatment;
  - seven core Attributes shown as old-school segmented bars;
  - advancement-points alert;
  - active effects;
  - direct Character Sheet link.
- Added the previous authoritative check directly beneath Hero stats with d20, modifier, total, DC, challenge tier, outcome, earned XP, and level-up feedback.
- Shrunk Party Chat into a true bottom-of-sidebar utility instead of letting it consume the remaining column height.
- Preserved the existing ASCII face picker and chat behavior.
- Reworked mobile ordering so story/choices remain first, with Hero and chat following naturally instead of jumping above the story.
- No Director, room, progression, persistence, dice, XP, choice, or intermission mechanics were changed.

### Validation
- Full Python/source-contract regression suite: **165 passed**.
- Added a UI-contract regression protecting the consolidated command strip, Hero segmented stats, inline last-check receipt, compact chat, choice metadata, and adventure-mode shell.
