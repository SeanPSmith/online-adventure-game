# Tales of Two — Master Project Documentation

> **Canonical project document.** This file replaces the old append-only changelog workflow.
> Update or rewrite the relevant sections in this file as the product changes; do not create another numbered changelog copy.

**Last consolidated:** 2026-10-08  
**Current local baseline:** Pass 52 (staged adventure opening and immersive recovery copy), built on Pass 51  
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

The visual language is intentionally terminal/IRC/VGA-inspired: strong compartment borders, chunky mono typography, segmented RPG meters, deliberately retro arcade graphics, and modern input/UX behavior. Pass 35 formalizes a semantic two-accent hierarchy: muted terminal blue owns structural chassis, panel headers, page bands, section dividers, and informational chrome; phosphor green is reserved for live state, actions, selection, scores, meters, success, and other changing gameplay signals. Amber/red remain exceptional warning/failure colors rather than general decoration.

---

## 2. Current Product Surfaces

### Public / authentication

- `/` — product-first public homepage explaining solo/co-op play and the core game loop.
- `/login` — sign-in with protected-route return-path preservation.
- `/register` — account creation with return-path preservation through the follow-up sign-in.
- `/forgot-password` — honest recovery-status page; the backend reset endpoint is not connected yet and the page does not collect fake reset requests.
- `/rulebook` — public player-facing RPG reference; authenticated players can still use `/game/rulebook`.
- `/privacy` and `/terms` — public product/legal notices.
- `/join/:roomCode` — shareable co-op invitation deep link.
- registration/login preserve the requested invite or protected-route target and return the player to that intended destination.

The public shell uses one terminal/IRC visual language across home, auth, legal, invitation, and rulebook surfaces. Desktop navigation prioritizes How It Works, Rulebook, player access, and Play/Create Hero rather than legal links. On phones it collapses into an explicit menu. The global public footer owns About/How It Works, Rulebook, Privacy, Terms, feedback status, product identity, and the deployed frontend build fingerprint.

### Player game area

- `/game` — Adventure Hall / authenticated dashboard.
- `/game/heroes` — Hero Hall.
- `/game/heroes/:heroId` — Character Sheet.
- `/game/adventure/...` — live adventure room.
- `/game/adventures` — My Adventures: Active, Completed, and Abandoned shelves.
- `/game/history` — legacy completed Chronicle archive remains accessible.
- `/game/arcade` — player Arcade; administrators see the same route as Arcade Lab with publication controls.
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

### React frontend loading (Pass 49)

The React router keeps the minimal shared public/game/account shells, authentication gate, route-error boundary, and not-found handler in the entry module. Public, Hero, Adventure, Library, Arcade, Author, Admin, and Account pages use React Router's native `route.lazy` dynamic imports and are fetched only when navigated to. Repeated uses of the Rulebook route reuse the same module chunk. `RootLayout` announces pending route transitions without taking over or clearing the current screen. Failed dynamic-import/chunk requests show a recoverable route error with an explicit reload button (for example, when an older browser tab references chunks replaced by a new deployment). This changes bundle loading and presentation only; it does not affect backend routes, auth entitlements, game state, or story generation. The release pipeline continues to build and upload Vite's generated assets as a unit; a lazy chunk must never be deployed without its matching entry and manifest assets.

### Pass 52 — Adventure lobby and immersive recovery copy

The first chapter is authored at seed-approval time, **not** requested from OpenAI when a player enters the lobby. The backend exposes `opening_ready` (nonempty opening prose and at least one available choice) plus `adventure_synopsis` (published player synopsis, falling back to adventure description). Room start is gated on both opening readiness and the correct number of online Heroes. The lobby stages the synopsis and party roster, then enables **GET STARTED** only when the opening is ready and the host can begin. This requires no new user accounts, data migration, background tasks, or model tokens.

`useTurnTheater` must never infer that a story turn has been locked merely because the pre-start `readiness` snapshot marks an online Hero as ready: `game.started` gates all intermission, countdown, receipt, and retry presentation. A new lobby cannot enter the intermission theater. Resume logic for *started* rooms is unchanged.

Public player-facing lost-route and route-error copy uses the adventure/chronicle voice, with explicit reload and Adventure Hall recovery actions. Technical error details remain out of the rendered error boundary; use logs/telemetry for diagnosis. `docs/COPY_VOICE_GUIDE.md` records the next sitewide pass; player clarity and security take priority over fantasy metaphors.

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

1. Player selects a Hero and opens an adventure card.
2. The card/preflight shows a dedicated AI-written literary synopsis, not copied Author Studio fields or a location/lore inventory.
3. Entering creates a **pre-start lobby**. The approved adventure seed already contains the real Turn 1 scene and real choices, so no live Director request is required merely to open the story.
4. In Co-op, the required Heroes are considered ready when present and online. The host may share `/join/:roomCode` or switch the still-unstarted room to Solo.
5. Once the required party is ready, the host presses **GET STARTED**. This flips persisted room/session launch state and reveals the already-prepared Turn 1 immediately.
6. Story choices are unavailable before launch and are never used as a fake readiness/start signal. The old generated `LET'S GO` opening choice is retired.

### Turn loop

1. Director/story scene is displayed.
2. Players select and lock choices.
3. Python freezes authoritative TurnFacts and rolls/check inputs.
4. A low-cost recap request and the next-scene Story Director request launch in parallel.
5. As soon as the cheap recap is available, the dice/result receipt may be shown **before** the next scene finishes writing. If the player clears the receipt first, the arcade/intermission masks only the remaining story-writing tail.
6. The Story Director writes the **new** playable beat rather than re-narrating the previous roll. It may use at most a 1-2 sentence causal bridge before moving forward.
7. Generated output is validated and committed.
8. New scene/choices arrive and the story viewport returns to the top.
9. Resolved turns remain available in the compact in-room Turn History carousel with prior choices, checks/outcomes, and recap text.

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
- write like a readable adventure novel: concrete, descriptive, spatially grounded, and clear about where the Heroes are, what is physically happening, and what their immediate role/problem is;
- keep high-weirdness adventures strange through events, characters, imagery, consequences, and choices rather than through opaque or nonsensical diction;
- introduce unusual setting terms in ordinary language before relying on them, instead of dropping unexplained pseudo-jargon into the scene;
- produce structured output that Python can validate;
- keep narrative interesting without allowing the LLM to own mechanics.

The governing readability rule is: **mystery is allowed; confusing prose is not.** A player may be uncertain about why something bizarre is happening, but should not be uncertain about what just happened, where it happened, or what their Hero can react to.

### Latency and token-budget strategy

Director latency is masked and bounded rather than allowed to grow with the chronicle:

