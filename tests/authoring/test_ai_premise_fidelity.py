"""Pass 63.10: author premise cannot drift silently or apply without review."""
from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.authoring.ai_assist import AuthorAssistService
from app.authoring.service import default_source_document


@pytest.mark.parametrize('kind, premise_key', [('brief', 'starting_situation'), ('world', 'premise')])
def test_rejects_plane_crash_replacing_boat_accident(kind, premise_key):
    src = default_source_document(title='Castaways', slug='castaways', document_kind=kind)
    service = AuthorAssistService()
    fake = {
        'identity': {'one_sentence_pitch': 'A plane crashes into the mountains'},
        premise_key: 'After the plane crash, survivors trek through inland wilderness.',
        'core_goal': 'Climb a mountain.',
    }
    service._request = AsyncMock(return_value=fake)
    before = src.copy()
    with pytest.raises(ValueError, match='core premise') as exc:
        asyncio.run(service.assist(source=src, instruction='boat accident and beach'))
    assert 'beach' in str(exc.value)
    assert src == before  # No generated fiction got into the author source.


@pytest.mark.parametrize('kind, premise_key', [('brief', 'starting_situation'), ('world', 'premise')])
def test_accepts_matching_boat_beach_event(kind, premise_key):
    src = default_source_document(title='Castaways', slug='castaways', document_kind=kind)
    service = AuthorAssistService()
    fake = {
        'identity': {'one_sentence_pitch': 'A castaway fights for survival'},
        premise_key: 'A boat accident sends the survivors ashore on a beach.',
        'core_goal': 'Survive and find shelter.',
    }
    service._request = AsyncMock(return_value=fake)
    result = asyncio.run(service.assist(source=src, instruction='boat accident and beach'))
    assert 'boat accident' in result['source'][premise_key]
    assert 'beach' in result['source'][premise_key]
    assert premise_key in result['changed_paths']
    assert src[premise_key] == ''


def test_existing_authored_situation_stays_protected():
    src = default_source_document(title='Castaways', slug='castaways', document_kind='brief')
    src['starting_situation'] = 'A fishing boat sinks off a quiet tropical beach.'
    service = AuthorAssistService()
    service._request = AsyncMock(return_value={
        'starting_situation': 'An airplane crashes in the mountains.',
        'story_guidance': {'danger': 'Rising tides and shipwreck debris.'},
    })
    result = asyncio.run(service.assist(source=src, instruction='Make it more intense'))
    assert result['source']['starting_situation'] == src['starting_situation']
    assert 'starting_situation' not in result['changed_paths']


def test_author_preview_requires_explicit_apply():
    root = Path(__file__).resolve().parents[2]
    html = (root/'app/web/author/index.html').read_text()
    js = (root/'app/web/author/author.js').read_text()
    assert 'id="author-ai-preview"' in html
    assert 'id="author-ai-apply"' in html
    assert 'APPLY REVIEWED CHANGES' in html
    assert 'renderAuthorAiProposal(source, result)' in js
    assert 'applyReviewedAuthorAiProposal' in js
    # Only the explicit approval function may invoke autosaving source mutation.
    section = js[js.index('async function submitAuthorAiHelper()'): js.index('function createAiPill(')]
    assert 'applyAiAssistResult(' not in section
    assert 'activeSource =' not in section


def test_single_field_helper_cannot_replace_boat_beach_with_plane_crash():
    src = default_source_document(title='Castaways', slug='castaways', document_kind='brief')
    src['starting_situation'] = 'A boat runs aground off a beach.'
    service = AuthorAssistService()
    service._request = AsyncMock(return_value={'value': 'An airplane crashes in the wilderness.'})
    with pytest.raises(ValueError, match='core premise'):
        asyncio.run(service.assist(
            source=src, section='field', field_path='starting_situation',
            instruction='boat accident and beach',
        ))
    assert src['starting_situation'] == 'A boat runs aground off a beach.'
