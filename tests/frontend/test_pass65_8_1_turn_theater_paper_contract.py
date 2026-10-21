"""Pass 65.8.1: keep Inkbound theater's TypeScript prop contract in sync.

Dependency-free regression for the exact mismatch that blocked the 65.8 build.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THEATER = ROOT / "frontend/src/features/adventure/TurnTheater.tsx"
PAGE = ROOT / "frontend/src/pages/game/AdventurePage.tsx"


def test_turn_theater_declares_ink_paper_and_applies_theme():
    theater = THEATER.read_text(encoding="utf-8")
    page = PAGE.read_text(encoding="utf-8")

    assert 'inkPaper={inkboundReady ? inkPaper : undefined}' in page
    assert 'import type { InkPaper } from "../appearance/inkboundPaper";' in theater
    assert '  inkPaper,\n  theater,' in theater
    assert '  inkPaper?: InkPaper;' in theater
    assert theater.count('data-ink-paper={inkPaper}') == 3
    assert theater.count('inkPaper ? "inkbound-turn-theater" : ""') == 3
    assert '<TurnResolutionTheater' in theater
    assert '<IntermissionRuntime' in theater