- **Turn 1 is pre-generated with the approved seed**, including its title, novel-like body, and 3-6 real actions, so GET STARTED never waits on a runtime model call;
- generation begins as soon as authoritative turn facts are frozen for subsequent turns;
- the inexpensive recap narrator (economy model / low reasoning) reads the frozen TurnFacts and can surface the dice/result receipt while the main Story Director is still writing;
- normal story turns keep the strong story model but use **low reasoning**; medium reasoning is reserved for Finale Window / Wrap-Up / Finale beats;
- routine turns are capped around a 4.8k provider output budget and high-stakes closing beats around 5.6k rather than increasing toward 9-10k as the run gets longer;
- runtime seed context excludes the player synopsis and the already-consumed pre-generated opening; potential-finale planning is withheld until convergence;
- structured story-state context is deterministically windowed (active NPCs/threats, facts, threads, items, advantages, consequences, closed opportunities) so long chronicles cannot feed an ever-growing ledger back into every request;
- only the two most recent compact turn-history entries and two recent micro-events are sent as redundant continuity context;
- JSON input is compact-serialized rather than pretty-printed;
- repair work uses the economy model with low reasoning instead of spending another full story-model pass;
- choice/opening freshness remains validated/logged but **does not trigger a second full-turn regeneration**. Playability beats stylistic perfection;
- dice/result presentation and arcade intermissions mask whatever generation time remains.

### Output reliability

The system includes strict structured validation, deterministic normalization, one bounded economy-model repair path for malformed/invalid structured output, hard timeout/retry state, and persistent pending-turn recovery. Frozen choices and rolls are never rerolled on retry. Provider/context telemetry logs request size, compact story-state size, elapsed time, and token usage so future budget tuning can be driven by actual runtime data.

### Turn recap continuity

The fast post-roll recap is a readable rendering of the same frozen authoritative TurnFacts used by the Story Director. It is deliberately a **cheap result-page job**, not part of the expensive prose-generation responsibility: one compact paragraph normally covers each Hero's intent, actual roll/check outcome, concrete success/failure, supplied bodily/positional/social consequences, and explicit HP/effect/item/clue/relationship changes. It never invents the next scene or choice. The live Director receives the same frozen facts but is explicitly told not to repeat the recap; after at most 1-2 causal bridge sentences it must move the chronicle forward.

### My Adventures / player library

`/game/adventures` is the player's unified library, reachable from primary navigation and Home. Active, Completed, and Abandoned shelves include search, party/Hero names, turns, saved/completed dates, World where available, and a previous-story receipt. Active entries continue through the existing room/Hero-authorized resume route; pending turns use its existing recovery controls. The read-only authenticated `/api/player/adventures` endpoint never starts AI generation. Completed records are queried by account and deduplicated across Heroes, with readable archived turn receipts and Chronicle sharing. Starting another adventure opens the existing catalog and creates a fresh run rather than resetting history.

Host abandonment archives an account-scoped unfinished record for each party member before deleting the room. Archived runs cannot be resumed and do not count as completed adventures. Previous abandonments cannot be reconstructed because earlier releases deleted them. Account deletion removes abandoned records containing the account, including shared party records, to avoid retaining deleted identity data. SQLite/PostgreSQL-compatible initialization adds the archive table and legacy-safe history metadata columns. Dates indicate the latest persisted snapshot, which may include connection state changes; they are not a separate activity analytics clock. World/mode metadata unavailable in old completed records remains blank.

### In-room turn history

The live Adventure sidebar exposes resolved turns as a compact previous/next carousel. Each history card shows the resolved scene, each Hero's selected action, check outcome/roll/DC when present, the resulting recap, and the title of the scene that followed. Player history is persisted in a separate `turn_archive` (defensively capped at 100 entries; the live socket snapshot exposes the latest 50) and **never feeds the Story Director prompt**. Director context remains independently capped to its small recent-history window, so browsing a long playthrough does not increase AI context or token cost. Legacy room snapshots without `turn_archive` fall back to their existing Director history.

### Story reveal presentation

Players can enable/disable **word-by-word story reveal** in Account Center → Preferences. New scene prose fades in one word at a time, can be skipped instantly with `REVEAL ALL` or by clicking the story, and automatically disables animation when the browser requests reduced motion. This is presentation-only local state; the complete scene text remains available to assistive technology and never affects game authority.

### Scene ASCII art pipeline

AI-directed opening and turn scenes use a deterministic server-side ASCII compositor rather than the old generic `STORY` placeholder. The compositor derives a scene family from committed scene title/body plus current goal, threat, and tone hints, then renders a bounded terminal composition. Current scene families include store/market, road/vehicle, forest/outdoors, chapel/cemetery, water/shoreline, house/interior, facility/warehouse, and a generic fallback.

ASCII art is decorative and **must never own or block story truth**. It requires no additional model/API call and is stored in the dynamic scene payload so recovery/reload sees the same art. The implementation seam is `app/generation/ascii_art.py`, allowing a future image-to-ASCII or async renderer without changing game-state authority.

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

When a local Hero crosses a level threshold during turn progression, that player receives an explicit **Hero Advancement / Congratulations** modal after the resolution theater. In co-op each player receives their own modal when their own Hero levels. If the same turn also opens a QTE, the level-up celebration is shown first so the QTE's visible countdown cannot run behind another modal.

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

Quick-time events are authored as part of the story beat instead of being assembled afterward as generic reactions. Python still owns cadence, timing, resolution, persistence, and mechanical effects.

Current behavior:

- QTE cadence remains server-owned; the Director is only asked to author one on a turn where Python has already determined that a quick event is due;
- on an eligible turn, the Director generates the QTE in the same structured response as `scene_body`, but **QTE mechanics are a separate UI layer**. Story prose contains only the fictional cue/hazard/opportunity and may not mention QTEs, quick reactions, timers/countdowns, odds, correct/right/wrong answers, option labels, buffs/nerfs, or the coming prompt; schema validation rejects leakage and routes it through Director repair;
- each QTE has **2 or 3 plausible choices and exactly one correct answer committed before the player responds**; two choices therefore have a 50% blind baseline and three choices roughly a 33% blind baseline, while attentive reading can improve the player's odds;
- the committed correct option remains server-private while the event is live and is only revealed as a label after resolution; the system never chooses success after seeing the player's response;
- a correct response grants a contextual **one-round buff** and an incorrect response or timeout applies a contextual **one-round nerf**;
- QTE effects are real Hero effects using validated Attributes/Skills and bounded `+1/+2` or `-1/-2` modifiers; they persist into the next resolved story round and then expire automatically;
- by default the effect applies only to the Hero who performed that QTE; group-wide events should be explicit rather than accidental;
- playable countdown begins only when the QTE is actually visible; a level-up celebration or turn-resolution theater cannot consume QTE time behind another overlay;
- keyboard, click/tap, and directional input are supported; three-choice events also expose a third key path;
- timeout sends a real resolving response instead of leaving the adventure blocked;
- offline partners cannot permanently hold a QTE open;
- after selection, the QTE shows right/wrong reaction feedback, the temporary effect earned/applied, the correct response, and then waits for the player to explicitly continue the story.

The design goal is that a quick event should feel like a sudden playable sentence in the current scene, not a disconnected reflex mini-game.

---

## 10. Intermission Arcade

The Intermission Arcade exists to occupy Director generation latency without delaying story generation.

