"""Regress the staging 500: missing ai_usage_scope/UsageLimitExceeded imports.

Exercise the real FastAPI route with stubbed model calls; never bill a provider.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.authoring import routes as author_routes
from app.generation.provider import (
    AdventureGenerationConfigurationError,
    AdventureGenerationResponseError,
)
from app.usage import UsageLimitExceeded
from app.usage.meter import current_usage_scope


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(author_routes.router)
    app.dependency_overrides[author_routes.require_author_write] = (
        lambda: SimpleNamespace(user_id="author-test-001")
    )
    with TestClient(app) as test_client:
        yield test_client


def _post(client):
    return client.post(
        "/api/author/assist",
        json={"source": {}, "instruction": "Help refine this adventure."},
        headers={"X-TOT-Author-Request": "1"},
    )


def test_writer_helper_uses_author_scope_and_returns_success(monkeypatch, client):
    seen = {}

    async def stub_assist(**kwargs):
        seen["scope"] = current_usage_scope()
        seen["kwargs"] = kwargs
        return {"message": "Proposal prepared", "source": kwargs["source"]}

    monkeypatch.setattr(author_routes.author_assist_service, "assist", stub_assist)
    assert current_usage_scope().user_id is None
    response = _post(client)
    assert response.status_code == 200, response.text
    assert response.json()["message"] == "Proposal prepared"
    assert seen["scope"].user_id == "author-test-001"
    assert seen["scope"].surface == "author_assist"
    assert seen["scope"].adventure_id == "author-draft"
    assert seen["kwargs"]["linked_world_source"] is None
    assert current_usage_scope().user_id is None


@pytest.mark.parametrize("raised,expected_status", [
    (UsageLimitExceeded("Monthly allowance exceeded", code="monthly_budget", snapshot={"remaining": 0}), 402),
    (AdventureGenerationConfigurationError("Not configured"), 503),
    (AdventureGenerationResponseError("Malformed provider result"), 502),
    (ValueError("Invalid draft"), 422),
])
def test_writer_helper_handles_provider_errors(monkeypatch, client, raised, expected_status):
    async def stub_assist(**kwargs):
        raise raised

    monkeypatch.setattr(author_routes.author_assist_service, "assist", stub_assist)
    response = _post(client)
    assert response.status_code == expected_status, response.text
    if expected_status == 402:
        assert response.json()["detail"]["code"] == "monthly_budget"
        assert response.json()["detail"]["usage"] == {"remaining": 0}
