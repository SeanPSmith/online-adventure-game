"""Pass 66.47 Inkscape shared foundation acceptance, no new dependencies."""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "frontend/src/styles/inkboundSystemPass660.css"
SCRIPT = ROOT / "scripts/pass66_47_apply.py"

def text(): return CSS.read_text(encoding="utf-8")

def test_shared_foundation_exists_and_is_idempotent():
    content=text()
    assert "PASS 66.47 / INKSCAPE FOUNDATION" in content
    assert content.count("/* PASS 66.47 / INKSCAPE FOUNDATION") == 1
    assert "--ix-paper: var(--ib-paper)" in content
    assert "--ix-gold:" in content
    assert "--ix-ui-font" in content
    import importlib.util
    spec=importlib.util.spec_from_file_location('pass66_47_apply',SCRIPT)
    assert spec and spec.loader
    plugin=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(plugin)
    assert plugin.update(content) == content

def test_every_paper_edition_gets_inkspace_theme():
    content=text()
    for paper in ('ivory','cream','parchment','navy','midnight','phosphor'):
        assert f'[data-ink-paper="{paper}"]' in content
    assert 'var(--ix-action)' in content

def test_gameplay_and_old_reader_scoped_out():
    content=text()
    guarded=content.split('/* PASS 66.47 / INKSCAPE FOUNDATION',1)[1].split('/* END PASS 66.47 / INKSCAPE FOUNDATION */',1)[0]
    assert '.game-site-shell:not(.is-adventure-mode):not(.is-desk-home)' in guarded
    assert '.intermission-game-feedback-host' not in guarded
    assert '.inkbound-live' not in guarded
    assert '.inkbound-turn-theater' not in guarded
    assert 'useTurnTheater' not in guarded

def test_shared_stylesheet_is_already_loaded_before_later_feature_css():
    main=(ROOT/'frontend/src/main.tsx').read_text()
    assert '"./styles/inkboundSystemPass660.css"' in main
    assert main.index('inkboundSystemPass660.css') < main.index('inkboundLegibilityPass661.css')

def test_css_brackets_balanced():
    source=text()
    stripped=re.sub(r'/\*.*?\*/','',source,flags=re.S)
    depth=0
    for c in stripped:
        if c == '{': depth+=1
        if c == '}':
            depth-=1
            assert depth>=0
    assert depth == 0
