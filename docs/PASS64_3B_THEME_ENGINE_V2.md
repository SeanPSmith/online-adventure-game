# Tales of Two — Pass 64.3B, Theme Engine V2

## Scope delivered

Curated, non-purchasable theme editions are registered as strict, app-authored
V2 presentation manifests. Six families × Day/Night = twelve editions. The
Wardrobe offers Day / Night / Auto (follows OS preference). The Reader follows
the established world-skin resolver, unless an installed V1 reader skin or plain
mode is explicitly in use.

This is the architecture and first working presentation pass, **not** a finished
bundle of original photographs for six worlds. Some themes intentionally reuse
existing bundled art until their own tabletop photography/illustrations arrive.

## What a V2 edition defines

- Stable family ID and day/night edition ID
- Tabletop environment preset and bundled art slot
- Paper/binding/frame materials and UI colors
- Display/body/annotation typography stacks
- Ornament vocabulary and art direction
- World-to-Reader edition mapping (fantasy, starward, gothic)

All strings supplied to CSS are from literal, bundled source allowlists. There
is no imported V2 executable CSS, scripts, remote URLs, or user-specified image
paths. This deliberately keeps author/editor uploads out of privileged visual
contexts until we build a secure publishing system.

## Compatibility and precedence

1. Account data starts with the V1 `tot:appearance:v1:<user>` preferences. New
   `editionFamily` and `editionLighting` fields are optional and normalized.
2. Already installed V1 JSON themes still load under `tot:themes:v1:<user>`.
   A manually equipped V1 Library skin takes precedence over curated V2
   Library presentation. Switching to a V2 family unequips that local override.
3. V1 Reader skins remain usable. Plain Reader remains supreme.
4. World skin selection is still derived from an immutable adventure ID and
   server metadata/tag resolver; only presentation is changed.
5. `AUTO` uses OS color scheme and does not overwrite the chosen preference.
6. Local cosmetics are **not** purchase entitlements. Purchases and creator
   publishing require a separate server-owned catalog and verification.

## Production follow-ups

- Create *actual dedicated art assets* for Garden Table (sunlit hobbit-style
  home and greenery), Starward (ship console), Ink & Ash (weathered field notes),
  Bloodmoon (gothic writing desk), and Leatherbound (lamplight and maps). Do
  not burn design copy/UI labels into decorative images.
- Add day/night variant background photography and responsive desktop/mobile
  crops; this pass adjusts lighting/colors but may reuse one scene asset.
- Upgrade Theme Workshop import/export to V2 only after defining a versioned
  migration, asset CDN allowlist, image licensing/size limits, and UI previews.
- Extend authored metadata to select more than fantasy/starward/gothic after
  an author-side picker and stable allowlisted IDs exist.
- Add first-class Hero portrait and adventure cover records and an art
  generation/caching pipeline; initials/fallback covers remain until then.
- Benchmark on older MacBook and mobile; avoid continuous GPU filters.

## Release workflow

All packages go into `OnlineAdventureGame/assets/AWS/` and are installed from
`root/` with `bash scripts/install-overlay.sh ../assets/AWS/<zip>` followed by
`./scripts/check-project.sh`. Keep Git backups: the standard overlay installer
verifies installed bytes but does not itself save overwritten originals or
reject changed baselines. Do **not** deploy until the full local suite passes.
