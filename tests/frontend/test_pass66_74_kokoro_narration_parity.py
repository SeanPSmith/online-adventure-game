"""Pass 66.74: every Kokoro/Story Time narration control that existed in the Classic reader lives in Quillairo."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "frontend/src/pages/game"
PAGE = (GAME / "AdventurePage.tsx").read_text(encoding="utf-8")
ROOM = (GAME / "InkboundLiveRoom.tsx").read_text(encoding="utf-8")
CSS = (GAME / "inkscapeFolioChoicesPass6669.css").read_text(encoding="utf-8")


def test_every_narration_control_is_in_the_quillairo_menu():
    for control in ("Story Time", "<NarratorVoicePicker", "Your voice ·", "Reading speed ·", "Dramatic pacing ·",
                    "Follow voice ·", "Read this chapter aloud", "Read choices aloud",
                    "Pause narration", "Resume narration", "Stop narration",
                    "Voice performance · this browser", "Reset counters"):
        assert control in PAGE, control
    # Live narration status (previously only in Classic).
    for status in ("Preparing voice ·", "Buffering next passage ·", "Reading ·", "Narration paused"):
        assert status in PAGE, status
    assert "const [followVoice, setFollowVoice] = useState(true);" in PAGE
    assert "observeNarrationDiagnostics(setSpeechDiagnostics)" in PAGE and "resetNarrationDiagnostics" in PAGE
    assert "followNarration={audioPreferences.narrationEnabled && followVoice" in PAGE


def test_one_choice_can_be_listened_to_without_selecting_it():
    assert "onListenChoice=" in PAGE and "canListenChoice=" in PAGE
    assert 'label: `CHOICE ${index + 1}`, kind: "choice"' in PAGE
    for guard in ("audioPreferences.narrationEnabled", "narratorAvailable === true", "theater.chapterReleased",
                  "!live.game?.pending_micro_event", "!choiceLocked", "!showDeath"):
        assert guard in PAGE.split("canListenChoice=")[1].split("\n")[0], guard
    assert 'aria-label={`Read choice ${index + 1} aloud`}' in ROOM
    # The Listen control is a sibling of the choice button, never nested inside it (invalid, inaccessible HTML).
    card = ROOM[ROOM.index('<div className="ibl-choice-cell"'):ROOM.index("</div>;\n            })}")]
    assert card.index("</button>") < card.index("ibl-choice-listen")
    assert card.count("<button") == 2
    assert ".ibl-choice-listen" in CSS and ":focus-visible" in CSS
