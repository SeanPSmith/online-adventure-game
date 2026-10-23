"""Pass 66.22 — player library/chronicle reskin must retain live functionality."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "frontend" / "src" / "pages" / "game"


def source(name: str) -> str:
    return (GAME / name).read_text(encoding="utf-8")


def test_both_active_archives_are_explicitly_scoped_to_new_style():
    for file_name, marker in (
        ("MyAdventuresPage.tsx", 'className="q22-archive q22-journey-library"'),
        ("HistoryPage.tsx", 'className="q22-archive q22-sealed-archive"'),
    ):
        code = source(file_name)
        assert 'import "./quillairoChronicleArchivePass6622.css"' in code
        assert marker in code
    stylesheet = source("quillairoChronicleArchivePass6622.css")
    assert ".q22-archive .history-grid" in stylesheet
    assert ".q22-archive .q22-chronicle" in stylesheet
    assert "var(--ib-paper" in stylesheet
    assert "var(--qs-accent" in stylesheet


def test_live_adventure_flow_is_still_bound_to_real_server_and_reader():
    code = source("MyAdventuresPage.tsx")
    for required in (
        'apiFetch<Library>("/api/player/adventures")',
        "useGameSocket()", "adventures, reload", "setShelf(value)",
        "setSearch(e.target.value)", "aria-pressed={shelf === value}",
        "row.director_retry_required", "RECOVER ADVENTURE",
        "encodeURIComponent(row.room_code)", "encodeURIComponent(row.character_id",
        "row.final_resolution", "row.turn_history?.map", "ArchivedChronicleAudio",
        "ShareMomentButton", "row.ended_by", "setReload(n => n + 1)",
    ):
        assert required in code, required


def test_completed_chronicles_still_use_owner_scoped_sources_and_audio():
    code = source("HistoryPage.tsx")
    for required in (
        "listCharacters()", "listCharacterStories(hero.character_id)",
        "new Map<string, CompletedStory>()", "story.history_id", "b.completed_at",
        "story.final_resolution", "ArchivedChronicleAudio", "ShareMomentButton",
    ):
        assert required in code, required
    assert 'role="alert"' in code


def test_reskin_does_not_override_reader_or_arcade_classes():
    css = source("quillairoChronicleArchivePass6622.css")
    assert ":root" not in css
    assert ".inkbound-live" not in css
    assert ".inkbound-lobby" not in css
    assert ".arcade-" not in css
    assert ".q22-archive" in css
    assert "@media (max-width: 820px)" in css
    assert "@media (max-width: 540px)" in css
    assert "prefers-reduced-motion" in css
    assert ":focus-visible" in css


def test_archive_no_longer_inherits_terminal_era_status_copy():
    library = source("MyAdventuresPage.tsx")
    history = source("HistoryPage.tsx")
    assert "OPENING YOUR LIBRARY_" not in library
    assert "DUSTING OFF THE ARCHIVE_" not in history
    assert "NO TALES TO TELL. YET." not in history
    assert "Every journey leaves a trace." in library
    assert "Some endings stay with us." in history
