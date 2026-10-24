"""Pass 64.4K: the optional manuscript view consumes existing room authority.

These contracts protect the old AdventurePage while we test a premium view.
No new socket, REST mutation, or Director side channel is permitted.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "frontend/src/pages/game/AdventurePage.tsx"
LIVE = ROOT / "frontend/src/pages/game/InkspaceLiveRoom.tsx"
PAGINATOR = ROOT / "frontend/src/pages/game/inkspaceReaderPagination.ts"
CSS = ROOT / "frontend/src/pages/game/inkspaceLiveRoom.css"


def text(file):
    return file.read_text(encoding="utf-8")


def test_live_reader_is_opt_in_and_parent_owns_original_room_connection():
    page, live = text(PAGE), text(LIVE)
    assert 'searchParams.get("reader") === "book"' in page
    assert 'next.set("reader", "book")' in page
    assert "<InkspaceLiveRoom" in page
    assert 'live.status === "ready"' in page
    assert "theater.chapterReleased" in page
    assert 'theater.phase === "none"' in page
    assert 'adventure-layout--reader-hidden' in page
    assert 'className="adventure-layout"' not in page  # guarded by optional cosmetic class
    assert 'useLiveAdventure' not in live and 'useGameSocket' not in live
    assert 'new WebSocket' not in live and 'socket.emit' not in live
    assert 'fetch(' not in live


def test_real_story_and_choices_not_demo_fiction():
    live, page = text(LIVE), text(PAGE)
    assert "storyParagraphs(scene.body)" in live
    assert "title: scene.title || adventureTitle" in live
    assert "scene.choices.map" in live
    assert 'onSelectChoice={selectChoice}' in page
    assert 'onLockChoice={lockChoice}' in page
    assert 'live.submitChoice(selectedChoiceId)' in page
    assert "server determines the roll" in live.lower()
    assert 'READER_DEMO' not in live
    assert 'river-fortress-cutout.png' not in live
    # No made-up illustration for unrelated generated stories.
    assert 'art:' not in re.search(r'return \{[\s\S]+?\};', live).group(0)
    assert 'art?: Readonly' in text(PAGINATOR)


def test_live_hero_chat_and_notes_are_truthful():
    page, live = text(PAGE), text(LIVE)
    # Live room state is authoritative; the fetched Hero is only a fallback.
    # Both reader variants must show the active party snapshot after each turn.
    assert page.count("hero={partyHeroes.find((p) => p.character_id === characterId) ?? hero ?? null}") == 2
    assert 'messages={live.messages}' in page
    assert 'live.sendChat(message)' in page
    assert "hero.health" in live and "hero.max_health" in live
    assert "hero.experience" in live and "hero.is_alive" in live
    assert "msg.player_name" in live and "msg.text" in live
    assert 'maxLength={500}' in live
    assert "Unsaved scratch notes" in live
    assert 'localStorage' not in live and 'sessionStorage' not in live


def test_ink_changes_not_physical_scene_and_accessibility_remains():
    live, css = text(LIVE), text(CSS)
    assert 'preloadInkMasks' in live and 'useLayoutEffect' in live
    assert 'cancelAnimationFrame' in live
    assert 'prefers-reduced-motion' in live
    assert 'setInk(0)' in live
    assert 'const image = inkURL' in live
    assert 'className="vb-scene"' in live
    assert 'className="reader-ink"' in live
    assert '.adventure-layout--reader-hidden' in css
    assert 'aria-label="Current adventure manuscript"' in live
    assert 'aria-label="Current turn choices"' in live
    assert 'aria-label="Turn manuscript pages"' in live
    assert '<select' not in live and 'window.confirm' not in live
    assert '<textarea' in live


def test_old_lab_and_protected_game_route_remain():
    router = text(ROOT / "frontend/src/router.tsx")
    visual = text(ROOT / "frontend/src/pages/game/VisualBookPlaygroundPage.tsx")
    assert 'path: "game/inkspace-reader"' in router
    assert 'path: "adventure/:roomId"' in router
    assert 'readerLab ? <InkspaceReaderLab />' in visual
    assert 'src="/art/pass64/pass64-4d-tabletop-book.webp"' in visual
