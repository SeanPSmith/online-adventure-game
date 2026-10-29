"""Pass 66.54 — accessible, data-grounded archive presentation only."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "frontend/src/pages/game"


def source(name):
    return (GAME / name).read_text(encoding="utf-8")


def test_archives_use_a_shared_scoped_66_54_layer():
    for name in ("MyAdventuresPage.tsx", "HistoryPage.tsx"):
        page = source(name)
        assert 'import "./inkscapeChroniclesPass6654.css";' in page
        assert 'import "./inkscapeArchivePass6652.css";' in page
        assert 'import "./quillairoChronicleArchivePass6622.css";' in page
        assert 'q54-browser-tools' in page
        assert 'q54-results' in page
        assert 'role="status" aria-live="polite"' in page
        assert 'q54-clear-search' in page
        assert 'q54-chronicle-card' in page


def test_live_library_filters_reading_and_recovery_remain_real():
    page = source("MyAdventuresPage.tsx")
    for required in (
        'apiFetch<Library>("/api/player/adventures")',
        'setShelf(value)', 'setSearch(e.target.value)',
        'row.world_title', 'row.play_mode',
        'row.director_retry_required', 'RECOVER ADVENTURE',
        'encodeURIComponent(row.room_code)',
        'encodeURIComponent(row.character_id || "")',
        '<summary>READ CHRONICLE</summary>',
        'row.turn_history?.map(',
        'ArchivedChronicleAudio', 'ShareMomentButton',
        'row.ended_by', 'setReload(n => n + 1)',
    ):
        assert required in page, required
    assert 'role="group" aria-label="Adventure status"' in page
    assert 'data-chronicle-status={shelf}' in page


def test_owner_scoped_history_has_search_and_only_true_ending_content():
    page = source("HistoryPage.tsx")
    for required in (
        'listCharacters()', 'listCharacterStories(hero.character_id)',
        'new Map<string, CompletedStory>()',
        'deduplicated.set(story.history_id, story)',
        'const displayedStories = stories.filter(',
        'displayedStories.map((story)',
        'story.final_scene_title', 'story.final_resolution',
        'story.completed_at', 'READ ENDING',
        'ArchivedChronicleAudio',
        'label="SHARE CHRONICLE"',
        'role="alert"',
    ):
        assert required in page, required
    assert 'No matching chronicles' in page
    assert 'story.turn_history' not in page  # not provided by this endpoint
    assert 'fake' not in page.lower()


def test_css_limits_to_archives_and_respects_readability_and_reduced_motion():
    css = source("inkscapeChroniclesPass6654.css")
    for required in (
        '.q22-archive.q22-journey-library',
        '.q22-archive.q22-sealed-archive',
        'grid-template-columns: minmax(0, 1fr);',
        '.q54-chronicle-card',
        '.q54-browser-tools',
        'prefers-reduced-motion',
        ':focus-visible',
        'max-width: 960px',
        'max-width: 600px',
    ):
        assert required in css, required
    for forbidden in (':root', '.inkbound-live', '.arcade-', 'background-image:', 'filter:grayscale', 'paper-grain', 'box-shadow: 0 0'):
        assert forbidden not in css, forbidden
    try:
        import tinycss2
    except ImportError:
        return
    rules = tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True)
    assert not [rule for rule in rules if rule.type == 'error']
