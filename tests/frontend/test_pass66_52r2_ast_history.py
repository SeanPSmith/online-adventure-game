"""66.52 R3: no TSX parsing/rewriting; semantic CSS scope."""
from pathlib import Path
import importlib.util
import sys
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pass66_52_r3', ROOT/'scripts/pass66_52_apply.py')
mod=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=mod
spec.loader.exec_module(mod)

SOURCE = 'import {useState} from \'react\';\nexport function HistoryPage() {\n const [story,setStory]=useState(null);\n return <main className="unmodified-root"><section><PageTitle title="SEALED CHRONICLES" eyebrow="ARCHIVE" /></section><Panel><div className="history-grid"><article className="history-card"><ArchivedChronicleAudio/><ShareMomentButton/></article></div></Panel></main>;\n}\n// listCharacterStories( listCharacters()\n'

def test_history_unfamiliar_root_is_safe():
    updated=mod.update(mod.CHRONICLES,SOURCE)
    assert 'return <main className="unmodified-root">' in updated
    assert 'ix52-archive' not in updated
    assert 'import "./inkscapeArchivePass6652.css";' in updated
    assert updated.count('return <main')==1
    assert mod.update(mod.CHRONICLES,updated)==updated

def test_history_fragment_and_nested_handlers_preserved():
    source=SOURCE.replace('return <main className="unmodified-root">','return <>').replace('</main>;','</>;')
    out=mod.update(mod.CHRONICLES,source)
    assert 'return <>' in out and '</>;' in out
    assert 'className="ix52-archive' not in out

def test_user_source_without_valid_ts_runtime_still_patches():
    source=SOURCE.replace('return <main','return (<main').replace('</main>;','</main>);')
    out=mod.update(mod.CHRONICLES,source)
    assert 'return (<main' in out

def test_css_scoping_existing_archive_classes():
    css=(ROOT/mod.CSS_FILE).read_text()
    assert '.game-main:has(.history-grid)' in css
    assert '.game-main:has(.history-grid) .page-title' in css
    assert '.game-main:has(.history-grid) .panel:has(.history-grid)' in css
    assert '.history-card .chronicle-audio' in css
    assert 'inkbound-turn-theater' not in css

def test_css_hash_matches_overlay():
    import hashlib
    assert hashlib.sha256((ROOT/mod.CSS_FILE).read_bytes()).hexdigest()==mod.CSS_SHA
