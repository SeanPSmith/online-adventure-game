from tests.support import PROJECT_ROOT
from pathlib import Path

ROOT = PROJECT_ROOT


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_semantic_color_tokens_separate_structure_from_live_state() -> None:
    tokens = read("frontend/src/styles/tokens.css")

    assert "--blue: #68b8d8" in tokens
    assert "--structure: var(--blue)" in tokens
    assert "--structure-line: var(--blue-line)" in tokens
    assert "--live: var(--green)" in tokens
    assert "--border: 1px solid var(--structure-line)" in tokens
    assert "--border-strong: 2px solid var(--structure-line)" in tokens


def test_structural_headers_use_blue_while_actions_remain_green() -> None:
    layout = read("frontend/src/styles/layout.css")
    components = read("frontend/src/styles/components.css")
    global_css = read("frontend/src/styles/global.css")

    assert "PASS 35 // VISUAL HIERARCHY / STRUCTURAL BLUE LAYER" in layout
    assert ".page-title" in layout and "var(--structure-line)" in layout
    assert ".scene-meta" in layout and "var(--structure-panel-strong)" in layout
    assert ".home-terminal-bar" in layout and "var(--structure-dim)" in layout

    assert "PASS 35 // VISUAL HIERARCHY / COLOR ROLE NORMALIZATION" in components
    assert ".panel-heading" in components
    assert "color: var(--structure-soft)" in components
    assert ".button-primary" in components
    assert "border-color: var(--green)" in components
    assert ".hero-skill-family > header" in components

    assert "h1," in global_css
    assert "color: var(--structure-soft)" in global_css
    assert "strong {" in global_css
    assert "color: var(--green-soft)" in global_css


def test_master_document_records_green_means_alive_rule() -> None:
    master = read("docs/PROJECT_MASTER.md")

    assert "### Semantic color hierarchy" in master
    assert "green should mean alive" in master
    assert "Pass 35 — Visual Hierarchy / Semantic Color System" in master
