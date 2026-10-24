"""Pass 66.33: saved turn recovery and global AI settings contracts."""
import asyncio
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def test_turn_recovery_only_syncs_authoritative_state():
    theater = read('frontend/src/features/adventure/TurnTheater.tsx')
    hook = read('frontend/src/features/adventure/useTurnTheater.ts')
    live = read('frontend/src/state/useLiveAdventure.ts')
    server = read('app/main.py')
    assert 'window.setInterval(() => onSync(), 12000)' in theater
    assert 'socket.emit("sync_adventure_state"' in live
    assert 'async def sync_adventure_state(' in server
    assert 'state = build_game_state(' in server
    assert 'readyReceiptRef.current = committed' in hook
    assert 'rememberIntermission(null);' in hook
    assert 'showReceipt(committed);' in hook
    assert 'if (!game.turn_pending && game.turn_number > resolvedTurnNumber(committed))' in hook
    assert 'acknowledgeResolution' in hook
    assert 'writeAcknowledgedReceipt' in hook


def test_model_preferences_persist_and_validate(tmp_path, monkeypatch):
    from app.auth import store as auth_store
    from app.generation.model_preferences import (
        MODEL_IDS, active_global_models, defaults, load_global_models, save_global_models,
    )
    monkeypatch.setattr(auth_store, 'DATABASE_PATH', tmp_path / 'quillairo.sqlite3')
    assert 'gpt-6.1-sol' in MODEL_IDS and 'gpt-6-luna' in MODEL_IDS
    initial = asyncio.run(load_global_models())
    assert initial == defaults()
    saved = asyncio.run(save_global_models('gpt-6.1-sol', 'gpt-6-luna'))
    assert asyncio.run(load_global_models()) == saved
    with pytest.raises(ValueError):
        asyncio.run(save_global_models('not-a-model', 'gpt-6-luna'))
    assert asyncio.run(load_global_models()) == saved

    async def isolated():
        from app.generation.director import OpenAIRuntimeDirector
        director = OpenAIRuntimeDirector()
        async def sample(story):
            active_global_models.set({'story_model': story, 'economy_model': 'gpt-6-luna'})
            await asyncio.sleep(0)
            return director.story_model, director.economy_model
        return await asyncio.gather(sample('gpt-6.1-sol'), sample('gpt-5.6-sol'))

    assert asyncio.run(isolated()) == [('gpt-6.1-sol', 'gpt-6-luna'), ('gpt-5.6-sol', 'gpt-6-luna')]


def test_admin_only_model_selection_affects_director_and_recap():
    routes = read('app/auth/routes.py')
    director = read('app/generation/director.py')
    settings = read('frontend/src/pages/account/SettingsPage.tsx')
    selector = read('frontend/src/pages/account/GlobalAiModelSettings.tsx')
    assert '@router.get("/admin/ai-models")' in routes
    assert '@router.put("/admin/ai-models")' in routes
    assert 'Depends(require_admin_write)' in routes
    assert 'Depends(require_admin_user)' in routes
    assert 'active_global_models.set(await models_for_request())' in director
    assert 'operation="director_story"' in director
    assert 'operation="director_recap"' in director
    assert 'isAdmin ? <GlobalAiModelSettings />' in settings
    assert 'saveGlobalAiModels(story, recap)' in selector
    assert 'X-TOT-Admin-Request' in read('frontend/src/services/auth.ts')
