"""Guard bounded Director repair headroom and explicit incomplete diagnostics.

No network or OpenAI SDK required. This protects the prior 4,200-token repair
ceiling regression; it does NOT claim to reproduce a real provider failure.
"""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from app.generation.director import (
    _incomplete_reason,
    _repair_output_token_budget,
)

ROOT = Path(__file__).resolve().parents[2]


def test_json_repair_has_headroom_for_full_story_object():
    assert _repair_output_token_budget(4600) >= 6400
    assert _repair_output_token_budget(5400) >= 6600
    assert _repair_output_token_budget(7000) == 7000
    assert _repair_output_token_budget(2600) == 6400


def test_incomplete_response_reason_from_sdk_object_or_dict():
    assert _incomplete_reason(SimpleNamespace(status="completed", incomplete_details=None)) is None
    assert _incomplete_reason(SimpleNamespace(status="incomplete", incomplete_details={"reason": "max_output_tokens"})) == "max_output_tokens"
    assert _incomplete_reason(SimpleNamespace(status="incomplete", incomplete_details=SimpleNamespace(reason="max_output_tokens"))) == "max_output_tokens"
    assert _incomplete_reason(SimpleNamespace(status="incomplete", incomplete_details=None)) == "unknown"


def test_both_repair_branches_use_bounded_budget_and_metering():
    source = (ROOT / "app/generation/director.py").read_text()
    assert source.count('repair_limit = _repair_output_token_budget(turn_output_tokens)') == 2
    assert 'operation="director_json_repair"' in source
    assert 'operation="director_schema_repair"' in source
    assert source.count("max_output_tokens=repair_limit") >= 4
    assert "incomplete_reason={_incomplete_reason(repair_response)}" in source
    assert "Your locked choices and dice remain saved" in source
    assert 'Story Director returned malformed JSON after repair.' not in source
    # Do not mask the metering service's explicit quota error as a bad story.
    assert source.count("except UsageLimitExceeded:") >= 4


def test_no_extra_full_story_attempts_or_dice_change():
    source = (ROOT / "app/generation/director.py").read_text()
    assert "_request_story_with_recovery(" in source
    assert source.count("_repair_output_token_budget(turn_output_tokens)") == 2
    # Neither repair should call server dice or commit an adventure.
    repairs = source.split('except json.JSONDecodeError as error:', 1)[1].split('if opening_mode and', 1)[0]
    assert "roll_dice" not in repairs
    assert "commit_director_turn" not in repairs
