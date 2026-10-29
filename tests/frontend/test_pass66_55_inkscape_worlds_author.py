"""66.55 presentation contract: real catalog, Hero eligibility and Author editor remain intact."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def test_real_world_discovery_filters_and_clear_are_visible():
    page = read('frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx')
    for contract in (
        'visibleCatalog.filter(', 'setNeedle(event.target.value)', 'onChange={setFilter}',
        'setNeedle(""); setFilter("ALL");', 'found.length',
        'aria-live="polite"', 'className="i656-interior q55-atlas"',
        'No worlds found.', 'Show all worlds',
        'onClick={() => inspect(item)}', 'onCreate(selectedStory,mode)',
        'onJoin(roomCode.trim().toUpperCase())', 'const selectedHero = freeHeroes.find(',
        'Health {hero.health}/{hero.max_health}',
        'onError={event => nextCoverSource(', 'storyCover(item.title,item.tags,item.metadata)',
        'import "./inkscapeWorldsPass6655.css";',
    ):
        assert contract in page, contract
    # No fabricated positional world ranking. Real tags remain.
    assert 'No. {String(index+1).padStart' not in page
    assert '{item.tags.slice(0,2).join(" · ") || "Adventure"}' in page


def test_author_landing_keeps_real_authorization_fetch_and_navigation():
    page = read('frontend/src/pages/author/AuthorPage.tsx')
    for contract in (
        'canUseAuthorStudio(user?.permissions)', 'getAuthorIdentity()',
        'listAuthorDocuments()', 'documentResponse.adventures',
        'key={String(document.document_id ?? document.slug ?? index)}',
        'href="/author-console"', 'q55-author-home',
        'import "./inkscapeAuthorPass6655.css";',
        'documents.length', 'role="status"',
        'Author access required',
    ):
        assert contract in page, contract
    assert '<a className="author-document"' not in page  # No fake per-document URL.


def test_author_studio_keeps_existing_actions_and_js_unchanged():
    html = read('app/web/author/index.html')
    js = read('app/web/author/author.js')
    assert html.index('author.css?v=') < html.index('quillairoStudioPass6627.css?v=') < html.index('inkscapeStudioPass6655.css?v=')
    assert html.count('inkscapeStudioPass6655.css?v=06655') == 1
    for control in (
        'author-workspace', 'editor', 'adventure-list', 'new-adventure-button',
        'save-button', 'publish-button', 'archive-button',
        'versions-button', 'author-ai-dialog', 'q-world-art-panel',
        'generation-panel', 'preview-dialog',
    ):
        assert f'id="{control}"' in html, control
    for real_feature in ('autosave', '/api/author/assist', 'author-terminal-select'):
        assert real_feature in js, real_feature
    assert '<script src="/static/author/author.js?v=066" defer></script>' in html


def test_scoped_reduced_motion_and_theme_aware_css():
    atlas = read('frontend/src/pages/game/inkscapeWorldsPass6655.css')
    home = read('frontend/src/pages/author/inkscapeAuthorPass6655.css')
    studio = read('app/web/author/inkscapeStudioPass6655.css')
    assert '.inkbound-home .q55-atlas' in atlas
    assert '.inkbound-home .q55-atlas-status' in atlas
    assert '.q55-author-home .author-document' in home
    for theme in ('navy', 'midnight', 'phosphor', 'cream', 'parchment'):
        assert theme in studio
    for css in (atlas, home, studio):
        assert '@media' in css
        assert ':focus-visible' in css
        assert '@import' not in css
        assert 'url(http' not in css
        assert css.count('{') == css.count('}')
        try:
            import tinycss2
        except ImportError:
            continue
        errors = [x for x in tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True) if x.type == 'error']
        assert not errors, errors
