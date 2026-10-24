"""Pass 66.31: actual Author Studio keeps all actions and loses terminal fallback styling."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text()


def test_author_studio_keeps_live_document_controls_and_script():
    markup = read('app/web/author/index.html')
    for element_id in (
        'author-user', 'new-adventure-button', 'adventure-list', 'editor',
        'empty-new-button', 'save-button', 'publish-button',
        'preview-document-button', 'versions-button', 'archive-button',
        'generation-panel', 'generation-quality-tier', 'q-world-art-generate',
        'author-ai-dialog', 'author-ai-apply', 'author-confirm-dialog',
        'preview-dialog',
    ):
        assert f'id="{element_id}"' in markup, element_id
    assert 'src="/static/author/author.js?v=066"' in markup
    assert 'id="author-workspace"' in markup
    assert 'href="#author-workspace"' in markup
    assert 'The Writer’s Desk' in markup


def test_author_legacy_select_and_world_reference_have_paper_tokens():
    base = read('app/web/author/author.css')
    folio = read('app/web/author/quillairoStudioPass6627.css')
    assert '--bg: #f7f3e9' in base
    for obsolete in ('#b9f27c', '#6ee98c', '#70ef91', '#7cff9b', '#030706', '#010302', '#68b7d7', '#8ed9f5'):
        assert obsolete not in base, obsolete
    for component in (
        '.world-reference-card.selected', '.author-terminal-select-menu',
        '.author-ai-preview', '.generation-provider-strip', '.migration-panel',
        '.repeat-card', '.toast', '.dialog-actions', '.q-author-skip',
    ):
        assert component in folio, component
    assert 'html[data-ink-paper="phosphor"]' in folio
    assert 'html[data-ink-paper="navy"]' in folio
    assert '@media(max-width:600px)' in folio
    assert ':focus-visible' in folio


def _assert_css_structure_without_optional_parser(css: str, path: str) -> None:
    """Basic dependency-free CSS delimiter validation for the staging suite.

    This is a structural fallback, not a substitute for a full CSS parser.
    It ignores comments and quoted strings (including escaped characters).
    """
    opening = {'{': '}', '[': ']', '(': ')'}
    closing = set(opening.values())
    stack: list[tuple[str, int]] = []
    pos = 0
    while pos < len(css):
        if css.startswith('/*', pos):
            end = css.find('*/', pos + 2)
            assert end >= 0, f'{path}: unterminated CSS comment at {pos}'
            pos = end + 2
            continue
        char = css[pos]
        if char in ('"', "'"):
            quote = char
            pos += 1
            while pos < len(css):
                if css[pos] == '\\':
                    pos += 2
                elif css[pos] == quote:
                    pos += 1
                    break
                else:
                    pos += 1
            else:
                raise AssertionError(f'{path}: unterminated quoted string')
            continue
        if char == '\\':
            # CSS escapes can include otherwise significant delimiters.
            pos += 2
            continue
        if char in opening:
            stack.append((char, pos))
        elif char in closing:
            assert stack, f'{path}: unmatched closing delimiter {char!r} at {pos}'
            left, left_pos = stack.pop()
            assert opening[left] == char, (
                f'{path}: {left!r} at {left_pos} closed by {char!r} at {pos}'
            )
        pos += 1
    assert not stack, f'{path}: unclosed CSS delimiters: {stack[-3:]}'


def test_author_css_stylesheets_parse_without_errors():
    # tinycss2 was never a required project/test dependency. Use it for
    # full parse validation where installed, without breaking CI elsewhere.
    try:
        import tinycss2
    except ImportError:
        tinycss2 = None

    for path in ('app/web/author/author.css', 'app/web/author/quillairoStudioPass6627.css'):
        source = read(path)
        _assert_css_structure_without_optional_parser(source, path)
        if tinycss2 is not None:
            tokens = tinycss2.parse_stylesheet(source, skip_whitespace=True, skip_comments=True)
            errors = [item for item in tokens if item.type == 'error']
            assert not errors, (path, errors)


def test_authoring_behaviour_remains_out_of_visual_overlay():
    # All buttons remain wired to existing JS; the HTML remains an HTML/JS
    # app, rather than an accidental React route or replacement mockup.
    markup = read('app/web/author/index.html')
    assert '<script src="/static/author/author.js?v=066" defer></script>' in markup
    assert 'href="/game"' in markup
    assert 'href="/account/author"' in markup
    assert len(re.findall(r'<dialog\b', markup)) >= 4
