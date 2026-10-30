from pathlib import Path
from app.generation.pacing import director_turn_window, narrative_beat_plan, solo_finale_due
from app.generation.director import SYSTEM_INSTRUCTIONS

ROOT = Path(__file__).resolve().parents[2]


def test_solo_story_honors_its_length_ceiling_without_forcing_multiplayer():
    for length in ('short', 'medium', 'long', 'epic'):
        minimum, target, maximum = director_turn_window(length)
        assert not solo_finale_due(current_turn=target, minimum_turns=minimum, maximum_turns=maximum, play_mode='solo', player_count=1)
        assert solo_finale_due(current_turn=maximum, minimum_turns=minimum, maximum_turns=maximum, play_mode='solo', player_count=1)
        assert solo_finale_due(current_turn=maximum + 21, minimum_turns=minimum, maximum_turns=maximum, play_mode='solo', player_count=1)
        assert not solo_finale_due(current_turn=maximum, minimum_turns=minimum, maximum_turns=maximum, play_mode='co-op', player_count=2)
        assert not solo_finale_due(current_turn=maximum, minimum_turns=minimum, maximum_turns=maximum, play_mode='solo', player_count=2)


def test_director_applies_finite_solo_cap_with_real_authoritative_turn():
    src = (ROOT/'app/generation/director.py').read_text()
    assert 'auto_finale = solo_finale_due(' in src
    assert 'and not opening_mode' in src
    assert 'must_complete = wrap_up_turns_remaining <= 1' in src
    assert 'turn_facts=' in src
    assert 'do not invent fresh dangers' in SYSTEM_INSTRUCTIONS


def test_party_voted_end_concludes_on_next_resolution():
    main=(ROOT/'app/main.py').read_text()
    assert 'session.wrap_up_turns_remaining = 1' in main
    assert '"turns_remaining": 1' in main
    assert '"runway=1"' in main
    assert 'session.last_turn_result["finale"]' in main


def test_cinematic_receipt_has_two_deliberate_stages_and_same_saved_roll():
    src=(ROOT/'frontend/src/features/adventure/TurnResolutionTheater.tsx').read_text()
    css=(ROOT/'frontend/src/pages/game/quillairoCinematicTurnPass6643.css').read_text()
    assert '"dice" | "consequences"' in src
    assert 'setFolioStage("page")' not in src
    assert 'if (inkbound ? index !== activeIndex : index > activeIndex)' in src
    assert 'result.check.roll' in src
    assert 'advanceFromConsequences' in src
    assert 'onContinue' in src
    assert '.q43-cinematic' in css
    assert '100dvh' in css
    assert 'prefers-reduced-motion' in css
    assert 'quillairoCinematicTurnPass6643.css' in (ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
