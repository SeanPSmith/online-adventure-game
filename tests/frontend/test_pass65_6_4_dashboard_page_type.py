"""Pass 65.6.4: dashboard navigation must have a declared TS page type.

Prevent reintroducing the missing Page alias that broke 65.6.3's tsc build.
This contract intentionally uses only the Python standard library.
"""
import re
from pathlib import Path

DASHBOARD = (Path(__file__).resolve().parents[2] /
             "frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx")


def test_inkbound_navigation_has_complete_page_union():
    source = DASHBOARD.read_text(encoding="utf-8")
    match = re.search(r'(?m)^type Page\s*=\s*([^;]+);', source)
    assert match, "Dashboard Page union must be declared before useState<Page>"
    declared = set(re.findall(r'"([a-z]+)"', match.group(1)))
    expected = {"home", "worlds", "heroes", "journeys", "join"}
    assert declared == expected
    assert 'useState<Page>("home")' in source
    nav = re.search(r'const navigation:\s*\{\s*id:\s*Page;\s*label:\s*string\s*\}\[\]\s*=\s*\[(.*?)\];', source, re.S)
    assert nav, "Navigation must remain strongly typed"
    assert set(re.findall(r'id:\s*"([a-z]+)"', nav.group(1))) == declared


def test_dashboard_preserves_custom_control_and_real_callbacks():
    source = DASHBOARD.read_text(encoding="utf-8")
    assert "<TerminalSelect" in source
    assert "<select" not in source
    assert "onCreate(selectedStory,mode)" in source
    assert "onJoin(roomCode.trim().toUpperCase())" in source
    assert 'useInkboundPaper(userId)' in source
