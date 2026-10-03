import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import type { ArcadeGameProps } from "../arcadeTypes";

type Direction = "up" | "down" | "left" | "right";
interface Rider { x: number; y: number; dir: Direction; alive: boolean; }
interface CycleVariant {
  name: string;
  cols: number;
  rows: number;
  cell: number;
  stepMs: number;
  aiTurnChance: number;
}

const VARIANTS: CycleVariant[] = [
  { name: "ARENA S", cols: 40, rows: 20, cell: 18, stepMs: 92, aiTurnChance: 0.055 },
  { name: "ARENA M", cols: 48, rows: 24, cell: 15, stepMs: 74, aiTurnChance: 0.07 },
  { name: "ARENA XL", cols: 60, rows: 30, cell: 12, stepMs: 62, aiTurnChance: 0.085 },
];

function clampScore(value: number) { return Math.max(0, Math.min(999, Math.round(value))); }
function keyOf(x: number, y: number) { return `${x},${y}`; }
function move(rider: Rider) {
  if (rider.dir === "up") rider.y -= 1;
  else if (rider.dir === "down") rider.y += 1;
  else if (rider.dir === "left") rider.x -= 1;
  else rider.x += 1;
}
function leftOf(dir: Direction): Direction {
  return dir === "up" ? "left" : dir === "left" ? "down" : dir === "down" ? "right" : "up";
}
function rightOf(dir: Direction): Direction {
  return dir === "up" ? "right" : dir === "right" ? "down" : dir === "down" ? "left" : "up";
}
function projected(rider: Rider, dir: Direction) {
  const next = { ...rider, dir };
  move(next);
  return next;
}

