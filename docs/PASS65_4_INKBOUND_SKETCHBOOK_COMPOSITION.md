# Pass 65.4 — Inkbound Sketchbook Composition

A deliberate response to the repeated visual failure mode: UI has been arranged in
balanced web grids with generic cards and decorative 'handmade' fonts layered on top.
This pass changes the *composition* of the protected `/dev/inkbound` workshop.

## What changed

- Personal dashboard: source-alpha panoramic watercolor now occupies an overlapping,
  larger asymmetrical illustrated field; text reads like an opening letter and
  journeys read like a journal list rather than stacked app cards.
- Chapter choices: the rectangular three-card grid becomes three independently
  spaced, unboxed manuscript decisions, with responsive ink illustrations and
  individually drawn rule treatments; selected/disabled behavior remains intact.
- Dice: replaces a typography glyph with a custom inline hand-drawn facet SVG;
  design-only and marked as *not* a server outcome.
- Result: shows the same illustrated die and uses a loose ink ledger.
- Hero Hall: loosens the repeating row geometry without fabricating Hero data.
- Arcade: replaces the 2×2 tile layout with a staggered notebook index.
- Marginalia/annotations: no rotated text, no angular labels.
- Mobile: panoramic illustration is first, navigation wraps rather than clips;
  decisions stack as readable illustrated entries.

## Real data vs design states

`Dashboard` and `Heroes` still use read-only existing account services. The turn
sequence, roll value, and story prose in `/dev/inkbound` are sample design states,
never authoritative game state. The actual gameplay routes, dice ownership,
chat services, notifications, and Arcade logic are unchanged.

## Asset contract

No new flattened UI art assets. No image masks, CSS fading of crop edges,
background mattes, or clipping to disguise rectangular alpha. Existing approved
`north-road-editorial.png` and small alpha cutouts are reused unchanged.
The faceted die is inline vector line art (React SVG) with no raster background.

## Verification

- 20 focused Python tests passed, including new 65.4 composition/alpha/state tests.
- Chromium preview inspected at 1440×960 and 390×844 for dashboard, story,
  heroes, dice, intermission, outcome, and Arcade. No JS errors or horizontal
  page overflow occurred.
- Browser render used offline React 16 and fallback fonts. It does NOT replace
  a full production Vite/TypeScript build or staging-browser visual signoff.
- The release-staging script will handle full checks, Git, and AWS deployment
  on the user's Mac.

## Next art milestone

Do not treat this as a completed reskin of the entire game. The detailed Hero
sheet, portrait, illustrated results, and arcade-specific ornaments from the
user's collaborating art/mockup instance should be delivered as *independent
transparent assets* and integrated into real React components next.
