import { ArcheryGame } from "../adventure/ArcheryGame";
import { FindOutlierGame } from "../adventure/FindOutlierGame";
import { MazeGame } from "../adventure/MazeGame";
import { MissileDefenseGame } from "../adventure/MissileDefenseGame";
import { PongGame } from "../adventure/PongGame";
import { ProjectileDuelGame } from "../adventure/ProjectileDuelGame";
import { WordPuzzleGame } from "../adventure/WordPuzzleGame";
import type { ArcadeGameDefinition, ArcadeGameProps } from "./arcadeTypes";
import { BowlingGame } from "./games/BowlingGame";
import { GolfGame } from "./games/GolfGame";

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
    live: true,
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
  },
] as const;

const LIVE_SLOT_TO_CABINET: Record<string, string> = {
  rune_catch: "outlier",
  lantern_keep: "pong",
  relic_scramble: "missile_defense",
  sigil_memory: "archery",
  ward_breaker: "maze",
  shadow_step: "word_puzzle",
};

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
