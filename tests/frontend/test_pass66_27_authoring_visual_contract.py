"""Pass 66.27: confirm visual scope and author/hero wiring remain intact."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_real_author_studio_still_uses_existing_document_controls():
    html = read('app/web/author/index.html')
    js = read('app/web/author/author.js')
    # Versioned URLs may change as new styling passes ship. Preserve the
    # override order and ensure both stylesheets remain cache-versioned.
    assert re.search(r'/static/author/author\.css\?v=\w+', html)
    assert re.search(r'/static/author/quillairoStudioPass6627\.css\?v=\w+', html)
    assert html.index('author.css?v=') < html.index('quillairoStudioPass6627.css')
    for control in ('adventure-list','new-adventure-button','save-button','publish-button',
                    'versions-button','author-ai-dialog','q-world-art-panel','generation-panel'):
        assert f'id="{control}"' in html, control
    for feature in ('autosave', '/api/author/assist', 'author-terminal-select'):
        assert feature in js, feature


def test_hero_workflow_and_author_landing_stay_connected():
    hero = read('frontend/src/pages/heroes/HeroCreatePage.tsx')
    home = read('frontend/src/pages/author/AuthorPage.tsx')
    for method in ('createCharacter(', 'getCreationRules(', 'suggestedBuild(',
                   'proposeHeroBiography(', 'generateHeroPortrait(', 'chooseHeroPortrait('):
        assert method in hero
    assert 'quillairoHeroCreatorPass6627.css' in hero
    assert 'quillairoAuthorHomePass6627.css' in home
    assert 'listAuthorDocuments(' in home
    assert 'href="/author-console"' in home
    assert 'q27-author-home' in home


def test_six_paper_themes_with_scoped_focus_styles():
    studio = read('app/web/author/quillairoStudioPass6627.css')
    creator = read('frontend/src/pages/heroes/quillairoHeroCreatorPass6627.css')
    home = read('frontend/src/pages/author/quillairoAuthorHomePass6627.css')
    for css in (studio, creator, home):
        for theme in ('cream','parchment','navy','midnight','phosphor'):
            assert f'data-ink-paper="{theme}"' in css
        assert 'focus-visible' in css
        assert '@media' in css
    assert 'author-terminal-select' in studio
    assert 'qh-steps' in creator
    assert 'qh-answer-grid' in creator
    assert '.q27-author-home' in home


def test_no_changes_to_runtime_turn_engine():
    assert 'director_story_rescue' in read('app/generation/director.py')
    assert 'operation="director_story"' in read('app/generation/director.py')
    assert read('app/main.py').count('schedule_scene_art(room.code, session.scene, session.adventure)') == 2
