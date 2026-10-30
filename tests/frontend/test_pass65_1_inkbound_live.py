"""Pass 65.1 contracts: real server-fed Inkbound reader with plain opacity fades."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
GAME=ROOT/'frontend/src/pages/game'


def source(file): return (GAME/file).read_text()


def test_live_inkbound_reader_is_opt_in_and_does_not_open_another_socket():
    parent,live=source('AdventurePage.tsx'),source('InkboundLiveRoom.tsx')
    assert 'searchParams.get("reader") === "inkbound"' in parent
    assert '<InkboundLiveRoom' in parent
    for fragment in ['onSelectChoice={selectChoice}','onLockChoice={lockChoice}',
                     'history={turnHistory}', 'party={live.room?.players ?? []}',
                     'messages={live.messages}', 'onToggleStoryTime={toggleStoryTime}',
                     'notes={fieldNotes}', 'onNotesChange={setFieldNotes}']:
        assert fragment in parent,fragment
    for forbidden in ('import { useGameSocket','import { useLiveAdventure','new WebSocket','socket.emit','fetch('):
        assert forbidden not in live
    assert 'live.submitChoice(selectedChoiceId)' in parent
    assert 'live.sendChat(message)' in parent
    assert 'window.confirm(' not in live


def test_no_stale_story_reveal_or_synthetic_authoritative_results():
    parent,live=source('AdventurePage.tsx'),source('InkboundLiveRoom.tsx')
    assert 'chapterReleased={theater.chapterReleased' in parent
    assert 'props.chapterReleased ?' in live
    assert 'Only the server decides the outcome.' in live
    assert 'props.scene.choices.map' in live
    assert 'choice.id' in live
    assert 'props.hero?.health' not in live or 'props.hero.health' in live


def test_live_controls_reuse_real_data_instead_of_demo_labels():
    live=source('InkboundLiveRoom.tsx')
    for required in ('props.hero.health','props.hero.max_health','props.hero.experience',
                     'props.party.map', 'props.history',
                     'props.messages', 'props.onSendChat(text)',
                     'props.onSelectChoice(choice)', 'props.onLockChoice',
                     'maxLength={500}', 'props.onNotesChange',
                     'props.onToggleStoryTime', 'role="dialog"'):
        assert required in live, required

    # Pass 66.20 renders the live server-owned effect list through the
    # shared HeroEffectList component, rather than inline effect markup.
    # Keep this contract strict about real Hero data, not demo labels.
    assert 'import { HeroEffectList }' in live
    assert '<HeroEffectList effects={props.hero?.effects}' in live
    effects_component = (ROOT/'frontend/src/features/adventure/HeroEffectList.tsx').read_text()
    assert 'activeHeroEffects(effects)' in effects_component




def test_active_reader_uses_plain_opacity_fades_not_mask_swaps():
    live = source('InkboundLiveRoom.tsx')
    css = source('inkboundFoundation.css')
    for retired in ('preloadInkMasks', 'clearInkMask', 'USE_INK_MASKS_IN_LIVE_READER'):
        assert retired not in live, retired
    assert 'inkbound-opacity-in' in css
    assert '.inkbound-fade' in css
    assert '@media(prefers-reduced-motion:reduce)' in css


def test_new_art_not_clipped_and_not_extracted_from_reference_screenshots():
    script=(ROOT/'scripts/build-inkbound-art.py').read_text()
    assert 'assert bbox[0]>=.09*ww' in script
    assert "assert edge.getextrema()==(0,0)" in script
    assert 'Image.open' in script  # only to read our own rasterized svg
    assert 'Image.open(source' not in script
    assert 'edge_alpha' not in script
    for art in ('north-road.png','hero-vista.png','signpost.png','lantern-books.png','camp-cups.png'):
        assert (ROOT/'frontend/public/art/inkbound'/art).is_file()
