"""Pass 66.28: the selected length guides narrative beats, never kills a room."""
from pathlib import Path

from app.generation.pacing import director_turn_window, narrative_beat_plan
from app.generation.director import SYSTEM_INSTRUCTIONS


ROOT = Path(__file__).resolve().parents[2]


def test_all_lengths_move_through_three_acts_before_the_planned_limit():
    for length in ('short', 'medium', 'long', 'epic'):
        minimum, target, maximum = director_turn_window(length)
        beats = [narrative_beat_plan(turn, target, maximum) for turn in range(1, maximum + 1)]
        assert {beat['act'] for beat in beats} == {1, 2, 3}
        assert beats[0]['phase'] == 'SETUP'
        assert beats[-1]['act'] == 3
        assert minimum < target < maximum


def test_long_turn_40_is_climax_approach_not_force_finished():
    beat = narrative_beat_plan(40, 28, 40)
    assert beat['act'] == 3
    assert beat['phase'] == 'FINALE WINDOW'
    assert 'choice' in str(beat['direction']).lower()
    assert 'rescue' in str(beat['direction']).lower()


def test_beyond_horizon_continues_with_player_agency():
    assert narrative_beat_plan(56, 28, 40)['beat'] == 'PLAYER-DIRECTED CONTINUATION'
    assert 'explicitly requests closure' in narrative_beat_plan(56, 28, 40)['direction']


def test_act_two_rest_advances_plot_instead_of_triggering_rescue():
    second_act = narrative_beat_plan(14, 28, 40)
    assert second_act['act'] == 2
    assert 'rests or finds shelter' in second_act['direction']


def test_completion_requires_approved_wrap_up_or_solo_cap_and_preserves_dice():
    source = (ROOT / 'app/generation/director.py').read_text()
    assert 'may_complete = False' in source
    assert 'must_complete = False' in source
    assert 'wrap_up_turns_remaining <= 1' in source
    assert 'narrative_beat = narrative_beat_plan(' in source
    assert '"narrative_beat": narrative_beat' in source
    assert 'SOLO adventure reaching' in SYSTEM_INSTRUCTIONS
    assert 'solo_finale_due(' in source
    assert 'TURN FACTS' in SYSTEM_INSTRUCTIONS


def test_server_persists_finale_with_the_frozen_receipt_and_protects_delivery():
    source = (ROOT / 'app/main.py').read_text()
    assert 'session.last_turn_result["finale"] = finale_payload' in source
    assert '"final_resolution": str(session.scene.body or session.last_resolution or "")' in source
    assert 'turn_payload["finale"] = finale_payload' in source
    assert 'except Exception as archive_error:' in source
    assert 'await sio.emit(\n            "turn_resolved",' in source
    assert 'await apply_turn_progression(' in source
