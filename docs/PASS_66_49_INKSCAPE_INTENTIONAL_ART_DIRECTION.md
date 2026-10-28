# Pass 66.49 — Inkscape intentional art direction

## Purpose
Refine the actual public home and authenticated Adventure Hall to the user's approved
Inkscape mockups: dominant illustrated focal point, meaningful quiet space, clear
serif reading order, and authored artwork without universal grain, recolor or
arbitrary movement. Inkscape is the product's visual system—not the physical
Living Book UI, and not the vector editor.

## Changes
- Public homepage: correct approved "Living adventures, written as you play"
  headline; retire redundant promotional line; preserve all real entry links and
  sample choices. Slightly rebalance hero illustration and copy.
- Remove automatic grayscale wash from world cover artwork. Original fantasy,
  science-fiction and mystery artwork retains its own ink values and accents.
- Quiet world cards and remove their unnecessary hover zoom (which can blur
  intentional linework). Remove one unnecessary decorative dialog inset border.
- Authenticated Adventure Hall: replace standard American Typewriter/Courier
  microtypography with readable editorial serif. Optional phosphor theme remains
  distinct. Maintain existing user theme data, accessibility outlines, and
  custom selections.
- Remove unused paper-grain variable, rather than faking analog craft by
  applying indiscriminate noise.

## Explicit exclusions
NO edits to Director, Socket.IO, turn receipts, theater, dice, Arcade,
Hero progression, story-ending policy, persistence, multiplayer, or authoring.
No new artwork, image APIs, or paid generation requests. No UI rebuilt.

## Install (from project root)
```sh
bash scripts/install-overlay.sh ../assets/AWS/pass66_49_inkscape_intentional_art_direction.zip \
&& python3 scripts/pass66_49_apply.py --apply \
&& ./scripts/release-staging.sh
```

The patch is guarded, checks all five file targets before touching any, backs
up existing files under ignored `backups/pass66_49/`, and is repeat-safe.
Unknown source versions fail closed rather than overwriting the working game.

## Acceptance
- Public hero focal art, headline, and actions remain legible at 1440/768/390px.
- World cards preserve real cover art without uniform grayscale.
- Live Hero/world selection, room creation, and navigation still work.
- Six themes remain readable; reduced-motion/keyboard behavior unchanged.
- Full production build and authenticated browser walkthrough run on the Mac.
- Review actual full-size artwork for incoherent materials, uniform noise, and
  unnecessary microcontrast; artwork itself is unchanged by this pass.
