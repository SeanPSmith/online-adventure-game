# Tales of Two — React Presentation Foundation

This frontend is intentionally isolated from the current Python/vanilla client.

## Safety contract

React is presentation only.

Do **not** move these systems into React:
- room authority / readiness
- dice/check math
- Director generation
- story-state mutation
- XP / leveling
- Hero HP/damage/healing
- effects/perks rules
- advancement awards
- finale/completion persistence
- intermission authority
- micro-event authority
- authentication/session authority

Those remain Python/server owned.

React should consume the existing REST and Socket.IO contracts and display them.

## Runtime requirements

Use Node 22.22+.

## Install

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Keep the Python backend running on:

```text
http://127.0.0.1:8000
```

Vite runs on:

```text
http://127.0.0.1:5173
```

The Vite dev proxy forwards `/api` and `/socket.io` to the existing Python server.

## IMPORTANT

Do not change FastAPI `/` or its `/static` mount yet.
Do not point production traffic at `frontend/dist` yet.
Do not delete `app/web`.

The old frontend and new React frontend should run side-by-side until route parity is verified.

## Initial routes

Public:
- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/privacy`
- `/terms`

Authenticated:
- `/game`
- `/game/adventure/:roomId`
- `/game/heroes`
- `/game/heroes/new`
- `/game/heroes/:heroId`
- `/game/history`
- `/game/rulebook`
- `/account`
- `/settings`
- `/author`

## Already wired to the existing backend

- `/api/auth/me`
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/logout`
- `/api/characters`
- `/api/characters/creation-rules`

The React app deliberately uses the existing HttpOnly session cookie.
Do not add JWT/localStorage auth.

## Not wired yet

- live room/adventure Socket.IO events
- adventure catalog/list
- live story/choices
- Party Chat
- character creation submit UI
- Hero advancement
- Author editor
- password reset (no current Python endpoint)
- production privacy/terms copy

Those should be migrated incrementally from the existing working client, not reinvented.