### Runtime contract

Arcade cabinets are disposable React modules inside a shared runtime. They receive presentation/input context and report local score; they do not own Socket.IO room state, Director calls, XP, or persistence.

A cabinet must tolerate being unmounted at any moment.

### Registry / lab / publication

- Cabinet registry: `frontend/src/features/arcade/ArcadeGameRegistry.tsx`
- Arcade route: `/game/arcade`
- Ordinary players see only cabinets currently published by the backend.
- Administrators see every registered cabinet and receive **PUSH / PULL** controls directly in the Arcade Lab.
- Publication state is persisted in `arcade_publication`; it survives backend restarts/deploys and cannot be changed by non-admin clients.
- New cabinets enter as **LAB ONLY** by default and are promoted to the player Arcade only after an administrator deliberately pushes them live.
- This publication switch controls the standalone player Arcade. The six historical story-intermission slot IDs remain a separate compatibility layer for now.

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
- Hangman // VGA — dedicated keyboard/touch Hangman split out from the combined Word Cabinet;
- Beer Pong — isometric/three-quarter physics table with horizontal aim, vertical power, a visible projected arc/landing cue, ball shadow, real table/rim bounces, 1-2-3 cup collision, and reracks;
- Pixel Hoops — side-view ANGLE + vertical POWER shooting with deterministic per-shot two-point geometry variation: shooter position, basket horizontal position, and rim height move between attempts while simulated ball motion, rim contact, backboard rebounds, and basket capture determine the result;
- Blackjack — dealer blackjack with visible shoe/deal animation and explicit Blackjack/Win/Push/Bust/Loss presentation;
- War // Cards — persistent face-down player/house decks, animated top-card draws, real deck counts, war pots, and explicit battle/game outcomes;
- Radar Fleet — Battleship-style hidden-fleet hunting with a visible fleet manifest, ship lengths, hull-hit progress, shots fired, and sunk/afloat state;
- Mahjong Match — Mahjong-themed memory/pair matching with explicit pair manifest, moves, misses, accuracy, streak, and tiles-remaining state rather than full traditional Mahjong rules.

Every registered cabinet explicitly declares solo support, two-player support, and a multiplayer style (`simultaneous`, `alternating`, or `score_duel`). The standalone Arcade exposes a real **SOLO / 2 PLAYER** selector; 2 PLAYER uses a local hotseat match wrapper with separate P1/P2 score banks, match resolution, and rematch flow so every cabinet has a usable two-player modality without duplicating cabinet logic.

Adventure-room co-op remains two-device simultaneous play during Director latency: each room player gets a live run and the authoritative server compares submitted scores. The runtime now surfaces the cabinet's intended multiplayer style rather than silently presenting every cabinet as generic solo play. Truly shared networked turn-by-turn cabinet state (for example direct Battleship boards or a synchronized card table) remains a later arcade-networking layer rather than being faked client-side.

### Game-feel rules

- controls should be immediately understandable;
- each cabinet may use its own DOS/VGA/Atari/Nintendo-era color and motion vocabulary inside the shared Tales of Two shell; retro cohesion matters more than pure ASCII;
- shot controls use a consistent physical vocabulary: horizontal AIM + vertical POWER for ordinary ball games; Golf/Bowling retain a third SHAPE/SPIN control; timing bars should be forgiving enough for a short intermission;
- hits/misses/wins/crashes must be visually unmistakable;
- score feedback is a shared runtime contract: cabinets without custom contextual feedback automatically receive score popups from the Arcade/Intermission host;
- continuous action/reflex/racing/movement cabinets use compact corner feedback so scoring never blocks the playfield;
- slower puzzle/sport/strategy/round-based cabinets use large result overlays and deliberately pause after a result before resetting;
- custom-feedback cabinets may replace the generic score popup when they need richer vocabulary such as SWISH, BUST, WAR, GAME WON, or GAME LOST;
- discrete-shot sports should visibly stage setup/action/result/reset rather than instantly snapping into the next attempt;
- card games should visually deal/draw cards and expose meaningful table state such as deck counts, hidden cards, pots, and outcomes;
- mobile action games should account for smaller reaction space;
- movement cabinets should support swipe where appropriate;
- repeated plays should vary board size, speed, traffic, wind, lane condition, layout, word, rack state, terrain, and target position rather than replaying identical geometry;
- Gorilla Artillery generates seeded uneven terrain with collision, places combatants on terrain elevation, relocates the target after each volley, and generates a new battlefield after a knockout; the same adventure turn begins from the same seeded battlefield for both co-op players;
- Find the Outlier specifically randomizes both board size (5×5 through 8×8) and a curated near-lookalike symbol pair every round, without immediately repeating either;
- Highway 84 increases speed and traffic pressure during a run and awards extra points for risky clearances / near misses;
- physical actions should visibly animate their consequence; where a cabinet is fundamentally about a ball/object collision, simulated motion/collision should determine the result before scoring instead of merely illustrating a preselected outcome;
- Bowling uses a top-down lane and simulated ball/pin bodies so hook, gutters, pin-to-pin contact, and knockdown count come from the shot;
- retro graphics may be crude; feedback, rhythm, and readability must not be.

Canvas is preferred for current 2D/pseudo-3D VGA cabinets. Three.js is reserved for cabinets that actually benefit from a 3D camera/scene graph.

---

## 11. Authoring System

The Author system deliberately separates **durable World canon** from **one-adventure direction**. Worlds define the nouns, laws, history, places, people, factions, and persistent truths of a setting. Adventure Briefs define what is happening now inside a linked World: the hook, goal, run controls, featured World material, local facts, beats, restrictions, and replay behavior.

Author source documents use **schema v3**. Existing schema-v2 documents are ported forward on read and become native v3 the next time an editable draft is saved. Historical published rows remain immutable. Legacy values with an obvious destination are moved automatically; ambiguous values are retained in a read-only migration snapshot and surfaced in a migration review panel rather than silently discarded. Legacy repeatable items receive deterministic IDs so new Brief references remain stable even when the linked World has not yet been resaved as v3.

### World source scope

Worlds may define:

- World identity, genre, tone, baseline weirdness, pitch, and intended player experience;
- setting / World premise;
- canonical World truths;
- World rules such as magic, technology, supernatural, social, or physical constraints;
- persistent locations;
- recurring people, factions, affiliations, motives, knowledge, secrets, and canonical facts;
- lore / secrets and who knows them;
- canon boundaries / forbidden uses;
- ongoing tensions and unresolved World-level threads;
- default humor, danger, violence, and weirdness flavor;
- Director-visible notes;
- private Author notes.

A World does **not** own adventure length, difficulty, primary/secondary adventure type, required moments, replayability, NPC introduction timing, choice guidance, or failure philosophy. Those are run/adventure concerns.

### Adventure Brief source scope

Adventure Briefs may define:

