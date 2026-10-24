"""Pass 66.25: reuse the existing live Arcade + manuscript handoff.

Dependency-free contracts. The authoritative story turn and game controls must
remain the only owners of resolution, scoring, retry, and countdown.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend/src"
WAIT = (FRONT / "features/adventure/InkboundWaitingFolio.tsx").read_text()
RUNTIME = (FRONT / "features/adventure/IntermissionRuntime.tsx").read_text()
THEATER = (FRONT / "features/adventure/TurnTheater.tsx").read_text()
CSS = (FRONT / "styles/quillairoIntermissionPass6625.css").read_text()
MAIN = (FRONT / "main.tsx").read_text()


def test_waiting_and_arcade_use_one_real_progress_component():
    assert "export function StoryTurnProgress(" in WAIT
    assert "<StoryTurnProgress storyReady={ready} />" in WAIT
    assert "<StoryTurnProgress storyReady={storyReady} compact />" in RUNTIME
    assert "import { InkboundWaitingFolio, StoryTurnProgress" in RUNTIME
    assert "aria-current={!storyReady ? \"step\" : undefined}" in WAIT
    assert "aria-current={storyReady ? \"step\" : undefined}" in WAIT
    assert WAIT.count("Writing the passage") == 1
    assert WAIT.count("Revealing the result") == 1
    assert "TIME WRITING · NOT AN ESTIMATED ARRIVAL" in WAIT


def test_arcade_remains_real_and_not_replaced_by_decorative_game():
    for fragment in ("liveArcadeGameForServerSlot(payload.game_id)",
                     "const ArcadeGame = arcadeGame.component", "<ArcadeGame",
                     "<IntermissionGameBoundary", "<ArcadeFeedback",
                     "scoreRef.current", "onSubmitScore(", "submitFinalScore();",
                     "onStoryReadyComplete();", "matchingResult(",
                     "storyReadySeconds > 0", "mode === \"waiting\""):
        assert fragment in RUNTIME, fragment
    assert 'inkPaper ? "is-inkbound-arcade" : ""' in RUNTIME
    assert 'inkPaper ? <StoryTurnProgress' in RUNTIME
    assert "Math.random(" not in RUNTIME
    assert "Math.random(" not in WAIT
    assert "onStoryReadyComplete={theater.finishIntermissionStoryReady}" in THEATER
    assert "onSubmitScore={onSubmitIntermissionScore}" in THEATER


def test_classic_game_remains_unskinned_and_paper_theme_inherited():
    assert '"DIRECTOR WORKING // SOLO INTERMISSION"' in RUNTIME
    assert '"SKIP GAME // WATCH THE STORY MACHINE INSTEAD"' in RUNTIME
    assert "is-inkbound-arcade" in CSS
    assert "var(--ia-paper)" in CSS and "var(--ia-text)" in CSS
    assert "var(--q24-gold" in CSS  # the preceding receipt already owns theme editions
    assert ":focus-visible" in CSS
    assert "prefers-reduced-motion:reduce" in CSS
    assert "@media(max-width:760px)" in CSS
    assert "@media(max-width:480px)" in CSS
    # Every rule must be scoped to the live, paper-themed Arcade container.
    rules = re.findall(r"([^{}]+)\{[^{}]*\}", re.sub(r"/\*.*?\*/", "", CSS, flags=re.S))
    for selector in rules:
        selector = selector.strip()
        if selector.startswith("@"):
            continue
        assert "inkbound-turn-theater" in selector or selector.startswith(".inkbound-turn-theater"), selector
    # Arcade games manage their own contrast, size, interactions and touch targets.
    assert not re.search(r"\.intermission-game-feedback-host\s*\{", CSS)
    assert not re.search(r"\.intermission-game-feedback-host\s+\*", CSS)
    assert not re.search(r"\.arcade-[\w-]+\s*\{", CSS)
    assert "mask-image" not in CSS
    assert "radial-gradient(" not in CSS


def test_overlay_loads_last_without_overwriting_turn_theater():
    assert 'import "./styles/quillairoIntermissionPass6625.css";' in MAIN
    assert MAIN.index("quillairoTurnReceiptPass6624.css") < MAIN.index("quillairoIntermissionPass6625.css")
    assert 'if (theater.phase === "resolution" && theater.activeReceipt)' in THEATER
    assert 'onContinue={theater.acknowledgeResolution}' in THEATER
    assert (FRONT / "features/adventure/useTurnTheater.ts").exists()
