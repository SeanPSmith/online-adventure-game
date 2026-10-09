# Tales of Two — Player-facing Voice and UX Copy Audit

**Audit baseline:** Pass 52, October 2026. Applies to player-facing React pages and adventure state surfaces. This is a working language guide, not a complete replacement of every string in the application.

## House voice

- **Frame:** A living Chronicle, Heroes, adventures, chapters, pathways, the Story Director, companions. The UI may look like a terminal, but its *voice* should feel like an invitation to a fantasy adventure.
- **State the action in plain language:** The metaphor adds personality; it never hides whether the player should retry, wait, sign in, or return home.
- **Never claim an action happened when it hasn't:** If no email was sent, say so plainly. If a chapter is already pre-generated, do not describe a fictitious AI job.
- **Avoid app-developer copy:** `System incident`, `restoring cache`, `recovering intermission table`, `server returned 500`, `receipt snapshot`, `schema v3`, `API disconnected`, `the machine` belong in admin/logs, not ordinary gameplay screens.
- **Always give an escape hatch:** Recover, retry, go to Adventure Hall, or contact support. On retry failures, explain if locked choices and dice were preserved.
- **Accessible language:** Keep buttons short; do not depend on all-caps or unusual glyphs for meaning; keep `role="alert"` for actionable failures and `role="status"` for nonblocking state. No misleading countdowns or animated waiting screens if no work is occurring.

## Player journey: audit and priorities

| Surface | Observed copy/pattern | Recommended voice and behavior | Pass 52 |
|---|---|---|---|
| 404 route | `THIS PATH IS NOT IN THE CHRONICLE` with no explanation | `THIS ROAD LEADS BEYOND THE MAP` + recovery link | Updated |
| Lazy-page failure | `SYSTEM INCIDENT`, `STORY MACHINE`, raw error text | `THE INK HAS GONE ASTRAY`, clear reload, protected error detail | Updated |
| New-adventure lobby | `THE STORY IS READY`, generic multiplayer instructions | Published story synopsis, visible opening-ready status, mode-aware party guidance | Updated |
| New-adventure overlay | Treated lobby presence as turn locks; `RECOVERING THE INTERMISSION TABLE` | Never show a turn intermission before the first choice | Fixed |
| Active turn transition | `THE DIRECTOR IS WORKING BEHIND THE CURTAIN` | `THE NEXT CHAPTER IS TAKING SHAPE` (only after actual locked choices) | Updated |
| Waiting to reconnect | `RESTORING THE THREAD`, backend recovery diagnostics | `FINDING YOUR PLACE IN THE CHRONICLE`, with timeout, retry, and safe return | Later |
| Director retry | `THE MACHINE KEPT YOUR RECEIPT`, technical turn-facts explanation | `THE TALE PAUSED, BUT YOUR CHOICES ARE SAFE`, explicit retry | Later |
| Account/password recovery | `RECOVERY CHANNEL OFFLINE`, developer explanation | `THE RECOVERY PATH IS NOT YET OPEN` + honest notice/reset availability | Later — coordinate with implementation of real password reset |
| Hero Hall / progression | Several labels use internal stats language | Preserve STR/AGI and numeric literacy; put fantasy flavor in headings and helping text | Review |
| My Adventures / completed | `SEALED`, `RECOVERY REQUIRED`, `TURN FROZEN` | Use comprehensible state + narrative subcopy; do not imply lost progress | Review |
| Author/Admin | Technical diagnostics and publication versions | Retain accurate technical vocabulary; these are creator/operator tools | No blanket rewrite |
| Legal, security, billing | Account, privacy, permissions, receipts, billing | Use precise non-fiction language; immersion must never conceal legal/security facts | No blanket rewrite |

## Reusable copy motifs

| State | Headline | Supporting explanation/action |
|---|---|---|
| Missing page | THIS ROAD LEADS BEYOND THE MAP | Return to the crossroads |
| Waiting for invited player | A COMPANION HAS YET TO ARRIVE | Invite your friend; begin once both Heroes join |
| Opening available | THE FIRST CHAPTER IS READY | Get Started |
| Recovering saved adventure | FINDING YOUR PLACE IN THE CHRONICLE | Your journey has been saved; reconnecting |
| After a valid turn | THE NEXT CHAPTER IS TAKING SHAPE | The Director is writing what happens next |
| Turn generation failed | THE STORY PAUSED | Your choices and dice are preserved; retry |
| Completed adventure | YOUR CHRONICLE IS COMPLETE | Continue to your Chronicle |

## Rules for future passes

1. Treat state correctness as the first priority: writing changes must be coupled with the actual backend condition.
2. Create one shared player-copy vocabulary for statuses before sweeping dozens of separate views.
3. Walk the full player journey on desktop and mobile and read copy aloud: browse, lobby, first choice, transition, failure, finale, return.
4. Include screen-reader announcements and true recovery actions in the acceptance checklist.