- Adventure identity, primary/secondary type, length, difficulty, tone, and weirdness override;
- starting situation / hook;
- core goal or immediate pressure;
- adventure-local facts / conditions that are true for this story without becoming World canon;
- featured World locations, people/factions, and lore/secrets by reference;
- adventure-only locations, NPCs, and secrets when genuinely local to the run;
- required / preferred / inspiration moments;
- adventure restrictions;
- adventure-specific story threads;
- choice guidance and the game-level failure-becomes-complication behavior;
- replayability guidance;
- Director-visible notes;
- private Author notes.

The key rule is **reference instead of duplicate**. If a World already defines Blackwater Hotel or Mayor Higgins, the Brief selects that World entity and adds only adventure-use metadata such as importance, timing, role in this story, or reveal treatment. The Brief does not need to rewrite the entity's canonical biography or location lore.

World references are read-only links to the linked World source. Adventure-local entities remain separate. Runtime generation receives World and Brief as two authority layers; Brief references can require/feature existing World material without copying it into Brief canon. Generation validates every featured reference against the exact selected published World version and stops with a clear mismatch error if the Brief points at material that exists only in another/draft World version.

### Canon and precedence

Generation should interpret source authority in this order:

1. World canon / World rules / canon boundaries;
2. Adventure facts, featured World references, required moments, and adventure restrictions;
3. Adventure preferences and story guidance;
4. one-off generation requests.

A Brief may specialize how World material is used in one adventure, but it must not silently rewrite durable World canon.

### Director notes vs private notes

`director_notes` are intentional AI/runtime instructions and may be included in authoring/generation context.

`private_notes` are for the human author only. They are stored with the source document but are removed from compiled generation input, runtime source, linked-World AI context, and AI-assisted field/item prompts.

Legacy `freeform_notes` migrate to Director Notes because historically they were generator-visible.

### Document strength

Worlds and Briefs have separate strength rubrics. A World is not penalized for lacking required adventure moments or replayability. A Brief is not penalized for correctly referencing World entities instead of duplicating large location/NPC/lore catalogs.

### AI Helper philosophy

AI authoring remains a first-class feature and is scoped, not a one-click replacement for authorship.

- Text fields can expose a small **AI** helper.
- Repeatable objects (NPC, location, lore item, thread, etc.) can expose **AI ITEM** expansion.
- Author provides one sentence of intent.
- AI fills only the requested field or empty/default portions of the selected item.
- Existing authored canon must not be overwritten silently.
- Title/slug/critical identifiers and server-authoritative values are protected.
- World AI is instructed to deepen durable setting canon without inventing adventure beats or NPC introduction timing.
- Brief AI receives the linked World as read-only context and should reference existing World material rather than restating/reinventing it.
- Private Author Notes are never included in AI context.

Example World input:

```text
"unnamed evil entity, mysterious, speaks in riddles"
```

can expand into durable NPC/setting guidance without deciding that the entity appears in Act III.

A Brief can then feature that same World NPC and add adventure-only instructions such as `importance=major`, `timing=late`, and "initially helpful, increasingly evasive" without rewriting the NPC's canonical identity.

### Player-facing synopsis

Generated adventures persist a player synopsis produced by a **dedicated lightweight AI copy pass every time**. The synopsis is one or two short literary paragraphs that infer the adventure from safe planning data rather than quoting/cleaning the Brief. It must read like novel jacket copy: atmospheric and inviting, without listing locations, NPC dossiers, lore entries, objectives, tags, hidden truths, finale plans, mechanics, forms, or design notes. If that optional copy pass fails, the validated seed synopsis remains the fallback so generation itself is not blocked.

Retired seeds are hidden from new player discovery while existing rooms using them remain recoverable. **Publishing a newer World or Brief version, or archiving an older source document, does not unpublish previously approved generated seeds.** Playable seeds retain their approved runtime identity and content until an Author explicitly selects **RETIRE** in that Brief’s Generated Seeds panel. After retirement, refresh the Adventure Hall to request an updated catalog; active runs remain recoverable. Archived Briefs can be opened using the Author library’s Archived filter to retire seeds sourced from them.

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
- direct Tales of Two account ping by username/email;
- sign-in/registration return-to-invite;
- Hero creation return-to-invite;
- direct Hero selection and join.

Invite controls are host-only and only appear while a co-op slot is open. Live scenes/endings and sealed Chronicles also expose explicit share actions using the native Share API when available with copy fallback. Direct account ping is distinct from link sharing: the server resolves an existing account without exposing account-existence details and routes the invite through that player's opted-in notification channels. Server-originated account invites are throttled so the feature cannot become a push/SMS spam button.

### Room Hero inspection

During a live co-op adventure, the Hero sidebar can switch between room participants. The local Hero remains fully actionable; partner Heroes are read-only. The server emits room-scoped public Hero snapshots containing only adventure-facing fields (name, bio, level/XP, HP, core stats, active effects and progression display values). The normal character API remains owner-only; room inspection must never weaken character ownership checks or expose inventory/owner metadata.

### ASCII social language

The multiplayer shell uses a curated terminal-style reaction vocabulary rather than generic modern emoji. Reactions are grouped by intent (happy/social/suspicious/panic/chaos/sad/idle) and reused across chat reactions, player presence, and lightweight notifications. Keep the library expressive but readable on phones and avoid visual noise.

### Partner activity notifications

Current notification events include:

- direct room invite;
- partner joined;
- partner locked a choice / Your Turn;
- results/story beat ready;
- finale ready.

The same event payload can fan out through four independently controlled surfaces:

1. **In-app terminal notice** while the React client is connected.
2. **Real Web Push** through a root-scope service worker and persisted Push API subscription. This is the primary closed-page/device notification path and does not depend on AWS messaging products.
3. **Email through Amazon SES**, opt-in and only available when staging is configured with a verified `TOT_NOTIFICATION_EMAIL_FROM` identity.
4. **SMS through AWS SNS**, opt-in, disabled until the player completes a six-digit phone verification flow, and subject to AWS SMS sandbox/account restrictions.

Push/email/SMS preferences and event filters are durable account data. New profiles default `RESULTS READY` alerts off so enabling a paid/remote channel does not immediately create a per-turn notification stream; players can opt into result alerts explicitly. In-app display preference remains local to the browser. Web Push permission is requested only from an explicit player action. The server-generated VAPID key pair is persisted in the durable application database so subscriptions survive backend deployments. Expired Push endpoints are removed when their push service returns 404/410.

External channel delivery is deliberately **off the authoritative gameplay path**. Socket/game state emits first; push/email/SMS work runs in isolated tasks so third-party latency or failure can never block a turn, reroll, or roll back game state.

The frontend deploy must publish `/notification-sw.js` with revalidation/no-cache headers even though hashed Vite assets remain immutable.

### Account Center

`/account` is the single player-facing self-service hub. It uses site-native tabs for Profile, Preferences, Notifications, Security, and Billing. Players can update username/email with current-password verification, change passwords, inspect active-session metadata, sign out other devices, manage the existing notification channels/event filters, and control story presentation preferences. The Billing tab remains payment-provider-free, but now shows the player's real playtest entitlement and metered AI usage. Server-side Pass 43 guardrails enforce per-account monthly request/spend allowances plus a configurable global daily request/spend ceiling before OpenAI calls leave the app. Admin accounts are exempt from per-account allowance caps but not from the global kill switch.

