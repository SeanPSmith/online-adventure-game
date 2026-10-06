from __future__ import annotations

from pathlib import Path

from app.arcade.store import DEFAULT_ARCADE_PUBLICATION

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_hangman_is_a_dedicated_lab_publishable_cabinet() -> None:
    registry = read("frontend/src/features/arcade/ArcadeGameRegistry.tsx")
    hangman = read("frontend/src/features/arcade/games/HangmanGame.tsx")

    assert 'id: "hangman"' in registry
    assert "component: HangmanGame" in registry
    assert DEFAULT_ARCADE_PUBLICATION["hangman"] is False
    assert "HANGMAN // VGA WORD TERMINAL" in hangman
    assert "ROUND LOST" in hangman
    assert "WORD SOLVED" in hangman


def test_hoops_uses_side_view_angle_power_physics_shot_cadence() -> None:
    game = read("frontend/src/features/arcade/games/BasketballGame.tsx")

    assert "AimPowerShotControls" not in game
    assert 'type ShotPhase = "angle" | "power" | "resolving" | "result"' in game
    assert "basketball-angle-track" in game
    assert "basketball-power-track" in game
    assert "LOCK ANGLE" in game
    assert "SIDE-VIEW PHYSICS" in game
    assert "Side-view rim" in game
    assert "GRAVITY" in game
    assert "SWISH!" in game


def test_beer_pong_is_top_down_aim_power_physics_play() -> None:
    game = read("frontend/src/features/arcade/games/BeerPongGame.tsx")

    assert "AimPowerShotControls" in game
    assert "TOP-DOWN PHYSICS TABLE" in game
    assert "HORIZONTAL AIM" in game
    assert "VERTICAL POWER" in game
    assert "ball.tableBounces" in game
    assert "ball.rimHits" in game
    assert "requestAnimationFrame" in game


def test_score_feedback_is_host_level_for_cabinets_without_custom_feedback() -> None:
    registry = read("frontend/src/features/arcade/ArcadeGameRegistry.tsx")
    lab = read("frontend/src/pages/game/ArcadeLabPage.tsx")
    runtime = read("frontend/src/features/adventure/IntermissionRuntime.tsx")

    assert "scoreFeedbackModeForGame" in registry
    assert '["action", "racing", "movement", "reflex"]' in registry
    assert "selected.managesFeedback" in lab
    assert "updateCabinetScore" in lab
    assert "ArcadeFeedback" in lab
    assert "arcadeGame.managesFeedback" in runtime
    assert "intermission-game-feedback-host" in runtime
    assert "ArcadeFeedback" in runtime


def test_war_has_real_face_down_decks_draw_animation_and_outcome_alerts() -> None:
    game = read("frontend/src/features/arcade/games/WarCardGame.tsx")
    styles = read("frontend/src/styles/components.css")

    assert "splitDeck" in game
    assert "playerDeck.length" in game
    assert "enemyDeck.length" in game
    assert "war-deck-stack" in game
    assert "war-battle-card" in game
    assert "warDepth" in game
    assert "YOU WIN THE WAR!" in game
    assert "GAME LOST" in game
    assert "war-player-deal" in styles
    assert "war-enemy-deal" in styles
    assert "war-face-down-row" in styles


def test_blackjack_cards_deal_and_all_outcomes_have_large_feedback() -> None:
    game = read("frontend/src/features/arcade/games/BlackjackGame.tsx")
    styles = read("frontend/src/styles/components.css")

    assert "is-dealt" in game
    assert "--deal-order" in game
    assert "BLACKJACK!" in game
    assert "YOU WIN" in game
    assert "DEALER WINS" in game
    assert "BUST" in game
    assert "PUSH" in game
    assert "arcade-card-deal" in styles
    assert "is-card-back" in styles


def test_arcade_cabinets_can_use_vga_color_without_changing_site_shell_contract() -> None:
    styles = read("frontend/src/styles/components.css")

    assert "PASS 36 // ARCADE JUICE + CABINET PERSONALITY" in styles
    assert "--card-cream" in styles
    assert "#ff9a42" in styles  # basketball orange
    assert "#ff6f68" in styles  # cup red
    assert "#6fd8ff" in styles  # VGA/cyan Hangman accent
