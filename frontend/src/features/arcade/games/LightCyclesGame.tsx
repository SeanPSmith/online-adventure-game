import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";

const COLS = 48;
const ROWS = 24;
const CELL = 15;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

type Direction = "up" | "down" | "left" | "right";
interface Rider { x: number; y: number; dir: Direction; alive: boolean; }

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<Rider>({ x: 10, y: 12, dir: "right", alive: true });
  const aiRef = useRef<Rider>({ x: 37, y: 12, dir: "left", alive: true });
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
    playerRef.current = { x: 10, y: 12, dir: "right", alive: true };
    aiRef.current = { x: 37, y: 12, dir: "left", alive: true };
    queuedDirRef.current = "right";
    playerTrailRef.current = new Set([keyOf(10, 12)]);
    aiTrailRef.current = new Set([keyOf(37, 12)]);
  }

  function isBlocked(x: number, y: number) {
    return x < 0 || x >= COLS || y < 0 || y >= ROWS || playerTrailRef.current.has(keyOf(x, y)) || aiTrailRef.current.has(keyOf(x, y));
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
    resetRound();

    const draw = () => {
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#0d2f15";
      for (let x = 0; x <= WIDTH; x += CELL * 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
      for (let y = 0; y <= HEIGHT; y += CELL * 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }

      ctx.fillStyle = "#7dff9b";
      playerTrailRef.current.forEach((key) => {
        const [x, y] = key.split(",").map(Number);
        ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
      });
      ctx.fillStyle = "#2b7f3e";
      aiTrailRef.current.forEach((key) => {
        const [x, y] = key.split(",").map(Number);
        ctx.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
      });
      ctx.strokeStyle = "#7dff9b";
      ctx.strokeRect(playerRef.current.x * CELL, playerRef.current.y * CELL, CELL, CELL);
      ctx.strokeStyle = "#3aa653";
      ctx.strokeRect(aiRef.current.x * CELL, aiRef.current.y * CELL, CELL, CELL);
    };

    const step = () => {
      const player = playerRef.current;
      const ai = aiRef.current;
      player.dir = queuedDirRef.current;

      // AI keeps going if possible, otherwise chooses the safer turn.
      const forward = projected(ai, ai.dir);
      if (isBlocked(forward.x, forward.y)) {
        const options = [leftOf(ai.dir), rightOf(ai.dir)].filter((dir) => {
          const test = projected(ai, dir);
          return !isBlocked(test.x, test.y);
        });
        if (options.length > 0) ai.dir = options[Math.floor(Math.random() * options.length)];
      } else if (Math.random() < 0.07) {
        const turn = Math.random() < 0.5 ? leftOf(ai.dir) : rightOf(ai.dir);
        const test = projected(ai, turn);
        if (!isBlocked(test.x, test.y)) ai.dir = turn;
      }

      const nextPlayer = projected(player, player.dir);
      const nextAi = projected(ai, ai.dir);
      const playerCrash = isBlocked(nextPlayer.x, nextPlayer.y) || (nextPlayer.x === nextAi.x && nextPlayer.y === nextAi.y);
      const aiCrash = isBlocked(nextAi.x, nextAi.y) || (nextPlayer.x === nextAi.x && nextPlayer.y === nextAi.y);

      if (playerCrash || aiCrash) {
        if (playerCrash && aiCrash) {
          setMessage("DOUBLE CRASH // NOBODY LEARNS ANYTHING_");
        } else if (aiCrash) {
          award(15);
          setMessage("MACHINE WALLS ITSELF // +15_");
        } else {
          award(-5);
          setMessage("YOU HIT THE GRID // -5_");
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
    const timer = window.setInterval(step, 72);
    canvas.focus({ preventScroll: true });
    return () => window.clearInterval(timer);
  }, []);

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
        <strong>LIGHT//CYCLES // DO NOT TOUCH ANY TRAIL</strong>
        <span>WASD / ARROWS // TOUCH D-PAD // SOLO MACHINE OPPONENT</span>
        <span>MACHINE CRASH +15 // YOUR CRASH -5</span>
      </header>
      <canvas ref={canvasRef} className="arcade-canvas grid-arcade-canvas" width={WIDTH} height={HEIGHT} tabIndex={0} onKeyDown={keyDown} aria-label="Retro light cycles game" />
      <div className="arcade-touch-dpad" aria-label="Light cycle touch controls">
        <button type="button" onClick={() => setDirection("up")}>▲</button>
        <div><button type="button" onClick={() => setDirection("left")}>◀</button><button type="button" onClick={() => setDirection("down")}>▼</button><button type="button" onClick={() => setDirection("right")}>▶</button></div>
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>YOU // MACHINE</strong></footer>
    </div>
  );
}