Pass 43 defaults are intentionally conservative and environment-overridable: `TOT_AI_PLAYTESTER_MONTHLY_BUDGET_USD=5.00`, `TOT_AI_PLAYTESTER_MONTHLY_REQUEST_LIMIT=500`, `TOT_AI_GLOBAL_DAILY_BUDGET_USD=25.00`, and `TOT_AI_GLOBAL_DAILY_REQUEST_LIMIT=1500`. `TOT_AI_MODEL_PRICING_JSON` can override per-model input/cached-input/output rates without changing application code. Usage events store token counts, model, operation, latency, failure state, room/adventure scope, and estimated USD; they do not store prompts or generated story text.

Account deletion is a real destructive operation protected by current-password verification plus typed-username confirmation. Deletion removes the login identity, sessions, permissions, notification registrations, phone verification data, owned Heroes, personal history identity, and active room snapshots that still contain the account. Shared published author artifacts and generated adventures are preserved only when required for other players, with creator attribution replaced by a deterministic deleted-account tombstone so the deleted identity is no longer retained as authorship metadata. The legacy `/settings` route redirects into Account Center preferences.

---

## 14. Dashboard and Gameplay UI Direction

### Public shell hierarchy

The public product shell is intentionally sparse and game-like rather than a generic marketing site:

1. immediately explain that Tales of Two is an AI-directed text-adventure RPG for solo or two-player co-op;
2. make `PLAY`, `CREATE HERO`, and `SIGN IN` obvious without turning the header into a duplicate CTA wall;
3. explain the loop as Hero → choice → authoritative resolution / Director continuation;
4. show solo and co-op as first-class modes;
5. keep legal/about/reference links in the footer unless they are needed for the current task;
6. remove fake or non-functional controls rather than presenting disabled product scaffolding as a feature.

The public pages share constrained widths, terminal borders, chunky mono typography, consistent buttons/forms/errors, and phone-first responsive behavior. No public page should require horizontal scrolling at the 320px minimum viewport.

### Semantic color hierarchy

The interface must not use one accent color for every information layer. The canonical color roles are:

- **structural blue** — shell/header chassis, panel heading bands, page-title framing, section dividers, modal chrome, grouped RPG sub-panel headers, and other information architecture;
- **live green** — actionable controls, current/selected state, health/XP/meters, dice/check results, scores, successful outcomes, online/live indicators, and other changing gameplay signals;
- **dark neutral surfaces** — reading/content bodies so blue structure and green signal remain distinct;
- **amber** — caution, advancement emphasis, time-sensitive special state;
- **red** — failure, destructive actions, or errors.

The design rule is: **green should mean alive**. If an element is static framing or organization rather than live state, it should normally use the blue/neutral structural layer instead of bright green. This is inspired by compartmentalized retro terminal/HUD design rather than a literal recreation of any specific game interface.

### Dashboard hierarchy

The authenticated home is organized around:

1. Continue Journey / recovery.
2. Join a Friend.
3. Your Heroes.
4. Searchable Adventure Library.
5. Secondary System tools.

The normal Adventure Library synopsis has an explicit **Solo / With a Friend** selector, defaulting to Solo. Selecting Solo creates a one-Hero room ready for **Get Started**; choosing With a Friend creates a two-Hero party lobby requiring both Heroes online. The player should never unknowingly enter a two-Hero waiting lobby just by choosing a story. Existing co-op lobbies still have a pre-start **Start Solo** conversion; existing unfinished runs are resumed or abandoned rather than resetting accounts or Heroes.

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
- completed adventure history and account-scoped abandoned adventure records;
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

The frontend deploy stamps `VITE_BUILD_ID` from the current short Git SHA before Vite builds. The public footer renders that value as `BUILD // <sha>` so testers can distinguish a stale browser bundle from the source tree that was actually released. Local development falls back to `BUILD // DEV`.

The low-level AWS deployer remains:

```bash
./scripts/aws/deploy-game-staging.sh
```

Use the release wrapper for normal work; use lower-level scripts for diagnostics or targeted infrastructure work.

Pass 33 adds one targeted infrastructure helper for notification IAM/runtime configuration:

```bash
./scripts/aws/deploy-notification-infra-staging.sh
```

Run it once when enabling SMS permissions or changing the public notification URL. To enable SES as well, supply an SES-verified sender identity for that deploy:

```bash
TOT_NOTIFICATION_EMAIL_FROM=notifications@example.com \
  ./scripts/aws/deploy-notification-infra-staging.sh
```

The ordinary release script still owns application code/image/frontend deployment; infrastructure remains an explicit operation.

### Source review package

Use:

```bash
./scripts/package-for-review.sh
```

The review package should exclude dependencies, builds, caches, secrets, databases, backups, and Git history.

---

## 17. Testing / Safety Expectations

The Python regression suite lives under feature-owned directories in `tests/`,
with its inventory and commands in `tests/README.md`. Pass 50 renamed and
relocated the 53 existing modules without intentionally deleting any tests;
`tests/support.py` centralizes the project root for source-contract checks.
`./scripts/check-project.sh` continues to run `python3 -m pytest tests -q`
before the frontend and infrastructure build gates. The one-time
`scripts/apply-pass50-test-layout.sh` cleanup removes only the old root-level
test copies, once all replacement paths are present.

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
- Web Push now provides true closed-page notifications, but browser/platform behavior still varies (notably mobile installation/permission rules) and requires real-device testing.
- The arcade server still uses six historical intermission slot IDs for persistence compatibility; new cabinet rotation should eventually become versioned server-side.
- Admin analytics derive largely from existing persisted state and completions; a dedicated product-event ledger is future work.
- Director latency/reliability remains an important ongoing focus; retries are recoverable but generation should continue to be profiled and optimized.
- Real two-player playtesting remains essential for validating asynchronous co-op timing, notification usefulness, and long-session UX.
- Public feedback mail is intentionally configuration-driven; set `VITE_FEEDBACK_EMAIL` to activate the footer feedback link. Without it, the footer reports the channel as offline rather than inventing a destination.

---

## 19. Near-Term Roadmap

### Product / gameplay

- continue real co-op playtesting and fix flow defects before adding unnecessary mechanics;
- verify all Pass 49 lazy deep links and page-transition/loading recovery behavior across desktop/mobile, including a previously open tab after a staging deployment;
- improve story-generation latency/telemetry without reducing narrative quality;
- continue UI hierarchy/readability refinement based on actual sessions;
- tune progression, Talents, DC scaling, and XP from real Hero builds;
- playtest authored QTE clarity, difficulty, effect magnitude, and one-round buff/nerf feel in real co-op sessions.

### Social

- measure Web Push opt-in/delivery behavior on actual desktop and mobile devices;
- complete SES sender/domain verification before enabling email in staging/production;
- verify AWS SMS production access/cost controls before broad SMS use;
- improve invite conversion/partner waiting UX and eventually support richer asynchronous partner status.

