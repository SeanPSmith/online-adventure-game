import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";

const COLS = 36;
const ROWS = 19;
const CELL = 20;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

type Direction = "up" | "down" | "left" | "right";
interface Cell { x: number; y: number; }

function clampScore(value: number) {
  return Math.max(0, Math.min(999, Math.round(value)));
}

function randomFood(snake: Cell[]): Cell {
  for (let tries = 0; tries < 200; tries += 1) {
    const candidate = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
    if (!snake.some((cell) => cell.x === candidate.x && cell.y === candidate.y)) return candidate;
  }
  return { x: 3, y: 3 };
}

function freshSnake() {
  return [
    { x: 12, y: 9 },
    { x: 11, y: 9 },
    { x: 10, y: 9 },
  ];
}

export function SnakeGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snakeRef = useRef<Cell[]>(freshSnake());
  const foodRef = useRef<Cell>(randomFood(snakeRef.current));
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const [message, setMessage] = useState("EAT THE BLOCK // DO NOT EAT YOURSELF_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { if (storyReady) setMessage("STORY READY // ONE LAST BITE IF YOU DARE_"); }, [storyReady]);

  function award(delta: number) {
    const next = clampScore(scoreRef.current + delta);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
  }

  function resetSnake() {
    snakeRef.current = freshSnake();
    directionRef.current = "right";
    queuedDirectionRef.current = "right";
    foodRef.current = randomFood(snakeRef.current);
  }

  function setDirection(next: Direction) {
    const current = directionRef.current;
    if (
      (current === "up" && next === "down") ||
      (current === "down" && next === "up") ||
      (current === "left" && next === "right") ||
      (current === "right" && next === "left")
    ) return;
    queuedDirectionRef.current = next;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#0d2f15";
      for (let x = 0; x <= WIDTH; x += CELL) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
      }
      for (let y = 0; y <= HEIGHT; y += CELL) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
      }

      ctx.fillStyle = "#7dff9b";
      snakeRef.current.forEach((cell, index) => {
        const inset = index === 0 ? 2 : 4;
        ctx.fillRect(cell.x * CELL + inset, cell.y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
      });

      const food = foodRef.current;
      ctx.strokeStyle = "#7dff9b";
      ctx.strokeRect(food.x * CELL + 4, food.y * CELL + 4, CELL - 8, CELL - 8);
      ctx.beginPath();
      ctx.moveTo(food.x * CELL + CELL / 2, food.y * CELL + 2);
      ctx.lineTo(food.x * CELL + CELL / 2, food.y * CELL + CELL - 2);
      ctx.stroke();
    };

    const step = () => {
      directionRef.current = queuedDirectionRef.current;
      const head = snakeRef.current[0];
      const delta = directionRef.current === "up" ? { x: 0, y: -1 }
        : directionRef.current === "down" ? { x: 0, y: 1 }
          : directionRef.current === "left" ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
      const next = { x: head.x + delta.x, y: head.y + delta.y };
      const hitWall = next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS;
      const hitSelf = snakeRef.current.some((cell) => cell.x === next.x && cell.y === next.y);

      if (hitWall || hitSelf) {
        award(-4);
        setMessage("SNAKE ERROR // -4 // REBOOTING REPTILE_");
        resetSnake();
        draw();
        return;
      }

      snakeRef.current = [next, ...snakeRef.current];
      const food = foodRef.current;
      if (next.x === food.x && next.y === food.y) {
        award(5);
        setMessage(`BYTE CONSUMED // LENGTH ${snakeRef.current.length} // +5_`);
        foodRef.current = randomFood(snakeRef.current);
      } else {
        snakeRef.current.pop();
      }
      draw();
    };

    draw();
    const timer = window.setInterval(step, 95);
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
    <div className="intermission-game snake-game">
      <header className="intermission-game-instructions">
        <strong>DATA SNAKE // EAT BYTES // AVOID YOUR OWN BAD DECISIONS</strong>
        <span>WASD / ARROWS // TOUCH D-PAD</span>
        <span>BYTE +5 // CRASH -4</span>
      </header>
      <canvas ref={canvasRef} className="arcade-canvas grid-arcade-canvas" width={WIDTH} height={HEIGHT} tabIndex={0} onKeyDown={keyDown} aria-label="Retro snake game" />
      <div className="arcade-touch-dpad" aria-label="Snake touch controls">
        <button type="button" onClick={() => setDirection("up")}>▲</button>
        <div><button type="button" onClick={() => setDirection("left")}>◀</button><button type="button" onClick={() => setDirection("down")}>▼</button><button type="button" onClick={() => setDirection("right")}>▶</button></div>
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>LENGTH {snakeRef.current.length}</strong></footer>
    </div>
  );
}
