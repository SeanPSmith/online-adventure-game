from __future__ import annotations
from tests.support import PROJECT_ROOT

import sqlite3
from pathlib import Path

import pytest

from app.usage.pricing import estimate_cost_microusd
from app.usage.store import AIUsageStore, UsageLimitExceeded


ROOT = PROJECT_ROOT


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def bootstrap_permissions(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            "CREATE TABLE user_permissions (user_id TEXT NOT NULL, permission TEXT NOT NULL)"
        )
        connection.execute(
            "CREATE TABLE users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1)"
        )
        connection.execute("INSERT INTO users (user_id, username) VALUES ('player-1', 'tester')")
        connection.commit()
    finally:
        connection.close()


def test_current_project_model_prices_have_sane_cost_estimates(monkeypatch) -> None:
    monkeypatch.delenv("TOT_AI_MODEL_PRICING_JSON", raising=False)
    # 1k input + 100 output at $4/M + $20/M = $0.006.
    assert estimate_cost_microusd(
        model="gpt-5.6-sol",
        input_tokens=1000,
        output_tokens=100,
    ) == 6000
    # Luna is intentionally much cheaper for recaps / repair work.
    assert estimate_cost_microusd(
        model="gpt-5.6-luna",
        input_tokens=1000,
        output_tokens=100,
    ) == 320


@pytest.mark.asyncio
async def test_usage_store_reserves_budget_before_provider_call(tmp_path: Path, monkeypatch) -> None:
    database = tmp_path / "usage.sqlite3"
    bootstrap_permissions(database)
    monkeypatch.setenv("TOT_AI_PLAYTESTER_MONTHLY_BUDGET_USD", "0.01")
    monkeypatch.setenv("TOT_AI_PLAYTESTER_MONTHLY_REQUEST_LIMIT", "10")
    monkeypatch.setenv("TOT_AI_GLOBAL_DAILY_BUDGET_USD", "100")
    store = AIUsageStore(database)
    await store.initialize()

    event_id = await store.begin_event(
        user_id="player-1",
        room_code="ABCD",
        adventure_id="adv-1",
        generated_adventure_id="gen-1",
        surface="live_adventure",
        operation="director_story",
        provider="openai",
        model="gpt-5.6-sol",
        reserved_cost_microusd=7000,
    )

    with pytest.raises(UsageLimitExceeded) as error:
        await store.begin_event(
            user_id="player-1",
            room_code="ABCD",
            adventure_id="adv-1",
            generated_adventure_id="gen-1",
            surface="live_adventure",
            operation="director_recap",
            provider="openai",
            model="gpt-5.6-luna",
            reserved_cost_microusd=4000,
        )
    assert error.value.code == "monthly_budget"

    await store.finish_event(
        event_id=event_id,
        status="succeeded",
        input_tokens=1000,
        output_tokens=100,
        total_tokens=1100,
        estimated_cost_microusd=6000,
        latency_ms=1200,
    )
    snapshot = await store.user_snapshot("player-1")
    assert snapshot["usage"]["requests"] == 1
    assert snapshot["usage"]["estimated_cost_usd"] == 0.006
    assert snapshot["usage"]["remaining_budget_usd"] == 0.004


@pytest.mark.asyncio
async def test_admin_permission_is_unlimited_but_global_guardrail_still_exists(tmp_path: Path, monkeypatch) -> None:
    database = tmp_path / "usage-admin.sqlite3"
    bootstrap_permissions(database)
    connection = sqlite3.connect(database)
    connection.execute("INSERT INTO user_permissions VALUES ('player-1', 'admin')")
    connection.commit()
    connection.close()

    monkeypatch.setenv("TOT_AI_PLAYTESTER_MONTHLY_BUDGET_USD", "0")
    monkeypatch.setenv("TOT_AI_GLOBAL_DAILY_BUDGET_USD", "100")
    store = AIUsageStore(database)
    await store.initialize()
    entitlement = await store.entitlement("player-1")
    assert entitlement.is_unlimited is True
    event_id = await store.begin_event(
        user_id="player-1",
        room_code=None,
        adventure_id="author-doc",
        generated_adventure_id=None,
        surface="author_assist",
        operation="author_assist_document",
        provider="openai",
        model="gpt-5.6-luna",
        reserved_cost_microusd=50_000,
    )
    assert event_id


def test_every_openai_surface_is_metered_and_product_exposes_allowances() -> None:
    director = read("app/generation/director.py")
    seed = read("app/generation/openai_provider.py")
    assist = read("app/authoring/ai_assist.py")
    main = read("app/main.py")
    account = read("frontend/src/pages/account/AccountPage.tsx")
    admin = read("frontend/src/pages/admin/AdminPage.tsx")

    for operation in (
        'operation="director_story"',
        'operation="director_recap"',
        'operation="director_json_repair"',
        'operation="director_schema_repair"',
    ):
        assert operation in director
    assert 'operation="adventure_seed"' in seed
    assert 'operation="player_synopsis"' in seed
    assert 'operation="adventure_seed_repair"' in seed
    assert 'operation=f"author_assist_{section}"' in assist
    assert 'with ai_usage_scope(' in main
    assert "ACCESS & AI USAGE // PLAYTEST" in account
    assert "AI COST CONTROL // PLAYTEST GUARDRAILS" in admin
    assert "DAILY KILL SWITCH" in admin