### Story longevity

Explore episodic/persistent-world systems such as:

- weekly generated lore/episodes;
- recurring worlds and characters;
- campaign chapters;
- longer epic journeys;
- endless/continuing adventures where resolved arcs can seed new arcs instead of requiring a hard permanent ending.

### Arcade

- playtest the Pass 36 cabinet revisions in Admin Arcade Lab before publishing them broadly;
- playtest the Pass 37 physics/readability revisions: Hoops rim/glass forgiveness, Beer Pong cup/rim/table collision tuning, Bowling pin-body tuning, Radar Fleet clarity, and Mahjong memory readability;
- playtest Pass 38 SOLO / 2 PLAYER hotseat flow across every published cabinet and tune Gorilla Artillery terrain/target relocation difficulty;
- verify Pixel Hoops `REV 38I` variable two-point shot geometry on desktop/mobile and confirm P1/P2 receive matching seeded layouts; verify Beer Pong `REV 38I` isometric depth cues make arc height, landing point, short/long misses, and the 1-2-3 rack immediately readable;
- continue using persistent PUSH/PULL controls instead of redeploying merely to change the player-facing Arcade catalog;
- keep new cabinets lab-first and prefer reusable feedback/card/projectile/grid engines;
- continue adding round-to-round variety so cabinets remain fun after the first few plays;
- a later arcade-networking pass may add true shared cabinet state for direct Battleship/card/etc. player-vs-player sessions.

---

## 20. Recent Release History

This is intentionally short. Historical numbered changelog files remain archive material; this section records only recent milestones needed to understand the current codebase.

- **Pass 29B — Public Site / Home / Footer Cleanup:** rebuilt product-first homepage, public Rulebook, responsive anonymous/authenticated navigation, unified auth presentation, real public footer, legal/product notices, and deploy-visible frontend build fingerprint.
- **Pass 31 — Story Clarity + Contextual QTE Progression:** novel-like grounded narration rules, Director-authored scene-coupled QTEs with precommitted answers, real one-round Hero buffs/nerfs, and explicit per-player level-up celebrations.
- **Pass 32 — Multiplayer UX + Sharing + ASCII Social Language:** room-authorized read-only partner Hero switching, explicit invite/live-moment/ending/Chronicle sharing, centralized terminal reaction vocabulary, plus randomized Outlier grids and symbols.
- **Pass 33 — Real Notifications:** persisted account notification preferences, real service-worker Web Push, direct account room invites, optional SES email, verified opt-in AWS SMS, and non-blocking external delivery isolated from authoritative gameplay.
- **Pass 34 — Arcade Expansion + Publication Control:** new cabinets plus persistent admin PUSH/PULL controls for the player-facing Arcade.
- **Pass 35 — Visual Hierarchy / Semantic Color System:** structural blue for shell/header hierarchy while phosphor green remains live gameplay / interaction signal.
- **Pass 36–38I — Arcade Gameplay / Physics / Modes Refinement:** richer cabinet presentation, ball/object physics, state readability, solo/two-player modes, terrain variation, side-view Hoops, and isometric Beer Pong depth cues.
- **Pass 39 — World / Adventure Authoring Separation:** introduces schema-v3 kind-specific World and Adventure Brief sources, loss-preserving legacy migration, deterministic legacy entity IDs, featured World references instead of duplication, separate strength rubrics, Director-vs-private notes, and linked-World-aware AI authoring while keeping generation compatibility.
- **Pass 40 — Instant Opening + Launch / Story Polish:** pre-generates the real first playable scene with the seed, separates persisted lobby launch state from turn choices, adds host GET STARTED + pre-start Solo switching, replaces browser-native React dropdown/confirm UI, always rewrites synopsis as literary player copy, hard-isolates QTE mechanics from story prose, strengthens post-roll recap continuity, and adds optional word-by-word story reveal.
- **Pass 41 — Story Runtime Budget + Turn History:** bounds Director input/output budgets, separates cheap post-roll recap from forward-moving prose, surfaces early result receipts while the next scene writes, prevents freshness checks from triggering full rewrites, caps long-run continuity state, and adds a player-only compact turn-history carousel that never feeds AI context.
- **Pass 43 — Usage Metering + Entitlements:** meters OpenAI seed, synopsis, author-assist, runtime story, recap, diagnostic, and repair calls; records tokens/latency/failures/estimated USD by user/adventure/operation; reserves budget before outbound calls; enforces per-playtester monthly allowances and a global daily kill switch; exposes allowance/usage in Account Billing and cost controls in the Admin Control Room. Pricing defaults are environment-overridable so rate changes do not require application logic changes.
- **Pass 42 — Account Center:** replaces the read-only profile card with a tabbed self-service account hub for profile editing, presentation preferences, notifications, password/session security, an honest billing stub, and password/typed-username protected account deletion while preserving shared published content with anonymized attribution.

---

- **Pass 44 — My Adventures / Resume / Player Library:** clean frontend installs now explicitly include `@types/node`; adds the authenticated account library and Active/Completed/Abandoned shelves, existing resume/recovery links, readable Chronicle receipts, search, saved dates, and durable abandonment archives.
- **Pass 45 — First-Run Guide + Starter Adventure:** account-aware onboarding, balanced Hero creation, and a three-turn First Light test flow.
- **Pass 46 — Playtest Operations + PostgreSQL Hero-history Hotfix:** Admin run and cost visibility, account/room operations, and typed-query PostgreSQL history fix.
- **Pass 47 — Adventure Reconnect Recovery:** restoration gate and offline-action guard for interrupted rooms.
- **Pass 48 — Mobile / Keyboard / Shared Dialogs:** mobile controls, visible focus and skip navigation, accessible modal focus/escape behavior.
- **Pass 49 — Lazy Route Delivery:** React Router route-level page splitting, accessible navigation-loading notice, and explicit recovery from failed chunk downloads; no API or database changes.
- **Pass 50 — Regression Suite Organization:** feature-oriented Python test packages and descriptive module names, centralized project-root handling, safe one-time deletion of old paths, and suite documentation; no product runtime or database changes.
- **Pass 51 — Solo Story Launch & Catalog Clarity:** normal story catalog now explicitly selects Solo (default) or With a Friend before room creation, and Author archiving warns that approved generated seeds require separate retirement; no database changes.
- **Pass 52 — Lobby Chapter Staging & Immersive Recovery:** fixed pre-start presence wrongly launching intermission theater; staged published synopsis and validated opening chapter, protected Get Started at server and client, and revised 404/route-error player copy. Added copy voice audit and launch regressions; no DB migration or additional model calls.


## 21. Documentation Policy

Going forward:

1. `docs/PROJECT_MASTER.md` is the **canonical current-state documentation**.
2. Do **not** create `PROJECT_CHANGELOG 21.md`, `PROJECT_CHANGELOG 22.md`, etc.
3. Do **not** append endlessly to the canonical document.
4. Rewrite the sections affected by a release so they describe what the system **is now**.
5. Keep the **Recent Release History** short and roll older entries out when they stop being useful.
6. Historical changelogs/README pass files may remain in source as archive material, but they are not authoritative.
7. Never place API keys, passwords, AWS secrets, private tokens, or sensitive user data in this document.



