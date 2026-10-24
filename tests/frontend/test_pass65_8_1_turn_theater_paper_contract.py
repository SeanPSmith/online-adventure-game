"""Pass 65.8.1: keep Inkbound theater's TypeScript prop contract in sync.

Dependency-free regression for the exact mismatch that blocked the 65.8 build.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
THEATER = ROOT / "frontend/src/features/adventure/TurnTheater.tsx"
PAGE = ROOT / "frontend/src/pages/game/AdventurePage.tsx"


def test_turn_theater_declares_ink_paper_and_applies_theme():
    theater = THEATER.read_text(encoding="utf-8")
    page = PAGE.read_text(encoding="utf-8")

    assert 'inkPaper={inkspacePaper}' in page
    assert 'const inkspacePaper = (inkboundRequested || defaultInkbound)' in page
    assert 'import type { InkPaper } from "../appearance/inkboundPaper";' in theater
    assert '  inkPaper,\n  theater,' in theater
    assert '  inkPaper?: InkPaper;' in theater
    # Check the real JSX overlay roots instead of an exact count of theme
    # attributes. Pass 66.3 introduced a fourth, dedicated Inkbound waiting
    # branch; every current and future overlay must preserve theme inheritance.
    overlays = re.findall(r'<div\s+className=\{`turn-theater-overlay[^>]*>', theater)
    assert len(overlays) >= 4
    assert all('data-ink-paper={inkPaper}' in root for root in overlays)
    assert all('inkbound-turn-theater' in root for root in overlays)
    assert any('ibw-overlay' in root for root in overlays)
    assert '<InkboundWaitingFolio paper={inkPaper}' in theater
    assert '<TurnResolutionTheater' in theater
    assert '<IntermissionRuntime' in theater
