"""Pass 65.5.1: paper is intentional negative space, not a caption canvas.

Uses only the standard library; visual changes remain confined to the workshop.
"""
from pathlib import Path

BASE = Path(__file__).resolve().parents[2] / 'frontend/src/pages/game'


def test_dashboard_does_not_overlay_figures_on_controls_or_copy():
    page = (BASE / 'InkboundJourneyGallery.tsx').read_text()
    sheet = (BASE / 'inkboundSketchbook.css').read_text()
    assert 'i654-plate-note' not in page
    assert 'i654-plate-note' not in sheet
    assert 'The road beyond the vale' not in page
    assert '<div className="i654-dashboard-letter">' in page
    assert 'Enter the adventure hall' in page
    assert 'Your heroes' in page
    assert '.i653-dashboard-lead>img' in sheet
    assert 'mask-image:' not in sheet and 'clip-path:' not in sheet


def test_original_inkbound_gameplay_routes_untouched():
    page = (BASE / 'InkboundJourneyGallery.tsx').read_text()
    assert 'useGameSocket()' in page
    assert 'listCharacters()' in page
    assert 'InkboundOutcomePreview' in page