---

## Pass 45 — First-Run Onboarding + Starter Adventure (2026-10-08)

**Latest implementation baseline: Pass 45, following the Pass 44 player library.** This update is appended to the canonical document in `docs/PROJECT_MASTER.md`; preceding content is preserved. Future pass notes should also be appended here rather than replacing prior notes or creating numbered master copies.

### Player first-run experience

Home offers a short three-step guide: choose/create a Hero, select Solo or With a Friend, and open the First Light starter lobby. The guide explains Hero, World, and Adventure in player language, describes co-op choices and invites, and points players to My Adventures for automatic save/resume. New players with no account-scoped Active, Completed, or Abandoned records see the guide automatically; existing players can reopen it with **How to Start**. **Skip Guide** is saved per account on the server, survives browser/device changes, and does not block playing. An unavailable preference service leaves Home and the manual guide usable. Existing account histories prevent repetitive onboarding.

Hero creation offers **Use Balanced Starting Abilities**, assigning the required attribute/skill point budgets within creation caps while preserving editable values. Name and optional Bio remain player-authored. Hero creation returns to Home when entered from the guide. Available-Hero selection excludes deceased Heroes and those in unfinished adventures. Lobby and Hero-creation copy use player terms instead of Author/Director terminology.

### Curated starter: First Light

`first_light` is a separately registered built-in Adventure in **Lantern Harbor**, visible in the regular catalog and recommended in onboarding. Players return a lost lighthouse lantern over three short turns, estimated at 5–10 minutes, for 1–2 Heroes. The introduction explains actions, dice checks, locking choices together, and saving. Every route reaches the same authored ending; poor dice rolls still advance the story. This finite static story makes no model requests and requires no generated/approved author content to begin.

Solo selection is carried in the `create_room` socket payload and applied before the room is persisted or announced. Co-op retains the existing two-Hero party gate and lobby invitation flow. Both modes still require the host to press **Get Started**; the guide does not bypass lobby readiness or character ownership.

Static sessions now preserve compact player turn receipts. Adventures declaring `terminal_scene_ids` complete when a resolved turn enters one of those scenes, using the configured ending label and terminal prose. Existing looping internal adventures have no terminal marker and retain their prior behavior. The normal finale, Hero progression, completion persistence, Chronicle, and resume protections apply to First Light. Static stories do not schedule AI QTEs.

### Persistence and operations

Authenticated `/api/player/onboarding` reports whether the automatic guide should appear. `/api/player/onboarding/dismiss` requires an authenticated session and the site's account-request header, and writes only that account's preference. The compatible initializer adds `player_onboarding` with an idempotent account-scoped dismissal row. Account deletion removes that row. No new subscription, payment provider, publishing permission, or paid AI path is introduced.

### Validation and deployment

- 306 Python tests passed, including 20 new checks covering every starter route in solo/co-op, final Chronicle persistence, zero Director usage, persistent account-scoped skip preferences, authentication/request guards, and requested room-mode/readiness behavior.
- Existing browser JavaScript syntax, React TypeScript/production build, and AWS CDK TypeScript build passed.
- Browser visual/mobile QA remains unverified in this environment; the browser download failed during the preceding pass. Responsive guide CSS uses three columns on desktop and one column below 800px.
- No cloud deployment or paid model calls performed.

Apply the Pass 45 full replacement overlay after Pass 44. Deployment smoke checks: create a new account, use balanced Hero creation, return to Home, open First Light in Solo and finish its three turns, read the resulting Chronicle, then repeat in co-op with a second account and verify the party gate/invite flow. Confirm Skip Guide persists on reload and How to Start reopens it. Check the guide, Hero creator, lobby, and finale on a phone.

Release command:

```bash
./scripts/release-staging.sh "Pass 45: first-run player guide, balanced Hero setup, and First Light starter adventure"
```


---

## Pass 45 correction — Hero creation copy contract (2026-10-08)

The staging release check exposed a stale UI-contract assertion after the final Pass 45 copy edit. Hero creation now says **Optional Background — Helps Personalize Your Stories**; `tests/test_character_ui_contract.py` now expects that player-facing wording. Bio input and progression-rule assertions remain in place. This correction changes the test only, with no gameplay or production UI changes.

Validation: complete project verification passed: 306 Python tests, legacy browser JavaScript syntax, React TypeScript/production build, and AWS CDK TypeScript build. Apply the replacement test file and this appended canonical document over Pass 45, then rerun the staging release command.


---

## Pass 46 — Admin / Playtest Operations Dashboard (2026-10-08)

**Latest implementation baseline: Pass 46, following Pass 45 and its copy-contract correction.** This section is appended to `docs/PROJECT_MASTER.md`; all preceding content remains intact.

### Operator surface

The existing Control Room now opens with **Playtest Operations**. Operators can search rooms by code, title, Hero, or state; inspect the party and turn/QTE status; distinguish active generation from recovery-required turns; and see retained lifecycle counts. The former duplicate room listing is replaced by a Player Activity summary. Existing account analytics, per-user spend and allowance controls, Arcade/Author publication controls, content import, and project-document viewer remain available.

The dashboard adds monthly estimated spend and pending reservations by adventure/room, input/output token counts, failure rates, average latency, JSON/schema repair share, and the latest 40 generation failures with operation, model, error type, latency, room and event ID. Existing usage data is also exposed as a calls-by-operation/model table. Failure telemetry contains error types, not raw provider messages, prompts, or generated stories.

Explicit player-retry provider calls carry a `retry_attempt` marker in usage metadata. Tracked retry share is calculated only over marked calls in the selected current UTC month; older unmarked calls are excluded and an empty sample displays No Data. This measures provider calls inside a player retry, not a ratio of failed turns. Repair calls remain a separate metric and may overlap with retry calls.

QTE telemetry records one outcome per room/event ID when an event resolves, counting whether any submitted response used the timeout sentinel. It stores no response text or player identity. The dashboard labels this as observed resolved-event telemetry beginning with Pass 46, not a historical reconstruction or a disconnect-timeout guarantee. Telemetry write failure cannot prevent the resolved QTE's gameplay persistence. Retained started-run counts combine available started snapshots, completion history, and known started abandonment records; deleted/unrecorded historical runs are unavailable, so this is not an all-time acquisition funnel.

### Operator controls and enforcement

