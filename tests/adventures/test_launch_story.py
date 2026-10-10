from __future__ import annotations
from tests.support import PROJECT_ROOT

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.generation.director_schema import DirectorStoryTurnDraft
from app.generation.runtime_adapter import build_director_runtime_adventure
from app.generation.seed_schema import AdventureSeedDraft


ROOT = PROJECT_ROOT
FRONTEND = ROOT / "frontend" / "src"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def opening_seed() -> dict:
    return {
        "schema_version": 1,
        "title": "THE FIRST PAGE",
        "subtitle": "An opening already in motion",
        "primary_type": "mystery",
        "secondary_type": "survival",
        "target_length": "short",
        "tone": "tense and grounded",
        "difficulty": "moderate",
        "weirdness": 2,
        "premise": "Two Heroes reach a quiet building just as something inside begins moving against the locked doors.",
        "player_synopsis": "A routine arrival curdles into a problem nobody outside seems able to see. Before the night is over, two Heroes will have to decide what deserves their trust and what merely learned how to imitate it.",
        "opening_scene": {
            "title": "THE LOCK MOVES",
            "body": "The deadbolt slides halfway across the glass door by itself. On the other side, the empty lobby remains perfectly still, except for a desk lamp that has begun turning toward the Heroes a few degrees at a time. A phone rings somewhere deeper in the building and stops the instant either of them looks toward the hallway.",
            "choices": [
                {"label":"WATCH THE LAMP","description":"Study the lamp and the timing of its movement.","archetype":"investigative","tone":"cautious","risk_level":"low","reward_level":"moderate","impact_level":"meaningful","possible_gains":["A pattern"],"possible_costs":["Time"],"check":{"difficulty":8,"skill":"awareness","stat":None}},
                {"label":"CATCH THE DOOR","description":"Move before the deadbolt finishes closing.","archetype":"bold","tone":"assertive","risk_level":"moderate","reward_level":"high","impact_level":"scene_shifting","possible_gains":["Entry"],"possible_costs":["Exposure"],"check":{"difficulty":10,"skill":None,"stat":"agility"}},
                {"label":"ANSWER THE PHONE","description":"Call into the building and force whoever is ringing to react.","archetype":"social","tone":"defiant","risk_level":"high","reward_level":"high","impact_level":"meaningful","possible_gains":["A response"],"possible_costs":["Attention"],"check":{"difficulty":12,"skill":None,"stat":"presence"}},
            ],
        },
        "core_goal": "Find out what is controlling the building before the doors seal.",
        "major_locations": ["The building"],
        "major_npcs": [],
        "canon_constraints": [],
        "required_elements": [],
        "forbidden_elements": [],
        "open_threads": [],
        "hidden_truths": [],
        "potential_finale": "The Heroes confront the force shaping the building and decide what happens to it.",
        "director_guidance": ["Keep the physical situation legible."],
    }


def test_seed_requires_real_playable_opening_and_runtime_uses_it() -> None:
    seed = opening_seed()
    AdventureSeedDraft.model_validate(seed)
    generated = {
        "generated_adventure_id": "pass40-opening",
        "world_document_id": "world-one",
        "world_version_number": 1,
        "brief_document_id": "brief-one",
        "brief_version_number": 1,
        "seed": seed,
    }
    adventure = build_director_runtime_adventure(generated)
    scene = adventure.scenes[adventure.starting_scene_id]

    assert scene.body == seed["opening_scene"]["body"]
    assert len(scene.choices) == 3
    assert all(choice.id != "begin_adventure" for choice in scene.choices)
    assert all(choice.label != "LET'S GO" for choice in scene.choices)


def test_runtime_legacy_seed_never_restores_fake_lets_go_gate() -> None:
    seed = opening_seed()
    seed.pop("opening_scene")
    generated = {
        "generated_adventure_id": "pass40-legacy",
        "world_document_id": "world-one",
        "world_version_number": 1,
        "brief_document_id": "brief-one",
        "brief_version_number": 1,
        "seed": seed,
    }
    adventure = build_director_runtime_adventure(generated)
    scene = adventure.scenes[adventure.starting_scene_id]
    assert len(scene.choices) >= 3
    assert "LET'S GO" not in {choice.label for choice in scene.choices}


def test_launch_state_is_persisted_and_choices_cannot_start_the_room() -> None:
    session = read("app/game/session.py")
    store = read("app/persistence/store.py")
    main = read("app/main.py")

    assert "started: bool = False" in session
    assert '"started":\n                    bool(game_session.started)' in store
    assert "async def start_adventure(" in main
    assert "room_can_begin_adventure" in main
    assert "Only the host can start the adventure." in main
    assert "The adventure has not started yet. Wait for the host to press GET STARTED." in main


