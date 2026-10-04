# Tales of Two — Master Project Documentation

> **Canonical project document.** This file replaces the old append-only changelog workflow.
> Update or rewrite the relevant sections in this file as the product changes; do not create another numbered changelog copy.

**Last consolidated:** 2026-10-03  
**Current local baseline:** through Pass 26 (shareable invites + partner activity notifications)  
**Public site:** `https://onlinetextadventure.com`  
**Primary release command:** `./scripts/release-staging.sh "Describe the release"`

---

## 1. Product Summary

**Tales of Two** is an online AI-directed text-adventure RPG designed for solo or two-player cooperative play.

The product combines:

- persistent player accounts and Heroes;
- authored adventure seeds and world lore;
- AI-generated scenes, consequences, choices, recaps, and finales;
- server-authoritative dice, DCs, XP, progression, room state, and persistence;
- synchronous co-op play with room codes and shareable deep links;
- latency-masking retro arcade intermissions while the Story Director generates;
- an Author console for building structured worlds/adventures;
- an Admin Control Room for users, author permissions, live operations, and analytics.

The visual language is intentionally terminal/IRC/VGA-inspired: strong borders, chunky mono typography, limited colors, segmented RPG meters, and deliberately retro arcade graphics paired with modern input/UX behavior.

---

## 2. Current Product Surfaces

### Public / authentication

- `/` — public landing/login entry.
- `/join/:roomCode` — shareable co-op invitation deep link.
- registration/login preserve the requested invite target and return the player to the join flow.

### Player game area

- `/game` — Adventure Hall / authenticated dashboard.
- `/game/heroes` — Hero Hall.
- `/game/heroes/:heroId` — Character Sheet.
- `/game/adventure/...` — live adventure room.
- `/game/chronicles` — completed adventure history / sealed chronicles.
- `/game/arcade` — Arcade Lab.
- `/game/rulebook` — player-facing RPG rules.
- account/settings routes — account configuration and notification preferences.

### Authoring

- `/author-console` — full structured Author editor served by Python.
- Author access is permission-gated.
- AI-assisted field/item expansion is available for structured authoring without giving AI authority to overwrite existing canon.

### Administration

- `/admin` — protected superuser Control Room.
- Admin can inspect operations/analytics, search users, grant/revoke Author + Publish access, import legacy Author bundles, open Arcade Lab, and read this master project document.
- Browser admin tools cannot grant another user `admin`; superuser authority remains bootstrap-only.

---

## 3. Production Architecture

```text
Browser
  |
  v
CloudFront
  |-----------------------------|
  v                             v
Private S3 / React          /api + /socket.io
                                |
                                v
                         Application Load Balancer
                                |
                                v
                          ECS / Fargate
                      FastAPI + Socket.IO
                                |
                                v
                         PostgreSQL / RDS
```

### Backend image pipeline

```text
Local source
  -> S3 source artifact
  -> AWS CodeBuild
  -> ECR image
  -> ECS/Fargate deployment
```

Docker Desktop is not required on the development Mac.

### Current runtime assumptions

- Staging currently runs one Fargate task because live room/session coordination still contains process-local runtime state.
- PostgreSQL is the durable cloud persistence layer.
- CloudFront is the public front door for static React, REST API traffic, and Socket.IO/WebSocket traffic.
- `onlinetextadventure.com` and `www.onlinetextadventure.com` terminate TLS at CloudFront using ACM.

### Important cost/scale note

Scale-to-zero for Fargate is technically possible but intentionally deferred. A zero-task service cannot currently accept login/API/game traffic without a separate wake-up mechanism, and deliberate process shutdown should wait until all room/runtime state is fully restart-safe.

---

## 4. Authority and State Ownership

The project follows one core rule:

> **Python owns game truth. React presents it. The Story Director narrates it.**

### Server-authoritative

- room membership and mode;
- player readiness / locked choices;
- dice rolls;
- DC calculation;
- check resolution;
- XP awards;
- Hero level/progression currency;
- Attribute/Skill/Talent validation;
- temporary effects;
- QTE resolution state;
- finale/history persistence;
- retryable frozen turn facts.

### Director-authoritative only for narrative

The Story Director may generate:

- prose;
- scene framing;
- consequences consistent with authoritative results;
- player-facing choices;
- recap text;
- synopsis/storefront copy;
- finale narration;
- use of authored lore, Hero Bio, and character facts.

The Director may **not** invent final dice results, XP, permanent stat changes, authoritative DCs, or persistence state.

### React/local state

