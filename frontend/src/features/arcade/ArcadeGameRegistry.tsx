import { ArcheryGame } from "../adventure/ArcheryGame";
import { FindOutlierGame } from "../adventure/FindOutlierGame";
import { MazeGame } from "../adventure/MazeGame";
import { MissileDefenseGame } from "../adventure/MissileDefenseGame";
import { PongGame } from "../adventure/PongGame";
import { ProjectileDuelGame } from "../adventure/ProjectileDuelGame";
import { WordPuzzleGame } from "../adventure/WordPuzzleGame";
import type { ArcadeGameDefinition, ArcadeGameProps } from "./arcadeTypes";
import { BasketballGame } from "./games/BasketballGame";
import { BattleshipGame } from "./games/BattleshipGame";
import { BeerPongGame } from "./games/BeerPongGame";
import { BlackjackGame } from "./games/BlackjackGame";
import { BowlingGame } from "./games/BowlingGame";
import { BrickBreakerGame } from "./games/BrickBreakerGame";
import { GolfGame } from "./games/GolfGame";
import { HangmanGame } from "./games/HangmanGame";
import { LightCyclesGame } from "./games/LightCyclesGame";
import { MahjongMatchGame } from "./games/MahjongMatchGame";
import { RoadRacerGame } from "./games/RoadRacerGame";
import { SnakeGame } from "./games/SnakeGame";
import { WarCardGame } from "./games/WarCardGame";

function OutlierAdapter(props: ArcadeGameProps) {
  return <FindOutlierGame {...props} />;
}

function PongAdapter(props: ArcadeGameProps) {
  return <PongGame {...props} />;
}

function MissileAdapter(props: ArcadeGameProps) {
  return <MissileDefenseGame {...props} />;
}

function ArcheryAdapter(props: ArcadeGameProps) {
  return <ArcheryGame {...props} />;
}

function MazeAdapter(props: ArcadeGameProps) {
  return <MazeGame {...props} />;
}

function WordAdapter(props: ArcadeGameProps) {
  return <WordPuzzleGame {...props} />;
}

function ProjectileAdapter(props: ArcadeGameProps) {
  return <ProjectileDuelGame {...props} />;
}