def test_react_launch_ui_uses_get_started_and_no_browser_native_controls() -> None:
    page = read("frontend/src/pages/game/AdventurePage.tsx")
    react_source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in FRONTEND.rglob("*.tsx")
    )

    assert '"GET STARTED"' in page
    assert "live.startAdventure" in page
    assert "confirmSoloStart" in page
    assert "window.confirm" not in react_source
    # The voice selector must follow the same custom, themed control contract.
    # Native <select> widgets diverge from the adventure UI on mobile/desktop.
    assert "<select" not in react_source
    assert "TerminalSelect" in read("frontend/src/pages/game/GameHomePage.tsx")
    settings = read("frontend/src/pages/account/SettingsPage.tsx")
    assert 'ariaLabel="Narrator voice"' in settings
    assert 'options={[...KOKORO_VOICES]}' in settings
    assert 'onChange={value => setAudioPreference({ narrationVoice: value })}' in settings


def test_synopsis_always_gets_distinct_literary_ai_copy_pass() -> None:
    provider = read("app/generation/openai_provider.py")

    assert "Player synopsis is intentionally a separate AI writing pass" in provider
    assert "one or two short paragraphs" in provider
    assert "Do not inventory proper-place names" in provider
    assert "do not copy, quote" in provider.lower()
    generation_tail = provider[provider.index("synopsis_polish = None"):]
    assert "if self._synopsis_needs_polish(" not in generation_tail


def qte_payload(scene_body: str) -> dict:
    return {
        "title": "THE CATWALK",
        "scene_body": scene_body,
        "choices": [
            {"label":"MOVE LEFT","description":"Move toward the wall.","archetype":"bold","tone":"assertive","risk_level":"moderate","reward_level":"moderate","impact_level":"meaningful","possible_gains":["Position"],"possible_costs":["Exposure"],"check":{"difficulty":8,"skill":"awareness","stat":None}},
            {"label":"HOLD FAST","description":"Brace against the shaking rail.","archetype":"safe","tone":"cautious","risk_level":"low","reward_level":"low","impact_level":"local","possible_gains":["Stability"],"possible_costs":["Time"],"check":{"difficulty":9,"skill":None,"stat":"strength"}},
            {"label":"PRESS ON","description":"Cross before the structure worsens.","archetype":"reckless","tone":"aggressive","risk_level":"high","reward_level":"high","impact_level":"scene_shifting","possible_gains":["Momentum"],"possible_costs":["A fall"],"check":{"difficulty":12,"skill":None,"stat":"agility"}},
        ],
        "quick_event": {
            "kind":"danger_beat",
            "title":"THE RAIL SNAPS",
            "story_context":"The loose rail finally tears free beside the Hero.",
            "prompt":"The rail snaps toward you. Where do you throw your weight?",
            "options":[
                {"id":"duck","label":"DUCK UNDER IT","description":"Drop beneath the swinging rail."},
                {"id":"jump","label":"JUMP RIGHT","description":"Leap toward the intact platform."},
            ],
            "correct_option_id":"jump",
            "success_text":"You clear the rail and land on the intact platform.",
            "failure_text":"The rail clips you before you scramble aside.",
            "success_effect":{"name":"QUICK FOOTED","description":"The clean recovery sharpens your footwork.","modifier_stat":"agility","modifier_skill":None,"modifier_value":1,"duration_turns":1},
            "failure_effect":{"name":"OFF BALANCE","description":"The ugly recovery compromises your footing.","modifier_stat":"agility","modifier_skill":None,"modifier_value":-1,"duration_turns":1},
        },
        "memory_summary":"The Heroes are crossing the unstable catwalk.",
        "story_state": {
            "current_goal":"Cross the catwalk.","story_phase":"setup","player_positions":[],"active_npcs":[],"active_threats":[],"known_facts":[],"player_private_knowledge":[],"unresolved_threads":[],"resolved_threads":[],"important_items":[],"active_advantages":[],"recent_consequences":[],"closed_opportunities":[]
        },
        "pressure_level":"danger",
        "scene_function":"challenge",
        "completed":False,
        "ending_label":"",
    }


def test_qte_mechanics_are_forbidden_from_story_prose() -> None:
    safe = qte_payload(
        "A bolt skips across the grating. The rail beside the Heroes flexes outward, then tears loose with a metallic crack as the intact platform shudders to their right."
    )
    DirectorStoryTurnDraft.model_validate(safe)

    leaking = qte_payload(
        "A bolt skips across the grating. QUICK REACTION: JUMP RIGHT before the countdown ends."
    )
    with pytest.raises(ValidationError, match="QTE leakage"):
        DirectorStoryTurnDraft.model_validate(leaking)


def test_recap_and_optional_story_unfurl_have_explicit_contracts() -> None:
    director = read("app/generation/director.py")
    reveal = read("frontend/src/features/adventure/StoryReveal.tsx")
    settings = read("frontend/src/pages/account/SettingsPage.tsx")

    assert "Capture EVERY pertinent" in director
    assert "resulting immediate situation" in director
    assert "story-reveal-word" in reveal
    assert "REVEAL ALL" in reveal
    assert "prefers-reduced-motion" in reveal
    assert "WORD-BY-WORD STORY REVEAL" in settings
