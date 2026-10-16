"""Regression contracts for Pass 63 gameplay fixes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_story_ready_waits_for_its_timer_to_fire_before_finalizing() -> None:
    src = source("frontend/src/features/adventure/IntermissionRuntime.tsx")
    start = src.index("if (!storyReady || storyReadySeconds > 0 || finalized) return;")
    finish = src.index("  const resultIsOurs", start)
    effect = src[start:finish]
    callback = effect.index("const timer = window.setTimeout(() => {")
    assert "setFinalized(true);" not in effect[:callback]
    assert callback < effect.index("submitFinalScore();")
    assert effect.index("submitFinalScore();") < effect.index("setFinalized(true);") < effect.index("onStoryReadyComplete();")


def test_story_ready_preserves_intermission_until_final_receipt_and_exposes_resync() -> None:
    hook = source("frontend/src/features/adventure/useTurnTheater.ts")
    finish = hook[hook.index("const finishIntermissionStoryReady"):hook.index("const beginStoryReady")]
    assert finish.index("if (!final || final.preliminary) return") < finish.index("rememberIntermission(null)")
    assert 'transition("retry")' in hook
    overlay = source("frontend/src/features/adventure/TurnTheater.tsx")
    assert 'RE-SYNC STORY' in overlay
    assert 'onSync' in overlay
    assert 'onSync={live.sync}' in source("frontend/src/pages/game/AdventurePage.tsx")


def test_dice_animate_the_authoritative_number_not_question_marks() -> None:
    src = source("frontend/src/features/adventure/TurnResolutionTheater.tsx")
    assert 'setDisplayRoll("?")' not in src
    assert 'const check = result.check;' in src
    assert src.count('setDisplayRoll(check.roll)') == 1
    assert 'setDisplayRoll(cosmeticD20Face())' in src
    assert 'import { cosmeticD20Face } from "./diceAnimation";' in src
    assert 'Math.random()' not in src
    cosmetic = source('frontend/src/features/adventure/diceAnimation.ts')
    assert 'Math.floor(Math.random() * 20) + 1' in cosmetic
    assert 'setDisplayRoll(result.check.roll)' not in src
    assert 'const check = result.check;' in src


def test_war_first_showed_equal_ranks_and_displays_tiebreaker_separately() -> None:
    src = source("frontend/src/features/arcade/games/WarCardGame.tsx")
    assert 'while (mine.value === theirs.value && player.length && enemy.length)' in src
    assert 'const openingMine = mine;' in src
    assert 'const openingTheirs = theirs;' in src
    assert 'setPlayerCard(result.openingMine)' in src
    assert 'setEnemyCard(result.openingTheirs)' in src
    assert 'TIED OPENERS' in src
    assert 'TIEBREAKER SHOWN' in src


def test_word_reveal_runs_until_actual_spoken_story_cue() -> None:
    src = source("frontend/src/pages/game/AdventurePage.tsx")
    assert 'enabled={storyPreferences.wordReveal && theater.phase === "none"}' in src
    assert 'narration.cue?.kind === "story"' in src
    assert '!(audioPreferences.narrationEnabled && audioPreferences.narrationAutoPlay)' not in src
