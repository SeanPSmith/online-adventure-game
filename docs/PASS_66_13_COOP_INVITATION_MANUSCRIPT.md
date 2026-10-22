# Pass 66.13 — The Shared Story Invitation

This incremental overlay converts the actual public `/join/:roomCode` route from a terminal panel into the Quillairo manuscript aesthetic, following the Pass 66.12 homepage and authentication redesign. It preserves the existing game socket and character services and uses an existing approved, separate transparent illustration.

## Existing game contracts preserved

- The invitation remains public, so an unauthenticated recipient can follow the link.
- Sign-in and registration keep React Router's `state.returnTo` and return to the invitation.
- Six-character room codes remain validated. Invalid links have an explanatory return route.
- Existing live adventures exclude their Heroes from the eligible list.
- Only living/active Heroes can be selected; the server still validates ownership and join eligibility.
- The real socket `joinRoom(selectedHeroId, roomCode)` call, server error dismissal, in-progress joining, and server-confirmed navigation remain unchanged.
- A player without an eligible Hero can create one and return to the invitation.
- The Hero list now distinguishes loading from the genuine empty state, avoiding premature "Create Hero" messaging.

## Visual details

- Two-column desktop illustration + editorial chapter invitation; stacked mobile version.
- The supplied independent transparent `auth-journey.png` remains in `/public/art/quillairo-public/`.
- Radio-card Hero picker, full-width action, theme-aware surfaces and large visible focus rings.
- All six palettes inherit the existing shared public-shell tokens. The extra ink treatment for navy, phosphor and midnight affects the scene illustration, **not** the approved Quillairo logo.
- Do not add simulated Social Login, payment, or game joins.

## Acceptance checks

1. Open a valid `/join/ABC123` while signed out. Sign in and confirm you return to the same room code.
2. Test create-account and new-Hero return paths.
3. On a connected room, select an eligible Hero and verify the server-directed navigation reaches `/game/adventure/ABC123?hero=...`.
4. Confirm an occupied, dead, or retired Hero is not selectable.
5. Try invalid invitations, a disconnected socket, a join denial, and a temporarily failed Hero list request.
6. Review ivory, cream, parchment, navy, phosphor, and midnight on desktop and phone sizes.

This is a public co-op funnel conversion, **not a change to the authoritative dice, Arcade or story generation flow**. Complete Vite build and live co-op acceptance run through the Mac release pipeline and staging.
