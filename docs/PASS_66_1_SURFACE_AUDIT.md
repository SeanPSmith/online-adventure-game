# Tales of Two — Inkbound application surface inventory

**Based on the Pass 66.0 conversation snapshot.** This is a live conversion backlog, not a claim that all these pages now match the art direction. A shared CSS palette is the beginning, not visual acceptance.

## Release P0 — real co-op path (player-visible and launch blocking)

| Touchpoint | Source / entry | Current pass coverage | Remaining acceptance |
|---|---|---|---|
| Authenticated dashboard / discovery / join | `/game`, `InkboundAuthenticatedDashboard.tsx` | Real data and six themes, shared controls | Real account/browser screenshot and join/invite test |
| Lobby, ready/waiting, Begin Adventure | `InkboundLobby.tsx`, `AdventurePage.tsx` | Real server callbacks, six themes, readable controls | Two-account readiness and narration test |
| Chapter narration and choice list | `InkboundLiveRoom.tsx`, `StoryReveal.tsx` | Theme contrast, word reveal, keyboard-visible buttons | Full narration over long and short stories |
| Choice lock / dice / result / XP / HP | `TurnTheater.tsx`, `TurnResolutionTheater.tsx` | Server receipt, paper/ink theater chrome | Check success/fail/crit/death and simultaneous co-op rolls |
| Intermission and Arcade shell | `IntermissionRuntime.tsx` | Theme shell, preserving independent game boards | Each published minigame on desktop and mobile |
| Story-ready countdown and reconnect/retry | `TurnTheater.tsx`, `useTurnTheater.ts` | Existing state-machine callbacks unchanged | Actual server delay, reconnect and one-authoritative-roll test |
| Narrator, pause/resume, voice picker | `InkboundLiveRoom.tsx`, `StoryReveal.tsx` | Legible controls, cue highlight follows selected theme | Real TTS audio and no narration restart after rerender |
| Chat, notes, Chronicle, Hero, party drawers | `InkboundLiveRoom.tsx` | Readable text/fields, wider scrollable folios, focus restore | Keyboard, soft-keyboard, mobile scroll and reconnect |
| Global modal, confirmation and invite | `ModalContext.tsx` | Six-theme wide dialog and control contrast | Every dialog's contents in both light and dark modes |
| QTE, level up, Hero death | Adventure modal components | Wider modal constraints and inherited theme | Timeout, keyboard and automatic progression behavior |

## Release P1 — authenticated secondary pages

| Touchpoint | Source / entry | Current coverage | Remaining acceptance |
|---|---|---|---|
| Hero Hall, creation, character sheet | `/game/heroes`, `/game/heroes/new`, `/game/heroes/:heroId` | Theme shell and form/selector contrast | Layout and full creation/equip/progression actions |
| Graveyard / adventures / history | `/game/graveyard`, `/game/adventures`, `/game/history` | Theme shell and status/empty state contrast | Long rows, archive/recovery, mobile |
| Arcade catalog / individual minigames | `/game/arcade`, `features/arcade/games/` | Catalog gets theme shell; games retain individual palettes | Per-board redesign and score/touch/keyboard audit |
| Rulebook and deep links | `/game/rulebook`, `/rulebook` | Authenticated shell theme | Public route separate design, navigation and contrast |
| Account, profile, preferences | `/account`, `/settings` | Six themes, shared input and dropdown contrast | Form errors, save/reconnect, keyboard and mobile |
| Author Studio bridge | `/author`, `/account/author` | React entry and theme shell | Approve editorial composition |
| Full Python Author Console | `/author-console` | Six-theme CSS from Pass 66.0 | Test draft autosave, AI proposal review, publish, versioning, modals |
| Admin/operations/diagnostics | `/admin` and nested admin sections | Authenticated theme shell | Functional modal states, tables, danger/warning, narrow screen |

## Release P2 — public and edge surfaces

`/`, `/login`, `/register`, `/forgot-password`, `/join/:roomCode`, `/privacy`, `/terms`, not found, route error, web push and notification prompts. These still require targeted review; **Pass 66.1 does not claim to reskin them**. They must share typography and approved world identity without making authentication or recovery unreliable.

## Six-theme gate for every screen

Ivory, cream, parchment, midnight blue, green phosphor, midnight black. At minimum: primary and muted text contrast, disabled/read-only text, focused controls, editable fields, menus, destructive confirmation, long prose, overlays, mobile overflow, touch targets and scrollability. Contrast fixtures only verify a subset of those states; live-session review is still required.

## Quality bar

Approved transparent assets only. No fake backgrounds, image masks, arbitrary splatters, floating handwritten labels over copy or visual changes that affect dice/XP/HP/story authority. When a visual effect causes a gameplay defect, prioritize legibility and deterministic behavior over ornamentation.
