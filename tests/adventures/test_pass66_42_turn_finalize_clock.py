"""Regression: a committed Director chapter must not fail in Hero progression.

The production FastAPI socket gateway isn't needed here: execute the real
apply_turn_progression AST and top-level clock import with minimal service stubs.
This catches missing globals such as utc_now without a live AI request.
"""
from __future__ import annotations

import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

MAIN = Path(__file__).resolve().parents[2] / 'app' / 'main.py'


def test_rest_clock_import_is_defined_at_module_scope():
    tree = ast.parse(MAIN.read_text())
    assert any(isinstance(node, ast.ImportFrom) and node.module == 'app.auth.sessions'
               and any(alias.name == 'utc_now' for alias in node.names)
               for node in tree.body)
    assert sum(isinstance(n, ast.AsyncFunctionDef) and n.name == 'apply_turn_progression'
               for n in tree.body) == 1


def test_authoritative_xp_progression_does_not_crash_or_double_award():
    tree = ast.parse(MAIN.read_text())
    nodes = [node for node in tree.body
             if (isinstance(node, ast.ImportFrom) and node.module == 'app.auth.sessions')
             or (isinstance(node, ast.AsyncFunctionDef) and node.name == 'apply_turn_progression')]
    saved = []

    async def fake_save(_owner, hero):
        saved.append((hero.experience, hero.rest_recovered_at))

    ns = {
        'decay_finite_effect_turns': lambda hero: [],
        'level_for_experience': lambda xp: 1,
        'max_health_for_level': lambda level: 20,
        'progression_public_data': lambda level, experience: {},
        'character_service': SimpleNamespace(save_owned_character=fake_save),
    }
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])),
                 str(MAIN), 'exec'), ns)
    hero = SimpleNamespace(
        character_id='test-hero', owner_user_id='owner', level=1,
        health=20, max_health=20, experience=0, is_alive=True,
        effects=[], awarded_xp_events=[], applied_health_events=[],
        rest_recovered_at=None, death_record=None,
    )
    room = SimpleNamespace(code='ROOM42', players={'p': SimpleNamespace()})
    session = SimpleNamespace(story_state={'recent_consequences': []}, character_adventure_stats={})
    result = {'results': [{'player_id': 'p', 'choice_id': 'shelter', 'xp_reward': 12}]}

    first = asyncio.run(ns['apply_turn_progression'](
        room=room, session=session, characters_by_player_id={'p': hero},
        result=result, resolved_turn_number=21))
    assert first['p']['xp_gained'] == 12
    assert hero.experience == 12
    assert datetime.fromisoformat(hero.rest_recovered_at).utcoffset().total_seconds() == 0
    assert saved and saved[0][0] == 12
    second = asyncio.run(ns['apply_turn_progression'](
        room=room, session=session, characters_by_player_id={'p': hero},
        result=result, resolved_turn_number=21))
    assert second['p']['xp_gained'] == 0
    assert hero.experience == 12
    assert session.character_adventure_stats['test-hero']['xp_earned'] == 12