- **Pause / Resume AI:** a persistent database control checked before a metered provider reservation, including admin requests. Pausing prevents new metered admissions; already admitted/in-flight calls may finish. Existing account allowances and global daily ceilings still apply after resuming. Static First Light and Arcade do not require AI generation. The pause mutation and its audit record share a transaction.
- **Disable / Enable Account:** available for non-admin accounts with a site-native confirmation. Disabling revokes every login session, disconnects local sockets, clears socket presence, and blocks new metered AI calls. Gameplay socket actions revalidate account status against durable account state instead of trusting only the connection-time cache. Existing Hero/adventure data is preserved. Administrator accounts cannot be changed through this control. State mutation, session revocation, and audit share a transaction.
- **End Room:** requires typing its room code. The server cancels the tracked Director task and waits for the turn-resolution lock before archiving. Archive creation, durable room/chat deletion, and audit are one transaction; runtime state is then removed and participants are notified. Completed Chronicles cannot be terminated here. The unfinished run appears in My Adventures as ended by the operator, and cannot be resumed. If a turn does not settle within ten seconds, the endpoint returns a controlled conflict instead of deleting through an active commit.
- **Allowances / Author Access:** the existing controls remain server-protected and now record operator actions. Allowance buttons explicitly set the total monthly budget; they do not add credits or reset usage. Recent audit entries show actor/target labels and details. Account deletion replaces retained audit identity fields with the existing deleted-account tombstone.

Cancelled provider calls close their reservation as failed with `CancelledError`, charging the conservative pre-call estimate because exact provider billing is unknown after cancellation. Stale pending calls recovered at startup likewise retain their reserved estimate as estimated spend instead of silently refunding it. These are estimates, not reconciled provider invoices.

### APIs and storage

Read-only `/api/auth/admin/operations` and writes to `/api/auth/admin/ai-pause`, `/api/auth/admin/users/{user_id}/active`, and `/api/auth/admin/rooms/{room_code}/terminate` use the existing admin authentication and administrative request-header/origin guards. Ordinary or anonymous accounts receive the concealed admin response; writes require the existing `X-TOT-Admin-Request` convention.

Initialization adds SQLite/PostgreSQL-compatible `ai_controls`, `operator_actions`, and `qte_outcomes` tables. Defaults leave AI open. Existing pause state survives initialization/restart. Live room state remains process-local under the existing runtime architecture; spend, controls, audit, and observed QTE outcomes are durable. No additional runtime dependency or cloud deployment is introduced.

### Validation

- Complete `scripts/check-project.sh` passed after the final source changes: **319 Python tests**, legacy browser JavaScript syntax, React TypeScript/production build, and AWS CDK TypeScript build.
- Thirteen new operator regressions cover durable pause for players/admins, session revocation, administrator protection, cost/failure aggregation, idempotent QTE telemetry, cancellation/stale-reservation estimates, room-termination cleanup races, cached socket rejection, CSRF/admin guards, retry-sample classification, audit rollback, deletion anonymization, and socket presence cleanup.
- Headless Chromium checks at 1440px and 390px passed for rendering, absence of page-wide horizontal overflow, room inspection, typed termination confirmation, pause confirmation, and account-disable confirmation. Browser checks used mocked service responses; Python tests exercised real temporary SQLite stores and runtime room managers. No cloud end-to-end test, paid AI call, or deployment was performed.
- Existing non-blocking build chunk-size and dependency deprecation warnings remain.

Apply the full replacement Pass 46 overlay after Pass 45 and its copy-test correction. On staging, verify fresh telemetry, pause/resume with a tester account, disable/re-enable a disposable tester, and terminate a disposable unfinished room. Confirm its archive appears for participants and that completed Chronicles remain accessible. Test normal gameplay and the next attempted generation after resuming AI.

```bash
./scripts/release-staging.sh "Pass 46: playtest operations dashboard, AI pause, account controls, and audited room termination"
```


## Pass 46 hotfix — PostgreSQL Hero story history (2026-10-08)

Staging logs confirmed `psycopg.errors.IndeterminateDatatype: could not determine data type of parameter $2` in `_list_completed_adventures_sync`. Hero detail and creation-rules requests returned HTTP 200; completed-story requests and My Adventures failed with HTTP 500. The optional character condition used an independent untyped `? IS NULL` bind. SQLite accepted this query, so the prior SQLite regression suite did not catch the PostgreSQL failure.

The history query now conditionally appends the fixed `player.character_id = ?` predicate only when a character ID is supplied. User and character values remain bound parameters, and the user ownership predicate always applies. Account-level history continues to return all owned Heroes' completed stories with existing deduplication. No schema migration or record modification is required.

Validation: 324 Python tests passed. Five new regression cases cover the SQL emitted through the PostgreSQL adapter (including absent, empty, and quoted character IDs), owner isolation, Hero filtering, and account-level library results. The adapter tests use a recording connection; a live PostgreSQL instance was unavailable locally. Staging verification after release: open a Hero sheet and My Adventures, and confirm their history requests return HTTP 200.


## Pass 47 — Adventure reconnect and action recovery (2026-10-08)

Baseline: Pass 46 plus the PostgreSQL Hero-history hotfix. Previous documentation is preserved verbatim.

### Player behavior

An interrupted adventure retains its last received scene and shows a live recovery notice with Reconnect / Restore and My Adventures controls. Restoration requires both the matching Hero's resume acknowledgement and a current room game snapshot before actions unlock. A partial acknowledgement no longer disables the twelve-second restore watchdog. Timeout allows a manual restore attempt; repeated clicks while a restore is pending do not emit duplicate resume requests. Connection failures explain how to retry or sign in again.

Disconnect immediately revokes the client action gate. Choice submission, generation retry, adventure start, wrap-up, QTE response, intermission score and chat are rejected locally while disconnected or awaiting restoration, so these actions do not enter Socket.IO's offline send queue. Create, join, solo conversion, leave and abandon similarly require a connected socket. Requests already sent before a disconnect remain subject to existing server behavior; this is not a new end-to-end acknowledgement or exactly-once protocol.

Reconnect clears transient choice/countdown/writing presentation and restores authoritative readiness from the server. Local choice lock-pending state clears when recovery starts. The selected local choice and unsent chat draft remain available. Automatic reconnect continues using the existing socket policy; manual recovery reopens a disconnected socket or resumes the currently selected room. No automatic Director retry or paid model call is added.

### Verification

Complete project checks passed: 324 Python tests, eight deterministic reconnect tests exercising the real TypeScript hook with React/socket/timer adapters, legacy JavaScript syntax, React TypeScript/production build, and AWS CDK TypeScript build. The reconnect tests are now included in scripts/check-project.sh. They cover offline emission prevention, partial/reordered restore, wrong Hero/room responses, disconnect preservation, timeout/retry, handler cleanup and retryable-error gating. The test harness uses Node's built-in TypeScript stripping API (supported by the project's Node >=22.22 requirement), which can print an experimental-feature warning.

No live cloud disconnect test or new browser visual QA was performed. Existing dependency deprecation and bundle-size warnings remain. No backend/schema changes or deployment occurred in this pass.

Staging smoke: enter First Light, interrupt networking, verify the recovery notice and blocked actions, restore networking and confirm the saved turn resumes. Repeat during a locked choice and pending Director turn; verify no choice or paid retry is automatically resent. Check manual recovery after a restore timeout and after session expiry.

```bash
./scripts/release-staging.sh "Pass 47: adventure reconnect recovery and offline action guards"
```
