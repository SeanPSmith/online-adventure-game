# Pass 63.10 — AI Writer Helper intent fidelity

## Incident

A short author note about a **boat accident and beach** was silently rewritten
into an unrelated **plane crash and wilderness** adventure. This was not a model
crash: the model's structurally valid output was blindly merged into blank
source fields, then automatically persisted by the Author UI.

## Fix

1. **Author note controls the premise.** The generation prompt explicitly tells
   the model to preserve the concrete incident, location, vehicle, and event.
2. **Server checks drift before merge.** For a sparse document, the generated
   main `premise` (World) or `starting_situation` (Brief) must retain the core
   content words supplied by the author. Single-field edits to the main premise
   or pitch are checked similarly. If the AI drops essential anchors the route
   returns HTTP 422 with an explanation. An over-cautious rejection is safer
   than silently corrupting a draft. This is a deterministic guard, *not* a
   general-purpose semantic contradiction detector: review remains necessary.
3. **Review is mandatory.** The browser displays every changed path alongside
   the original and proposed values. Clicking **APPLY REVIEWED CHANGES** is
   required to update and autosave the draft. CANCEL discards the proposal.
   Re-generating requests a new billable provider response, but browsing a
   proposal makes no additional AI calls.
4. Existing authored non-default fields, linked World canon, private notes,
   draft revision checks, and document identity remain protected.

## Acceptance checks

- Input `boat accident and beach` + proposed `plane crash in wilderness`:
  rejected without any draft change.
- Input `boat accident and beach` + `boat accident ... beach`:
  returned as a proposal that remains unapplied until explicit confirmation.
- Closing the review: no draft change. Applying it: one controlled update.
- Full authoring regression, browser syntax, and release gate on the Mac.

## Repairing a previously rewritten draft

This fix prevents future silent application. It cannot reverse an AI result
already saved in an existing draft. Inspect the author's Versions UI for an
older version, or manually restore the intended original premise before using
Writer Helper again. Do not assume every autosave created a previous version.