React may keep presentation-only state such as:

- currently highlighted choice;
- open/closed UI panels;
- arcade local score before submission;
- notification preferences;
- last useful route for Return to Game.

Losing browser storage must never destroy authoritative adventure progress.

---

## 5. Adventure Flow

### Starting a journey

1. Player selects a Hero.
2. Player opens an adventure card and reads player-facing synopsis/preflight information.
3. Player starts explicitly as Solo or Co-op.
4. Co-op rooms require the configured party before authoritative turn resolution.
5. Host can share a canonical `/join/:roomCode` link.

### Turn loop

1. Director/story scene is displayed.
2. Players select and lock choices.
3. Python freezes authoritative TurnFacts and rolls/check inputs.
4. Director generation launches immediately.
5. Resolution theater / dice / QTE / arcade intermission can play while generation continues.
6. Generated output is validated and committed.
7. New scene/choices arrive.
8. Story viewport returns to the top for the next beat.

### Director failure recovery

- A failed Director request must preserve frozen TurnFacts.
- Retry reuses the original locked choices and rolls.
- Retry must not reroll or double-award XP.
- Generation requests use bounded timeout/recovery behavior.
- A stuck journey can be recovered or abandoned from the Adventure Hall.
- Abandon cancels in-flight Director work before room deletion so late responses cannot resurrect a room.

### Legacy room recovery

Old one-player rooms that were accidentally created as Co-op are migrated safely to Solo after they have already progressed. Fresh one-player Co-op rooms still require the second Hero.

---

## 6. Story Director and AI Generation

### Generation goals

- maintain authored canon;
- incorporate relevant Hero Bio/Talents naturally;
- avoid repetitive openings/choices;
- preserve unresolved threads and current context;
- produce structured output that Python can validate;
- keep narrative interesting without allowing the LLM to own mechanics.

### Latency strategy

Director latency is masked rather than allowed to freeze the UX:

- generation begins as soon as authoritative turn facts are frozen;
- dice/resolution presentation and arcade intermissions run in parallel;
- story-ready countdown transitions out of the arcade when the next beat is available;
- if generation is already fast, the arcade can be skipped naturally.

### Output reliability

The current system includes structured validation, repair/fallback behavior, hard timeout/retry state, and persistent pending-turn recovery. Further optimization should focus on context size, output budgets, model selection, and generation telemetry without reducing story quality.

---

## 7. Hero RPG System

### Hero Bio

Each Hero has a player-authored Bio (up to 800 characters) describing background, temperament, quirks, history, or other canon. The Director receives the Bio as player-authored truth and should use it naturally without mechanically rewriting it.

### Core Attributes

Seven Core Attributes:

- Strength
- Agility
- Intellect
- Perception
- Presence
- Willpower
- Luck

New-Hero creation budget: **9 Attribute Points**.  
Creation Attribute cap: **3**.  
Long-term Attribute cap: **7**.

### Skills

Twenty current Skills:

- Athletics
- Brawl
- Acrobatics
- Stealth
- Sleight
- Investigation
- Knowledge
- Technology
- Medicine
- Mechanics
- Awareness
- Survival
- Navigation
- Insight
- Persuasion
- Deception
- Intimidation
- Performance
- Discipline
- Composure

New-Hero creation budget: **8 Skill Points**.  
Creation Skill cap: **2**.  
Long-term Skill cap: **6**.

### Check foundation

```text
d20
+ Attribute
+ Skill
+ Talent bonus
+ temporary effects
+ situational modifiers
= authoritative total vs server DC
```

### Level rewards

- Every level gained: **+2 Skill Points**.
- Every even-numbered level: **+1 Attribute Point**.
- Levels 3, 5, 7, 9, ...: **+1 Talent Point**.

Advancement can be queued across multiple Attributes/Skills/Talents and committed as one player-controlled build decision.

### Talents

Talents are permanent server-authoritative specialties. The initial catalog includes archetypes such as Sleuth, Gearhead, Field Medic, Silver Tongue, Hard Case, Ghost, Pathfinder, Lucky Break, and related build options.

Talents may modify appropriate checks but remain bounded beneath the d20 + Attribute + Skill foundation.

### Existing Hero migration

Hero progression is versioned/idempotent:

- existing Attribute/Skill values are preserved;
- Luck/new Skills default safely for legacy Heroes;
- migration grants only newly introduced progression currency where appropriate;
- no existing Hero is renormalized or reset.

---

## 8. Challenge Scaling and XP

### Relative challenge tiers

