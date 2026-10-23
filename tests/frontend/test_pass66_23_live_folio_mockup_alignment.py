"""Pass 66.23: mockup-inspired composition using real gameplay data."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PAGES=ROOT/'frontend/src/pages/game'
CSS=ROOT/'frontend/src/styles/quillairoLiveFolioPass6623.css'

def test_chronicle_sharing_contract_is_restored():
    history=(PAGES/'HistoryPage.tsx').read_text()
    assert 'label="SHARE CHRONICLE"' in history
    assert '<ShareMomentButton' in history
    assert 'story.history_id' in history
    assert 'ArchivedChronicleAudio' in history

def test_mockup_is_live_ui_not_fake_scene_data():
    live=(PAGES/'InkboundLiveRoom.tsx').read_text()
    parent=(PAGES/'AdventurePage.tsx').read_text()
    for fragment in ('props.scene.choices.map','props.onSelectChoice(choice)',
                     'props.onLockChoice', 'props.hero?.effects','props.messages',
                     'props.onSendChat(text)','props.chapterReleased ?'):
        assert fragment in live,fragment
    for fragment in ('chapterReleased={theater.chapterReleased','onLockChoice={lockChoice}',
                     'onSelectChoice={selectChoice}','onSceneArtError={onSceneArtError}'):
        assert fragment in parent,fragment

def test_reader_composition_and_themes_are_scoped():
    css=CSS.read_text()
    main=(ROOT/'frontend/src/main.tsx').read_text()
    assert 'import "./styles/quillairoLiveFolioPass6623.css";' in main
    assert 'grid-column:2!important;' in css
    assert 'grid-column:1!important;' in css
    assert 'overflow-y:auto!important;' in css
    assert 'grid-template-columns:repeat(3,minmax(0,1fr))!important' in css
    assert '@media (max-width:900px)' in css
    assert 'prefers-reduced-motion:reduce' in css
    assert '[data-ink-paper="midnight"]' in css
    assert '[data-ink-paper="phosphor"]' in css
    assert ':focus-visible' in css
    for forbidden in (':root','.arcade-','.turn-theater-overlay'):
        assert forbidden not in css