export const ARCADE_GAMES: readonly ArcadeGameDefinition[] = [
  {
    id: "outlier",
    title: "FIND THE OUTLIER",
    category: "reflex",
    description: "Spot the one corrupted glyph before the clock bites you.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "ARROWS / ENTER / TAP",
    live: true,
    component: OutlierAdapter,
  },
  {
    id: "pong",
    title: "TERMINAL PONG",
    category: "action",
    description: "Keep the signal off your wall and punch holes in the machine.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "W/S / ARROWS / POINTER",
    live: true,
    component: PongAdapter,
  },
  {
    id: "missile_defense",
    title: "MISSILE DEFENSE",
    category: "action",
    description: "Intercept incoming garbage before the terminal gets cratered.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "POINTER / TAP",
    live: true,
    component: MissileAdapter,
  },
  {
    id: "archery",
    title: "ARCHERY RANGE",
    category: "timing",
    description: "Time the shot, compensate, and put arrows where dignity lives.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "SPACE / TAP",
    live: false,
    component: ArcheryAdapter,
  },
  {
    id: "maze",
    title: "MAZE RUNNER",
    category: "movement",
    description: "Get out before the Director finishes writing your consequences.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "WASD / ARROWS / D-PAD",
    live: true,
    component: MazeAdapter,
  },
  {
    id: "word_puzzle",
    title: "WORD CABINET",
    category: "puzzle",
    description: "Alternates between word search and hangman-style terminal abuse.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "KEYBOARD / TAP",
    live: true,
    component: WordAdapter,
  },

  {
    id: "hangman",
    title: "HANGMAN // VGA",
    category: "puzzle",
    description: "Dedicated Hangman cabinet with keyboard play, hints, animated round results, and six-miss pressure.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "KEYBOARD / TAP",
    live: false,
    component: HangmanGame,
    managesFeedback: true,
  },

  {
    id: "road_racer",
    title: "HIGHWAY 84",
    category: "racing",
    description: "Traffic dodging that gets faster and denser over time, with bonus points for risky near misses.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "A/D / ARROWS / POINTER",
    live: true,
    component: RoadRacerGame,
    managesFeedback: true,
  },
  {
    id: "brick_breaker",
    title: "WALL//BREAKER",
    category: "action",
    description: "Classic paddle-and-ball brick destruction with cheap terminal dignity.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "A/D / ARROWS / POINTER",
    live: false,
    component: BrickBreakerGame,
    managesFeedback: true,
  },
  {
    id: "data_snake",
    title: "DATA SNAKE",
    category: "movement",
    description: "Eat bytes, grow longer, and avoid recursively consuming yourself.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "WASD / ARROWS / D-PAD",
    live: false,
    component: SnakeGame,
    managesFeedback: true,
  },
  {
    id: "light_cycles",
    title: "LIGHT//CYCLES",
    category: "action",
    description: "Trap a machine rider with persistent light trails without walling yourself in.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "WASD / ARROWS / D-PAD",
    live: false,
    component: LightCyclesGame,
    managesFeedback: true,
  },
  {
    id: "projectile_duel",
    title: "GORILLA ARTILLERY",
    category: "strategy",
    description: "Angle, power, wind, and a deeply personal argument with gravity.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "SLIDERS / FIRE",
    live: false,
    component: ProjectileAdapter,
    managesFeedback: true,
  },
  {
    id: "bowling",
    title: "BOWL-O-MATIC",
    category: "sport",
    description: "Three-tap aim, power, and spin with aggressively cheap VGA dignity.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "SPACE / ENTER / TAP",
    live: false,
    component: BowlingGame,
    managesFeedback: true,
  },
  {
    id: "beer_pong",
    title: "BEER PONG",
    category: "timing",
    description: "Gorillas-style angle-and-power throws with visible ballistics, cup collisions, and reracks.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "ANGLE / POWER / THROW",
    live: false,
    component: BeerPongGame,
    managesFeedback: true,
  },
  {
    id: "basketball",
    title: "PIXEL HOOPS",
    category: "sport",
    description: "Three-stage aim, power, and release shooting with visible arcs, streaks, and two/three-point attempts.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "TAP / CLICK",
    live: false,
    component: BasketballGame,
    managesFeedback: true,
  },
  {
    id: "blackjack",
    title: "BLACKJACK",
    category: "strategy",
    description: "Fast dealer blackjack: hit, stand, survive 21, and keep the table moving.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "HIT / STAND",
    live: false,
    component: BlackjackGame,
    managesFeedback: true,
  },
  {
    id: "war_cards",
    title: "WAR // CARDS",
    category: "strategy",
    description: "High-card warfare with escalating tie stakes and zero intellectual dignity.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "DRAW",
    live: false,
    component: WarCardGame,
    managesFeedback: true,
  },
  {
    id: "battleship",
    title: "RADAR FLEET",
    category: "strategy",
    description: "A compact Battleship-style radar hunt against a hidden three-ship fleet.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "GRID / TAP",
    live: false,
    component: BattleshipGame,
  },
  {
    id: "mahjong_match",
    title: "MAHJONG MATCH",
    category: "puzzle",
    description: "Mahjong-themed memory matching with streak scoring and fast tile-wall resets.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "TILE / TAP",
    live: false,
    component: MahjongMatchGame,
  },
  {
    id: "golf",
    title: "PIXEL LINKS",
    category: "sport",
    description: "Closest-to-the-pin golf with wind, shot shape, and three-tap timing.",
    supportsSolo: true,
    supportsCoop: true,
    supportsTouch: true,
    controls: "SPACE / ENTER / TAP",
    live: false,
    component: GolfGame,
    managesFeedback: true,
  },
] as const;

const LIVE_SLOT_TO_CABINET: Record<string, string> = {
  rune_catch: "outlier",
  lantern_keep: "pong",
  relic_scramble: "missile_defense",
  sigil_memory: "road_racer",
  ward_breaker: "maze",
  shadow_step: "word_puzzle",
};

export function scoreFeedbackModeForGame(game: ArcadeGameDefinition) {
  if (game.feedbackMode) return game.feedbackMode;
  return ["action", "racing", "movement", "reflex"].includes(game.category) ? "compact" : "overlay";
}

const BY_ID = new Map(ARCADE_GAMES.map((game) => [game.id, game]));

export function arcadeGameById(gameId: string) {
  return BY_ID.get(gameId) ?? ARCADE_GAMES[0];
}

export function liveArcadeGameForServerSlot(serverGameId: string) {
  const cabinetId = LIVE_SLOT_TO_CABINET[serverGameId] ?? "outlier";
  return arcadeGameById(cabinetId);
}

export function arcadeGamesForLab() {
  return [...ARCADE_GAMES];
}
