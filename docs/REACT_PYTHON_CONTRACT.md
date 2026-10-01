# Tales of Two — React / Python Contract

## Python owns game truth

React must not independently calculate or commit:

- room membership
- readiness
- die rolls
- check outcomes
- XP awards
- levels
- HP damage/healing
- Hero death
- effect application/expiration
- Director story output
- story state
- turn completion
- intermission winner
- finale/completion
- advancement point awards

If React needs a value that Python already knows, extend the Python read contract instead of reproducing the rule in TypeScript.

## React owns presentation and intent

React may own:

- routes
- selected-but-not-locked choice
- open/closed panels
- modals
- transition phase
- cosmetic roll animation
- scroll choreography
- countdown display
- local form fields
- responsive layout
- reduced-motion behavior
- temporary presentation persistence

A user selecting a card is React intent.
A server `choice_accepted` / readiness update is game truth.

## Durable recovery

One-shot socket events are not sufficient for important product state.

The Python server therefore exposes durable recovery state for:

- room membership
- readiness
- pending Director work
- pending intermission metadata
- Director retry requirement
- latest committed turn receipt (`last_turn_result`)

React may replay presentation from these fields, but must never reinterpret or recalculate their mechanical values.

## Turn receipt rule

`GameSession.last_turn_result` is a receipt, not a second state machine.

It contains the exact latest authoritative `turn_resolved` payload so a refreshed client can replay presentation. It must never be fed back into Python as a request to apply the turn again.

## Client storage rule

`sessionStorage` is permitted only for non-authoritative UX state such as:

- currently selected choice before lock
- whether this browser session already presented a particular turn receipt

Losing browser storage must never lose game progress.
