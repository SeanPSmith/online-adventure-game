"""Regression guard: Director GPT-6 choices and expanded JSON repair coexist."""
import asyncio
from pathlib import Path


def test_global_model_context_and_repair_budget_survive_together():
    from app.generation.director import OpenAIRuntimeDirector, _repair_output_token_budget
    from app.generation.model_preferences import active_global_models

    director = OpenAIRuntimeDirector()

    async def check(story: str, economy: str):
        token = active_global_models.set({"story_model": story, "economy_model": economy})
        try:
            await asyncio.sleep(0)
            return director.story_model, director.economy_model
        finally:
            active_global_models.reset(token)

    results = asyncio.run(_run(check))
    assert results == [
        ("gpt-6.1-sol", "gpt-6-luna"),
        ("gpt-5.6-sol", "gpt-5.6-luna"),
    ]
    assert 6400 <= _repair_output_token_budget(4800) <= 7000


async def _run(check):
    return await asyncio.gather(
        check("gpt-6.1-sol", "gpt-6-luna"),
        check("gpt-5.6-sol", "gpt-5.6-luna"),
    )


def test_model_settings_snapshot_set_at_both_generation_entry_points():
    source = (Path(__file__).resolve().parents[2] / "app/generation/director.py").read_text()
    assert source.count("active_global_models.set(await models_for_request())") == 2
    assert 'operation="director_schema_repair"' in source
    assert 'operation="director_json_repair"' in source
    assert "[DIRECTOR REPAIR RESPONSE]" in source
