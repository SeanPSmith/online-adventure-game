"""Prevent another release from importing a CSS file omitted by an incremental ZIP.

Run by the existing Python regression suite. These checks operate on the real
installed React tree, *not* the list of files claimed by a previous ZIP.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "frontend" / "src"
CSS = SOURCE / "pages" / "game" / "inkboundAdventurePass657.css"

# Statically imported stylesheets used by Vite. Covers both side-effect imports
#   import "./style.css"
# and import-from syntax; does not follow packages or external CSS URLs.
STATIC_CSS_IMPORT = re.compile(
    r"\b(?:import\s+(?:[^\n;]*?\s+from\s+)?|from\s+|import\s*\(\s*)"
    r"[\"'](\.{1,2}/[^\"']+\.css)[\"']"
)


def test_every_local_react_stylesheet_import_resolves():
    missing = []
    examined = 0
    for source in sorted(SOURCE.rglob("*")):
        if source.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        for match in STATIC_CSS_IMPORT.finditer(source.read_text(encoding="utf-8")):
            examined += 1
            imported = match.group(1)
            destination = (source.parent / imported).resolve()
            if not destination.is_file():
                missing.append(f"{source.relative_to(ROOT)} imports {imported}")
    assert examined > 0, "No local CSS imports examined; check regression scanner"
    assert not missing, "Missing React stylesheet(s):\n" + "\n".join(missing)


def test_pass657_styling_is_present_for_all_six_papers_and_turn_theater():
    assert CSS.is_file(), "Missing original Pass 65.7 Inkbound reader stylesheet"
    sheet = CSS.read_text(encoding="utf-8")
    assert len(sheet) > 15000, "Stylesheet must not be replaced with an empty placeholder"
    for theme in ("chalk", "ivory", "cream", "navy", "phosphor", "midnight"):
        assert f'.inkbound-live[data-ink-paper="{theme}"]' in sheet
        assert f'.inkbound-turn-theater[data-ink-paper="{theme}"]' in sheet
    for surface in (".ibl-chapter", ".ibl-choices", ".ibl-drawer", ".turn-resolution-theater", ".intermission-runtime"):
        assert surface in sheet, f"Lost essential presentation contract: {surface}"
