# Scene ASCII Art Pipeline

## Purpose

Replace placeholder scene ASCII with deterministic, story-aware scene art that is:

- generated automatically for AI-directed scenes
- persisted with the scene so reloads stay consistent
- fast enough to avoid blocking story flow
- swappable later for a richer image-to-ASCII backend

## Current implementation

The current runtime uses `app.generation.ascii_art.generate_scene_ascii_art()`.

Inputs:

- scene title
- scene body
- current goal
- current threat
- optional mood/tone guidance

The generator infers a rough theme from scene text and renders a fixed-size ASCII scene using a lightweight deterministic composer.

Supported theme families:

- store / market
- road / vehicle
- forest / outdoors
- chapel / cemetery
- water / shoreline
- house / farmhouse / room
- facility / office / warehouse
- generic fallback

## Important properties

- Deterministic for the same scene text.
- No external model call required.
- No new runtime dependency required.
- Story generation remains authoritative; art is decorative.
- The pipeline can later be upgraded to:
  - structured scene art prompts
  - image generation
  - image-to-ASCII conversion
  - admin regeneration controls

## Integration points

- `app.game.session.GameSessionManager.commit_director_turn()`
- `app.generation.runtime_adapter.to_adventure_definition()`

## Future upgrades

1. add explicit `scene_art_prompt` to Director outputs
2. add async background art generation
3. persist `art_version` metadata
4. add Admin / Author preview and regenerate controls
5. optionally support alternate render styles:
   - monochrome
   - green terminal
   - amber terminal
   - block / braille / VGA ramps
