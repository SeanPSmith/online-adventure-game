from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.generation.director import OpenAIRuntimeDirector
from app.generation.director_schema import DirectorStoryTurnDraft


class _FakeResponses:
    def __init__(self, *, output_text: str | None = None, error: Exception | None = None):
        self.output_text = output_text
        self.error = error

    async def create(self, **kwargs):
        if self.error is not None:
            raise self.error
        return SimpleNamespace(
            output_text=self.output_text,
            id="recap-test",
            usage=SimpleNamespace(input_tokens=10, output_tokens=20, total_tokens=30),
        )


class _FakeClient:
    def __init__(self, responses):
        self.responses = responses


def _session():
    return SimpleNamespace(
        room_code="TEST01",
        scene=SimpleNamespace(title="THE STORE", body="Gary watches the freezer door."),
        director_memory="CURRENT GOAL: Find the source of the ringing.",
        story_state={"current_goal": "Find the source of the ringing."},
    )


def test_story_schema_does_not_ask_main_director_for_resolution_narration():
    properties = DirectorStoryTurnDraft.model_json_schema()["properties"]
    assert "resolution_narration" not in properties
    assert "scene_body" in properties
    assert "story_state" in properties


@pytest.mark.asyncio
async def test_parallel_recap_uses_fast_structured_output():
    director = OpenAIRuntimeDirector()
    director._client = _FakeClient(
        _FakeResponses(
            output_text='{"resolution_narration":"Athena catches the falling shelf while Chordy keeps Gary talking, buying both Heroes a narrow opening."}'
        )
    )

    result = await director._generate_parallel_recap(
        session=_session(),
        player_context=[{"player_id": "p1", "character_name": "Athena"}],
        turn_facts={"resolution": "Athena succeeded.", "results": []},
    )

    assert result["meta"]["fallback"] is False
    assert result["meta"]["usage"]["total_tokens"] == 30
    assert result["resolution_narration"].startswith("Athena catches")


@pytest.mark.asyncio
async def test_parallel_recap_failure_falls_back_to_authoritative_server_resolution():
    director = OpenAIRuntimeDirector()
    director._client = _FakeClient(
        _FakeResponses(error=RuntimeError("provider unavailable"))
    )

    result = await director._generate_parallel_recap(
        session=_session(),
        player_context=[],
        turn_facts={
            "resolution": "Athena rolled 18 and succeeds. Chordy rolled 4 and fails.",
            "results": [],
        },
    )

    assert result["meta"]["fallback"] is True
    assert result["meta"]["provider"] == "server_fallback"
    assert result["resolution_narration"] == (
        "Athena rolled 18 and succeeds. Chordy rolled 4 and fails."
    )
