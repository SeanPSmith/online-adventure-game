"""Pass 66.73: Quillairo (Inkbound) is the only reader. Classic is gone; loading/restore has its own panel."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
GAME = SRC / "pages/game"
PAGE = (GAME / "AdventurePage.tsx").read_text(encoding="utf-8")


def test_no_classic_entry_points_remain_anywhere():
    for path in SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for retired in ("Switch to Classic view", "USE CLASSIC READER", "onClassicView",
                        'set("reader", "classic")', 'reader !== "classic"', "adventure-layout"):
            assert retired not in text, (path.name, retired)
    assert not (GAME / "adventureReaderSwitchPass6668.css").exists()
    assert not (SRC / "features/adventure/ChoiceInspector.tsx").exists()
    assert "scene-art" not in PAGE and "story-pane" not in PAGE and "adventure-command-strip" not in PAGE


def test_every_non_reader_state_uses_the_quillairo_restore_panel_with_a_way_out():
    assert "!inkboundReady && !inkboundLobbyReady && <main className=\"ink-restore\"" in PAGE
    for label in ("Finding your place in the Chronicle.", "The thread was interrupted.",
                  "The next page is being prepared.", "Reconnect", "Return to the Adventure Hall", "My adventures"):
        assert label in PAGE, label
    assert "onClick={live.restore}" in PAGE and "live.clearError" in PAGE
    # Completed rooms and the finale are still reachable when no scene is present.
    assert "completedRoomRecovery ??" in PAGE
    css = (GAME / "adventureRestorePass6673.css").read_text(encoding="utf-8")
    assert ".ink-restore-card" in css and ":focus-visible" in css and "min-height:44px" in css
    assert 'import "./adventureRestorePass6673.css";' in PAGE


def test_reader_and_lobby_are_unconditional_and_gameplay_wiring_is_intact():
    assert "const inkboundReady = Boolean(live.status === \"ready\" && live.game?.started && scene);" in PAGE
    assert "const inkboundLobbyReady = Boolean(live.status === \"ready\" && live.game && !live.game.started);" in PAGE
    for contract in ("<InkboundLiveRoom", "<InkboundLobby", "useTurnTheater(", "<TurnTheater",
                     "live.submitChoice(selectedChoiceId)", "live.sendChat(message)", "live.startAdventure",
                     "live.requestWrapUp", "onSync={live.sync}", "confirmSoloStart"):
        assert contract in PAGE, contract


def test_layout_keeps_the_quillairo_shell_for_every_adventure_url():
    layout = (SRC / "layouts/GameLayout.tsx").read_text(encoding="utf-8")
    assert "const isInkspaceAdventure = isAdventureMode;" in layout
    assert "classic" not in layout
