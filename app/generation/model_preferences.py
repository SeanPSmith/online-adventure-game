"""Persisted, administrator-controlled global Director model defaults.

No static environment overrides or in-memory process settings are needed after
saving: requests load durable settings before issuing a model call. Each async
task retains its own model snapshot via ContextVar to avoid cross-room races.
"""
from __future__ import annotations

import asyncio
import os
from contextvars import ContextVar
from pathlib import Path
from app.database import connect_database

MODEL_IDS = (
    "gpt-5.6-sol", "gpt-6.1-sol", "gpt-5.6-luna", "gpt-6-luna",
)
active_global_models: ContextVar[dict[str, str] | None] = ContextVar(
    "quillairo_active_global_models", default=None,
)


def defaults() -> dict[str, str]:
    return {
        "story_model": (os.getenv("TOT_OPENAI_DIRECTOR_STORY_MODEL") or os.getenv("TOT_OPENAI_STORY_MODEL") or "gpt-5.6-sol").strip(),
        "economy_model": (os.getenv("TOT_OPENAI_DIRECTOR_ECONOMY_MODEL") or os.getenv("TOT_OPENAI_ECONOMY_MODEL") or "gpt-5.6-luna").strip(),
    }


def _connect():
    # Reuse the game's existing SQLite/Postgres connection abstraction.
    from app.auth.store import DATABASE_PATH
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    return connect_database(DATABASE_PATH)


def _read_sync() -> dict[str, str]:
    configured = defaults()
    with _connect() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS ai_global_models (name TEXT PRIMARY KEY, model TEXT NOT NULL)")
        rows = connection.execute("SELECT name, model FROM ai_global_models").fetchall()
        for row in rows:
            name, model = row["name"], row["model"]
            if name in configured and model in MODEL_IDS:
                configured[name] = model
    return configured


async def load_global_models() -> dict[str, str]:
    return await asyncio.to_thread(_read_sync)


def _save_sync(story_model: str, economy_model: str) -> dict[str, str]:
    if story_model not in MODEL_IDS or economy_model not in MODEL_IDS:
        raise ValueError("Unsupported AI model selection.")
    with _connect() as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS ai_global_models (name TEXT PRIMARY KEY, model TEXT NOT NULL)")
        for name, model in (("story_model", story_model), ("economy_model", economy_model)):
            connection.execute(
                "INSERT INTO ai_global_models (name, model) VALUES (?, ?) "
                "ON CONFLICT (name) DO UPDATE SET model = excluded.model",
                (name, model),
            )
        connection.commit()
    return {"story_model": story_model, "economy_model": economy_model}


async def save_global_models(story_model: str, economy_model: str) -> dict[str, str]:
    return await asyncio.to_thread(_save_sync, story_model, economy_model)


async def models_for_request() -> dict[str, str]:
    """Fail open to known configured defaults if a preference read is unavailable.

    Preference storage is not a prerequisite for completing an active turn.
    """
    try:
        return await load_global_models()
    except Exception as error:
        print(f"[AI MODEL SETTINGS FALLBACK] type={type(error).__name__} detail={error}")
        return defaults()
