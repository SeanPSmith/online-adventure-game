"""Regression cases for pass 66.52r1 compatibility after 66.52 preflight refusal."""
from pathlib import Path
import importlib.util
import sys

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/pass66_52_apply.py'
spec = importlib.util.spec_from_file_location('pass66_52_apply', SCRIPT)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

SAMPLE = '''import { useEffect } from "react";
export function MyAdventuresPage() {
 const a = 1;
 return <>
  <PageTitle eyebrow="YOUR STORY LIBRARY" title="MY ADVENTURES"/>
  <Panel title="YOUR JOURNEYS">{rows.map(row=><article className="history-card" key={row.room_code}>{row.director_retry_required ? "RECOVER" : "CONTINUE"}</article>)}</Panel>
 </>;
}
// apiFetch<Library> ShareMomentButton ArchivedChronicleAudio
'''

def check(src):
    out = mod.update(mod.JOURNEYS, src)
    assert 'import "./inkscapeArchivePass6652.css";' in out
    assert mod.update(mod.JOURNEYS, out) == out
    assert 'row.director_retry_required ? "RECOVER" : "CONTINUE"' in out
    # Apart from the stylesheet import and editorial title copy, the TSX is unchanged.
    assert out.replace('import "./inkscapeArchivePass6652.css";', '').count('return <>') == src.count('return <>')
    return out

def test_old_fragment():
    check(SAMPLE)

def test_formatted_parenthesized_fragment():
    check(SAMPLE.replace('return <>', 'return (\n    <>').replace(' </>;', ' </>\n );'))

def test_preexisting_static_div():
    check(SAMPLE.replace('return <>', 'return <div className="existing" id="archive">').replace(' </>;', ' </div>;'))

def test_unfamiliar_return_is_preserved():
    out = check(SAMPLE.replace('return <>', 'return <GameScreen>').replace(' </>;', ' </GameScreen>;'))
    assert 'return <GameScreen>' in out

def test_missing_action_refuses():
    import pytest
    with pytest.raises(mod.SourceMismatch):
        mod.update(mod.JOURNEYS, SAMPLE.replace('row.director_retry_required', 'row.other'))