AI-directed choices use relative challenge tiers:

- Easy
- Standard
- Hard
- Severe
- Legendary

The Director proposes relative difficulty; Python computes the final shared DC.

### Level-aware scaling

For AI-directed adventures, effective party level increases final DC slowly — roughly **+1 DC per five effective Hero levels**, capped at +10 — with authored adventure difficulty providing a small adjustment.

The design rule is:

> **Scale the fiction, not mundane objects.**

A veteran Hero should automatically outgrow routine obstacles. The Director should present more consequential threats rather than make the same kitchen drawer magically harder.

Mixed-level co-op parties use a rounded average effective party level for one shared choice/DC, while each Hero still resolves using their own Attributes, Skills, Talents, effects, and roll.

### Failure XP

Failed checks earn partial XP based on authoritative total-to-DC proximity rather than full success XP. Near misses receive meaningful credit; poor/critical failures receive substantially less.

Risk and challenge remain meaningful without making failure economically identical to success.

---

## 9. QTE / Micro-Event System

Quick-time events are part of the story flow, not generic disconnected mini-games.

Current behavior:

- playable countdown begins when the QTE is actually visible;
- default window is deliberately readable rather than a hidden 4-second server timer;
- prompts/options derive from current scene, goal, threat, resolution context, or authored story material;
- keyboard, click/tap, and directional input are supported where appropriate;
- timeout sends a real resolving response instead of leaving the adventure blocked;
- offline partners cannot permanently hold a QTE open;
- after selection, the QTE shows the player's reaction and immediate consequence;
- result remains until the player explicitly continues the story.

---

## 10. Intermission Arcade

The Intermission Arcade exists to occupy Director generation latency without delaying story generation.

### Runtime contract

Arcade cabinets are disposable React modules inside a shared runtime. They receive presentation/input context and report local score; they do not own Socket.IO room state, Director calls, XP, or persistence.

A cabinet must tolerate being unmounted at any moment.

### Registry / lab

- Cabinet registry: `frontend/src/features/arcade/ArcadeGameRegistry.tsx`
- Arcade Lab: `/game/arcade`
- New cabinets should enter the Lab first and be promoted to live rotation only after playtesting.

### Current live historical slot mapping

The six backend slot IDs remain stable for persistence compatibility; React maps them to current cabinets.

Current live set includes:

- Find the Outlier
- Terminal Pong
- Missile Defense
- Highway 84
- Maze Runner
- Word Cabinet

Arcade Lab additionally contains cabinets such as:

- Gorilla Artillery
- Bowl-O-Matic
- Pixel Links golf
- Wall//Breaker
- Data Snake
- Light//Cycles
- retired/experimental Archery

### Game-feel rules

- controls should be immediately understandable;
- timing bars should be forgiving enough for a short intermission;
- hits/misses/wins/crashes must be visually unmistakable;
- turn-based cabinets should pause between rounds;
- mobile action games should account for smaller reaction space;
- movement cabinets should support swipe where appropriate;
- repeated plays should vary board size, speed, traffic, wind, lane condition, layout, etc.;
- physical actions should visibly animate their consequence;
- retro graphics may be crude; feedback must not be.

Canvas is preferred for current 2D/pseudo-3D VGA cabinets. Three.js is reserved for cabinets that actually benefit from a 3D camera/scene graph.

---

## 11. Authoring System

The Author system provides structured guidance so adventures have enough canon and intent for reliable AI direction without requiring an author to hand-write every minor field.

### Structured content

Author data may include:

- premise and story guidance;
- world truths;
- locations;
- NPCs;
- lore/secrets;
- moments;
- forbidden rules;
- threads;
- replayability guidance;
- tone, genre, difficulty, weirdness, length, and related metadata.

### AI Helper philosophy

AI authoring is scoped, not a one-click replacement for authorship.

- Text fields can expose a small **AI** helper.
- Repeatable objects (NPC, location, lore item, thread, etc.) can expose **AI ITEM** expansion.
- Author provides one sentence of intent.
- AI fills only the requested field or empty/default portions of the selected item.
- Existing authored canon must not be overwritten silently.
- Title/slug/critical identifiers and server-authoritative values are protected.

Example:

```text
"unnamed evil entity, mysterious, speaks in riddles, appears late"
```

can expand into structured NPC guidance while preserving the explicit rule that the entity has no name.

### Player-facing synopsis

Generated adventures persist an AI-generated player synopsis. If synopsis quality resembles the raw author pitch too closely, a separate lightweight storefront-copy pass may improve it without blocking adventure generation.

