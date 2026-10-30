"""Pass 65.7: authoritative gameplay is displayed on real themed manuscript surfaces."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / "frontend/src/pages/game"
FEATS = ROOT / "frontend/src/features"


def load(path):
    return path.read_text(encoding="utf-8")


def test_inkbound_is_the_default_only_after_adventure_begins():
    page = load(PAGES / "AdventurePage.tsx")
    assert 'const classicRequested = searchParams.get("reader") === "classic"' in page
    assert 'const defaultInkbound = !classicRequested' in page
    assert 'bookRequested' not in page and 'bookReady' not in page
    assert '(inkboundRequested || defaultInkbound)' in page
    assert 'live.game?.started && scene' in page
    assert 'next.set("reader", "classic")' in page
    assert 'searchParams.get("reader") === "book"' not in page  # retired Living Book preview
    # Lobby and turn authority stay in the original parent, never the visual layer.
    assert 'live.startAdventure' in page
    assert 'live.submitChoice(selectedChoiceId)' in page
    assert 'live.submitMicroEventChoice' in page
    assert 'onSubmitIntermissionScore={live.submitIntermissionScore}' in page


def test_real_room_data_not_synthetic_result_states():
    page = load(PAGES / "AdventurePage.tsx")
    live = load(PAGES / "InkboundLiveRoom.tsx")
    for required in (
        'chapterReleased={theater.chapterReleased',
        'onSelectChoice={selectChoice}', 'onLockChoice={lockChoice}',
        'onSendChat={(message)', 'history={turnHistory}',
        'messages={live.messages}', 'party={live.room?.players ?? []}',
        'onToggleStoryTime={toggleStoryTime}',
        'paper={inkPaper}', 'onClose={() =>',
    ):
        assert required in page, required
    for forbidden in ('import { useGameSocket', 'import { useLiveAdventure', 'Math.random', 'fetch(', 'window.confirm(', '<select'):
        assert forbidden not in live
    assert 'props.scene.choices.map' in live
    assert 'props.onLockChoice' in live
    assert 'Only the server decides the outcome' in live


def test_six_ink_papers_apply_to_reader_results_intermission_and_sibling_dialogs():
    css = load(PAGES / "inkboundAdventurePass657.css")
    turn = load(FEATS / "adventure/TurnTheater.tsx")
    for paper in ('parchment', 'ivory', 'cream', 'navy', 'phosphor', 'midnight'):
        assert f'.inkbound-live[data-ink-paper="{paper}"]' in css
        assert f'.inkbound-turn-theater[data-ink-paper="{paper}"]' in css
        assert f'.game-site-shell:has(.inkbound-live[data-ink-paper="{paper}"])' in css
    for selector in ('.ibl-prose', '.ibl-choices', '.ibl-sidebar', '.ibl-drawer',
                     '.turn-resolution-theater', '.intermission-runtime',
                     '.qte-modal', '.hero-death-window', '.level-up-modal'):
        assert selector in css, selector
    assert 'data-ink-paper={inkPaper}' in turn
    assert 'inkPaper?: InkPaper' in turn
    assert 'TurnResolutionTheater' in turn
    assert 'IntermissionRuntime' in turn


def test_art_and_readability_are_independent_of_page_geometry():
    css = load(PAGES / "inkboundAdventurePass657.css")
    live = load(PAGES / "InkboundLiveRoom.tsx")
    assert 'illustrationSrc?: string' in live
    assert '<figure className="ibl-chapter-illustration"' in live
    assert 'data-ink-paper={props.paper}' in live
    assert 'max-height:' in css
    assert 'overflow:visible' in css
    assert 'rgba(0,0,0,.78)' in css  # dialog backdrop, not image matte
    assert 'mask-image:' not in css
    assert 'radial-gradient' not in css
    assert 'feather' not in css.lower().replace('no radial image masks, blurred rectangles or decorative absolute captions.', '')
    assert 'prefers-reduced-motion:reduce' in css