export function LightCyclesGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [variant] = useState<CycleVariant>(() => VARIANTS[Math.floor(Math.random() * VARIANTS.length)]);
  const { feedback, showFeedback } = useArcadeFeedback(950);
  const width = variant.cols * variant.cell;
  const height = variant.rows * variant.cell;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<Rider>({ x: Math.floor(variant.cols * 0.22), y: Math.floor(variant.rows / 2), dir: "right", alive: true });
  const aiRef = useRef<Rider>({ x: Math.floor(variant.cols * 0.78), y: Math.floor(variant.rows / 2), dir: "left", alive: true });
  const playerTrailRef = useRef<Set<string>>(new Set());
  const aiTrailRef = useRef<Set<string>>(new Set());
  const queuedDirRef = useRef<Direction>("right");
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const [message, setMessage] = useState("DO NOT CROSS THE LIGHT // THE MACHINE WILL TRY_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { if (storyReady) setMessage("STORY READY // LAST GRID COUNTS_"); }, [storyReady]);

  function award(delta: number) {
    const next = clampScore(scoreRef.current + delta);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
  }

  function resetRound() {
    const player = { x: Math.floor(variant.cols * 0.22), y: Math.floor(variant.rows / 2), dir: "right" as Direction, alive: true };
    const ai = { x: Math.floor(variant.cols * 0.78), y: Math.floor(variant.rows / 2), dir: "left" as Direction, alive: true };
    playerRef.current = player;
    aiRef.current = ai;
    queuedDirRef.current = "right";
    playerTrailRef.current = new Set([keyOf(player.x, player.y)]);
    aiTrailRef.current = new Set([keyOf(ai.x, ai.y)]);
  }

  function isBlocked(x: number, y: number) {
    return x < 0 || x >= variant.cols || y < 0 || y >= variant.rows || playerTrailRef.current.has(keyOf(x, y)) || aiTrailRef.current.has(keyOf(x, y));
  }

  function setDirection(next: Direction) {
    const current = playerRef.current.dir;
    if (
      (current === "up" && next === "down") || (current === "down" && next === "up") ||
      (current === "left" && next === "right") || (current === "right" && next === "left")
    ) return;
    queuedDirRef.current = next;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    resetRound();

    const draw = () => {
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#0d2f15";
      for (let x = 0; x <= width; x += variant.cell * 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y <= height; y += variant.cell * 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      ctx.fillStyle = "#7dff9b";
      playerTrailRef.current.forEach((key) => {
        const [x, y] = key.split(",").map(Number);
        ctx.fillRect(x * variant.cell + 2, y * variant.cell + 2, variant.cell - 4, variant.cell - 4);
      });
      ctx.fillStyle = "#2b7f3e";
      aiTrailRef.current.forEach((key) => {
        const [x, y] = key.split(",").map(Number);
        ctx.fillRect(x * variant.cell + 3, y * variant.cell + 3, variant.cell - 6, variant.cell - 6);
      });
      ctx.strokeStyle = "#7dff9b";
      ctx.strokeRect(playerRef.current.x * variant.cell, playerRef.current.y * variant.cell, variant.cell, variant.cell);
      ctx.strokeStyle = "#3aa653";
      ctx.strokeRect(aiRef.current.x * variant.cell, aiRef.current.y * variant.cell, variant.cell, variant.cell);

      ctx.fillStyle = "#3aa653";
      ctx.font = `700 ${Math.max(8, Math.round(variant.cell * 0.72))}px monospace`;
      ctx.textAlign = "right";
      ctx.fillText(`${variant.name} // ${variant.stepMs}MS`, width - 6, 13);
    };

    const step = () => {
      const player = playerRef.current;
      const ai = aiRef.current;
      player.dir = queuedDirRef.current;

      const forward = projected(ai, ai.dir);
      if (isBlocked(forward.x, forward.y)) {
        const options = [leftOf(ai.dir), rightOf(ai.dir)].filter((dir) => {
          const test = projected(ai, dir);
          return !isBlocked(test.x, test.y);
        });
        if (options.length > 0) ai.dir = options[Math.floor(Math.random() * options.length)];
      } else if (Math.random() < variant.aiTurnChance) {
        const turn = Math.random() < 0.5 ? leftOf(ai.dir) : rightOf(ai.dir);
        const test = projected(ai, turn);
        if (!isBlocked(test.x, test.y)) ai.dir = turn;
      }

      const nextPlayer = projected(player, player.dir);
      const nextAi = projected(ai, ai.dir);
      const headOn = nextPlayer.x === nextAi.x && nextPlayer.y === nextAi.y;
      const playerCrash = isBlocked(nextPlayer.x, nextPlayer.y) || headOn;
      const aiCrash = isBlocked(nextAi.x, nextAi.y) || headOn;

      if (playerCrash || aiCrash) {
        if (playerCrash && aiCrash) {
          setMessage("DOUBLE CRASH // NOBODY LEARNS ANYTHING_");
          showFeedback({ title: "DOUBLE CRASH", detail: "DRAW // RESETTING GRID", tone: "neutral" }, 1000);
        } else if (aiCrash) {
          award(15);
          setMessage("MACHINE WALLS ITSELF // +15_");
          showFeedback({ title: "YOU WIN", detail: "MACHINE HIT THE GRID", delta: 15, tone: "great" }, 1150);
        } else {
          award(-5);
          setMessage("YOU HIT THE GRID // -5_");
          showFeedback({ title: "GRID CRASH", detail: "MACHINE TAKES THE ROUND", delta: -5, tone: "bad" }, 1050);
        }
        resetRound();
        draw();
        return;
      }

      player.x = nextPlayer.x; player.y = nextPlayer.y;
      ai.x = nextAi.x; ai.y = nextAi.y;
      playerTrailRef.current.add(keyOf(player.x, player.y));
      aiTrailRef.current.add(keyOf(ai.x, ai.y));
      draw();
    };

    draw();
    const timer = window.setInterval(step, variant.stepMs);
    canvas.focus({ preventScroll: true });
    return () => window.clearInterval(timer);
  }, [height, showFeedback, variant, width]);

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const key = event.key.toLowerCase();
    if (key === "arrowup" || key === "w") setDirection("up");
    else if (key === "arrowdown" || key === "s") setDirection("down");
    else if (key === "arrowleft" || key === "a") setDirection("left");
    else if (key === "arrowright" || key === "d") setDirection("right");
    else return;
    event.preventDefault();
  }

  return (
    <div className="intermission-game light-cycles-game">
      <header className="intermission-game-instructions">
        <strong>LIGHT//CYCLES // {variant.name}</strong>
        <span>WASD / ARROWS // TOUCH D-PAD // BOARD {variant.cols}x{variant.rows}</span>
        <span>MACHINE CRASH +15 // YOUR CRASH -5 // {variant.stepMs <= 65 ? "TURBO" : variant.stepMs >= 90 ? "RELAXED" : "STANDARD"}</span>
      </header>
      <div className="arcade-playfield">
        <canvas ref={canvasRef} className="arcade-canvas grid-arcade-canvas" width={width} height={height} tabIndex={0} onKeyDown={keyDown} aria-label="Retro light cycles game" />
        <ArcadeFeedback feedback={feedback} />
      </div>
      <div className="arcade-touch-dpad" aria-label="Light cycle touch controls">
        <button type="button" onClick={() => setDirection("up")}>▲</button>
        <div><button type="button" onClick={() => setDirection("left")}>◀</button><button type="button" onClick={() => setDirection("down")}>▼</button><button type="button" onClick={() => setDirection("right")}>▶</button></div>
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>{variant.name} // YOU vs MACHINE</strong></footer>
    </div>
  );
}