Retired seeds are hidden from new player discovery while existing rooms using them remain recoverable.

---

## 12. Admin Control Room

The protected Admin Control Room is intended to feel like an operational cockpit rather than a generic settings page.

### User / permissions operations

Admin can:

- search registered users;
- inspect permissions;
- grant Author + Publish;
- revoke Author + Publish;
- import portable legacy Author content with explicit ownership mapping.

The browser cannot grant `admin` authority.

### Current telemetry

Control Room telemetry currently includes:

- online players;
- live rooms and current room state;
- recently active users;
- registered users;
- Author count;
- completed adventures;
- resolved turns;
- average turns/run;
- live player/room detail;
- recent activity timeline;
- popular adventures;
- top players by turns;
- recent completions.

Telemetry is read-only and must never be capable of blocking gameplay.

### Future analytics candidates

A dedicated event ledger can later track:

- abandoned adventures;
- arcade cabinet starts/completion/skip rates;
- Director latency;
- Director retries/timeouts/failures;
- average generation tokens;
- QTE completion rates;
- invite conversion;
- notification engagement;
- choice/risk trends.

These should remain isolated from authoritative turn resolution.

### Project documentation

The Admin Control Room serves this exact file (`docs/PROJECT_MASTER.md`) through an admin-only API and displays it as searchable sections. Editing/replacing this file in source and releasing the backend updates the Admin copy.

---

## 13. Co-op, Sharing, and Notifications

### Shareable invitations

Open co-op rooms expose canonical deep links:

```text
https://onlinetextadventure.com/join/ROOMCODE
```

The invite flow supports:

- native mobile Web Share sheet;
- Copy Link;
- Text;
- Email;
- sign-in/registration return-to-invite;
- Hero creation return-to-invite;
- direct Hero selection and join.

Invite controls are host-only and only appear while a co-op slot is open.

### Partner activity notifications

Current notifications include:

- partner joined;
- partner locked a choice;
- Your Turn;
- results/story beat ready;
- finale ready.

Notifications are account-wide across connected tabs and can deep-link to the correct room/Hero.

Optional browser notifications are supported while the browser/tab can receive the Notification API event. Permission is requested only after explicit player action.

**True closed-app Web Push is not implemented yet.** That requires a service worker, Push API subscriptions, server subscription persistence, and push delivery infrastructure.

---

## 14. Dashboard and Gameplay UI Direction

### Dashboard hierarchy

The authenticated home is organized around:

1. Continue Journey / recovery.
2. Join a Friend.
3. Your Heroes.
4. Searchable Adventure Library.
5. Secondary System tools.

Auxiliary routes are grouped rather than presented as equally important flat navigation.

### Live adventure hierarchy

During play:

- story and choices are primary;
- compact turn/Director state stays visible without dominating;
- Hero panel shows Bio, HP/XP, seven Attributes, effects, progression alerts, and recent check receipt;
- dice/result information lives directly under Hero information;
- chat remains compact at the bottom of the sidebar;
- retry/failure states belong in the central generation/recovery modal rather than being hidden beneath sidebar content;
- mobile typography must not fall below practical readable sizes.

### Character Sheet

The Character Sheet is organized as:

- Hero Dossier / Bio;
- health + XP;
- typed advancement currencies;
- Attributes;
- Skills grouped by governing Attribute;
- Talents;
- Chronicles/history.

Advancement points can be queued across multiple targets and committed once. Currency labels must explicitly identify Attribute vs Skill vs Talent points.

---

## 15. Data and Persistence

Durable cloud data uses PostgreSQL through the shared database compatibility layer.

Important persisted domains include:

- accounts/auth sessions/permissions;
- Heroes and progression;
- Author documents/versions;
- generated adventures;
- approved/retired publication state;
- completed adventure history;
- persistent story/finale records;
- frozen turn/recovery state required for safe Director retry.

Local development may still use SQLite through the same store API where supported.

Do not move durable state into browser-only storage or container-local SQLite in AWS.

---

## 16. Development and Release Workflow

### Local validation

```bash
./scripts/check-project.sh
```

This is expected to run the Python regression suite plus frontend/infrastructure validation appropriate to the current repository.

### Release workflow

The standard release wrapper is:

```bash
./scripts/release-staging.sh "Describe what changed"
```

Expected sequence:

```text
validate
  -> stop on failure
Git commit / push
  -> stop on failure
AWS backend + frontend deployment
  -> health/smoke checks
```

