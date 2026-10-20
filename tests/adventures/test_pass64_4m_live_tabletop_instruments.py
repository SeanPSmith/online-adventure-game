"""Pass 64.4M — opt-in real data HUD without a second authoritative game path.

Both floating and attached journals stay UI-only, while the original player
choice, socket, room lifecycle, intermission, and dice mechanics remain in
AdventurePage/useLiveAdventure.
"""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "frontend/src/pages/game"

def code(name: str) -> str:
    return (GAME / name).read_text(encoding="utf-8")


def test_default_floating_tools_still_keep_attached_journal_fallback():
    live = code("InkspaceLiveRoom.tsx")
    assert 'useState<"floating" | "attached">("floating")' in live
    assert '<LiveTabletopInstruments' in live
    assert 'journalStyle === "floating"' in live
    assert 'journalStyle === "attached"' in live
    assert '<LiveJournal key={journal}' in live
    assert 'reader-journal-style' in live
    assert 'className="vb-scene"' in live
    assert 'className="reader-ink"' in live


def test_instruments_only_consume_authorized_props_and_send_once():
    src = code("LiveTabletopInstruments.tsx")
    for required in ("hero.health", "hero.max_health", "hero.experience", "hero.is_alive",
                     "Object.entries(hero.stats)", "msg.player_name", "msg.text",
                     'onSendChat(text)', 'maxLength={500}', "if (!text || !connected) return",
                     'disabled={!connected', 'messages.map', 'aria-live="polite"'):
        assert required in src
    assert src.count('onSendChat(text)') == 1
    for forbidden in ('useGameSocket', 'useLiveAdventure', 'WebSocket(', 'fetch(',
                      'sessionStorage', 'localStorage', 'window.confirm', '<select',
                      'Kael of the Green Road', 'Level 12'):
        assert forbidden not in src


def test_parent_owns_transient_notes_and_existing_gameplay():
    parent, live = code("AdventurePage.tsx"), code("InkspaceLiveRoom.tsx")
    assert 'const [bookNotes, setBookNotes] = useState("")' in parent
    assert 'notes={bookNotes}' in parent and 'onNotesChange={setBookNotes}' in parent
    assert 'notes={props.notes} onNotesChange={props.onNotesChange}' in live
    assert 'live.submitChoice(selectedChoiceId)' in parent
    assert 'onLockChoice={lockChoice}' in parent
    assert 'onSelectChoice={selectChoice}' in parent
    assert 'onSendChat={(message) => { if (connected && live.status === "ready") live.sendChat(message); }}' in parent
    assert 'theater.phase === "none"' in parent
    assert 'adventure-layout--reader-hidden' in parent
    assert 'preloadInkMasks' in live and 'useLayoutEffect' in live


def test_accessible_floating_controls_and_behavior():
    src = code("LiveTabletopInstruments.tsx")
    for expected in ('role="dialog"', 'aria-modal="false"', 'aria-labelledby=',
                     'aria-pressed=', 'aria-controls=', 'aria-expanded=',
                     'aria-label=', 'event.key === "Escape"', 'heading.current?.focus()',
                     'requestAnimationFrame', 'aria-valuemax=', 'role="meter"',
                     'onNotesChange(event.target.value)', 'Temporary notes'):
        assert expected in src
    assert 'className={`tti-instrument' in src
    assert 'aria-live="polite"' in src
    assert 'aria-hidden="true"' in src


def test_mobile_and_motion_safety_no_book_movement():
    css = code("liveTabletopInstruments.css")
    src = code("LiveTabletopInstruments.tsx")
    assert '@media(max-width:860px)' in css
    assert '@media(prefers-reduced-motion:reduce)' in css
    assert '.reader-stage' in css
    assert 'position:fixed' not in css.split('@media(max-width:860px)')[0]  # no new fixed desktop stages
    assert 'background:linear-gradient' in css
    assert 'data-tti-mode="floating-live"' in src
    assert 'src=' not in src  # no new fake printed/interactive art assets


def test_no_extra_route_and_legacy_demo_is_left_alone():
    router = (ROOT / 'frontend/src/router.tsx').read_text(encoding='utf-8')
    assert 'path: "game/tabletop-kit"' in router
    assert 'path: "adventure/:roomId"' in router
    demo = code('TabletopInstruments.tsx')
    assert 'LOCAL CORRESPONDENCE PREVIEW' in demo
    assert 'No Hero stats or progression are changed' in demo
