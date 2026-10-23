"""Regression tests for bounded, one-attempt Director timeout recovery."""

import asyncio
from pathlib import Path

import pytest

from app.generation.director import (
    DirectorError,
    OpenAIRuntimeDirector,
    _is_timeout_failure,
)


class FakeResponses:
    def __init__(self, client):
        self.client = client

    async def create(self, **kwargs):
        self.client.calls.append(kwargs)
        if self.client.fail_first and len(self.client.calls) == 1:
            raise TimeoutError("upstream timed out")
        if self.client.fail_all:
            raise TimeoutError("rescue timed out")
        return {"model": kwargs["model"], "input": kwargs["input"]}


class FakeClient:
    def __init__(self, *, fail_first=False, fail_all=False):
        self.calls = []
        self.timeouts = []
        self.fail_first = fail_first
        self.fail_all = fail_all
        self.responses = FakeResponses(self)

    def with_options(self, **kwargs):
        self.timeouts.append(kwargs)
        return self


def director(monkeypatch, client):
    monkeypatch.delenv("TOT_OPENAI_DIRECTOR_RESCUE_ENABLED", raising=False)
    subject = OpenAIRuntimeDirector()
    subject._client = client
    async def meter(**kwargs):
        return await kwargs["request"]()
    monkeypatch.setattr("app.generation.director.metered_openai_call", meter)
    return subject


def generate(subject):
    return subject._request_story_with_recovery(
        model="story-primary",
        reasoning="medium",
        instructions="Keep server-owned rolls unchanged.",
        request_input='{"turn_facts":{"roll":17},"room":"ABCDEF"}',
        response_schema={"type": "object", "properties": {}},
        max_output_tokens=4600,
        turn_number=36,
    )


def test_normal_story_uses_original_model_once(monkeypatch):
    client = FakeClient()
    result = asyncio.run(generate(director(monkeypatch, client)))
    assert result["model"] == "story-primary"
    assert len(client.calls) == 1
    assert client.timeouts == []


def test_timeout_tries_one_lower_latency_model_with_identical_canon(monkeypatch):
    client = FakeClient(fail_first=True)
    subject = director(monkeypatch, client)
    result = asyncio.run(generate(subject))
    assert result["model"] == subject.economy_model
    assert len(client.calls) == 2
    first, second = client.calls
    assert first["input"] == second["input"]
    assert first["instructions"] == second["instructions"]
    assert first["text"]["format"]["schema"] == second["text"]["format"]["schema"]
    assert first["reasoning"]["effort"] == "medium"
    assert second["reasoning"]["effort"] == subject.economy_reasoning
    assert client.timeouts == [{"timeout": float(subject.rescue_timeout_seconds), "max_retries": 0}]


def test_second_timeout_stops_and_keeps_retryable_server_state(monkeypatch):
    client = FakeClient(fail_all=True)
    subject = director(monkeypatch, client)
    with pytest.raises(DirectorError, match="choices and dice remain saved"):
        asyncio.run(generate(subject))
    assert len(client.calls) == 2


def test_non_timeout_provider_failure_does_not_trigger_extra_spend(monkeypatch):
    client = FakeClient()
    subject = director(monkeypatch, client)
    async def permission_error(**kwargs):
        raise PermissionError("unauthorized")
    monkeypatch.setattr("app.generation.director.metered_openai_call", permission_error)
    with pytest.raises(PermissionError):
        asyncio.run(generate(subject))
    assert client.timeouts == []


def test_rescue_can_be_disabled(monkeypatch):
    client = FakeClient(fail_first=True)
    subject = director(monkeypatch, client)
    subject.rescue_enabled = False
    with pytest.raises(TimeoutError):
        asyncio.run(generate(subject))
    assert len(client.calls) == 1


def test_deadline_covers_bounded_primary_and_rescue():
    main = Path(__file__).resolve().parents[2] / "app" / "main.py"
    source = main.read_text(encoding="utf-8")
    assert '"rescue_timeout_seconds", 35' in source
    assert "primary_timeout + rescue_timeout + 20.0" in source
    assert "session.pending_turn_facts" in source
    assert '"retry_pending_turn"' not in source[source.index('hard_timeout_seconds = min('):source.index('director_wall_started = time.perf_counter()')]


def test_timeout_classification_is_narrow():
    assert _is_timeout_failure(TimeoutError())
    assert _is_timeout_failure(type("APITimeoutError", (Exception,), {})())
    assert not _is_timeout_failure(ValueError("bad input"))


def test_earlier_story_art_and_usage_contracts_are_not_reverted():
    root = Path(__file__).resolve().parents[2]
    main_source = (root / "app/main.py").read_text(encoding="utf-8")
    director_source = (root / "app/generation/director.py").read_text(encoding="utf-8")
    assert 'fastapi_app.include_router(story_art_router)' in main_source
    assert main_source.count('schedule_scene_art(room.code, session.scene, session.adventure)') == 2
    assert 'schedule_committed_scene as schedule_scene_art' in main_source
    assert '"Quillairo"' in main_source
    assert 'operation="director_story"' in director_source
    assert '"director_story_rescue"' in director_source
    for operation in ('director_recap', 'director_json_repair', 'director_schema_repair'):
        assert f'operation="{operation}"' in director_source


def test_opening_chapter_deadline_covers_both_attempts():
    main_source = (Path(__file__).resolve().parents[2] / "app/main.py").read_text(encoding="utf-8")
    assert 'async with asyncio.timeout(opening_deadline):' in main_source
    assert 'opening_primary_timeout + opening_rescue_timeout + 20.0' in main_source
    assert 'async with asyncio.timeout(105)' not in main_source