GitHub is source history + automated CI. A normal `git push` does **not** itself deploy production/staging unless the workflow is explicitly changed later.

### AWS deployment implementation

The low-level AWS deployer remains:

```bash
./scripts/aws/deploy-game-staging.sh
```

Use the release wrapper for normal work; use lower-level scripts for diagnostics or targeted infrastructure work.

### Source review package

Use:

```bash
./scripts/package-for-review.sh
```

The review package should exclude dependencies, builds, caches, secrets, databases, backups, and Git history.

---

## 17. Testing / Safety Expectations

Every meaningful implementation pass should preserve these principles:

- run the focused/full regression suite before release;
- keep Python authoritative for mechanics;
- never reroll a frozen turn during generation retry;
- never allow analytics/notifications/arcade failures to block gameplay;
- preserve existing Heroes during progression migrations;
- preserve existing rooms during catalog retirement;
- do not silently overwrite authored canon;
- do not add permanent credentials/secrets to GitHub or source;
- prefer additive/versioned persistence changes over destructive migration;
- keep the changelog history available as an archive, but update **this master file** as the current truth.

---

## 18. Current Known Constraints

- ECS/Fargate currently stays warm because login/API/game traffic requires a running backend and live rooms still include process-local runtime coordination.
- True closed-app push notifications are not implemented yet.
- The arcade server still uses six historical intermission slot IDs for persistence compatibility; new cabinet rotation should eventually become versioned server-side.
- Admin analytics derive largely from existing persisted state and completions; a dedicated product-event ledger is future work.
- Director latency/reliability remains an important ongoing focus; retries are recoverable but generation should continue to be profiled and optimized.
- Real two-player playtesting remains essential for validating asynchronous co-op timing, notification usefulness, and long-session UX.

---

## 19. Near-Term Roadmap

### Product / gameplay

- continue real co-op playtesting and fix flow defects before adding unnecessary mechanics;
- improve story-generation latency/telemetry without reducing narrative quality;
- continue UI hierarchy/readability refinement based on actual sessions;
- tune progression, Talents, DC scaling, and XP from real Hero builds;
- continue QTE/story relevance tuning.

### Social

- evaluate true Web Push after browser-notification behavior is proven useful;
- improve invite conversion/partner waiting UX;
- eventually support richer asynchronous partner status.

### Story longevity

Explore episodic/persistent-world systems such as:

- weekly generated lore/episodes;
- recurring worlds and characters;
- campaign chapters;
- longer epic journeys;
- endless/continuing adventures where resolved arcs can seed new arcs instead of requiring a hard permanent ending.

### Arcade

The framework is mature enough to pause feature growth and return to cabinets opportunistically. New games should favor reusable engines and enter Arcade Lab before live rotation.

---

## 20. Recent Release History

This is intentionally short. The historical numbered changelog files remain an archive; this section only records the recent product milestones needed to understand the current codebase.

- **Pass 19 — Gameplay UI Consolidation:** story-first adventure layout, compact Hero/chat/turn-state hierarchy.
- **Pass 20 — Catalog + QTE Recovery:** retired seeds leave discovery; QTE timing/context/resolution repaired.
- **Pass 21 — Playtest Polish:** mobile arcade pacing/swipes, readability, full journey finale, explicit QTE consequence screen.
- **Pass 22 — Dashboard IA:** journey/Hero/adventure/system hierarchy and searchable library.
- **Pass 23 — Character Sheet UI:** RPG dossier, grouped Skills, Talent presentation, consistent controls.
- **Pass 24 / 24A — Advancement:** robust queued multi-point allocation and explicit Attribute/Skill/Talent currency labels.
- **Pass 25 — Shareable Invites:** `/join/:roomCode`, native share sheet, copy/text/email, auth/Hero creation return flow.
- **Pass 26 — Partner Notifications:** joined/locked/your-turn/results/finale in-app + background browser notifications.

---

## 21. Documentation Policy

Going forward:

1. `docs/PROJECT_MASTER.md` is the **canonical current-state documentation**.
2. Do **not** create `PROJECT_CHANGELOG 21.md`, `PROJECT_CHANGELOG 22.md`, etc.
3. Do **not** append endlessly to the canonical document.
4. Rewrite the sections affected by a release so they describe what the system **is now**.
5. Keep the **Recent Release History** short and roll older entries out when they stop being useful.
6. Historical changelogs/README pass files may remain in source as archive material, but they are not authoritative.
7. Never place API keys, passwords, AWS secrets, private tokens, or sensitive user data in this document.

