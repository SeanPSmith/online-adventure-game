import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import type { ArcadeGameProps } from "../arcadeTypes";
import { swipeDirection, type SwipePoint } from "../engine/swipe";

type Direction = "up" | "down" | "left" | "right";
interface Cell { x: number; y: number; }
interface SnakeVariant {
  name: string;
  cols: number;
  rows: number;
  cell: number;
  stepMs: number;
}

const VARIANTS: SnakeVariant[] = [
  { name: "WIDE BYTEFIELD", cols: 30, rows: 16, cell: 24, stepMs: 122 },
  { name: "STANDARD BUS", cols: 36, rows: 19, cell: 20, stepMs: 100 },
  { name: "TURBO GRID", cols: 45, rows: 24, cell: 16, stepMs: 82 },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(999, Math.round(value)));
}

function randomFood(snake: Cell[], variant: SnakeVariant): Cell {
  for (let tries = 0; tries < 300; tries += 1) {
    const candidate = {
      x: Math.floor(Math.random() * variant.cols),
      y: Math.floor(Math.random() * variant.rows),
    };
    if (!snake.some((cell) => cell.x === candidate.x && cell.y === candidate.y)) return candidate;
  }
  return { x: 3, y: 3 };
}

function freshSnake(variant: SnakeVariant) {
  const y = Math.floor(variant.rows / 2);
  const x = Math.max(4, Math.floor(variant.cols / 3));
  return [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ];
}

export function SnakeGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [variant] = useState<SnakeVariant>(() => VARIANTS[Math.floor(Math.random() * VARIANTS.length)]);
  const { feedback, showFeedback } = useArcadeFeedback(760);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snakeRef = useRef<Cell[]>(freshSnake(variant));
  const foodRef = useRef<Cell>(randomFood(snakeRef.current, variant));
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const [length, setLength] = useState(snakeRef.current.length);
  const [message, setMessage] = useState("EAT THE BLOCK // DO NOT EAT YOURSELF_");
  const swipeStartRef = useRef<SwipePoint | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const pausedUntilRef = useRef(0);
  const coarsePointer = typeof window !== "undefined"
    && window.matchMedia?.("(pointer: coarse)").matches;
  const effectiveStepMs = Math.round(variant.stepMs * (coarsePointer ? 1.28 : 1));

  const width = variant.cols * variant.cell;
  const height = variant.rows * variant.cell;

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { if (storyReady) setMessage("STORY READY // ONE LAST BITE IF YOU DARE_"); }, [storyReady]);

  function award(delta: number) {
    const next = clampScore(scoreRef.current + delta);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
  }

  function resetSnake() {
    snakeRef.current = freshSnake(variant);
    directionRef.current = "right";
    queuedDirectionRef.current = "right";
    foodRef.current = randomFood(snakeRef.current, variant);
    setLength(snakeRef.current.length);
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
    ctx.imageSmoothingEnabled = false;

    const draw = () => {
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#0d2f15";
      for (let x = 0; x <= width; x += variant.cell) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y <= height; y += variant.cell) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      ctx.fillStyle = "#7dff9b";
      snakeRef.current.forEach((cell, index) => {
        const inset = index === 0 ? 2 : Math.max(3, Math.round(variant.cell * 0.18));
        ctx.fillRect(
          cell.x * variant.cell + inset,
          cell.y * variant.cell + inset,
          variant.cell - inset * 2,
          variant.cell - inset * 2,
        );
      });

      const food = foodRef.current;
      const inset = Math.max(3, Math.round(variant.cell * 0.2));
      ctx.strokeStyle = "#7dff9b";
      ctx.strokeRect(
        food.x * variant.cell + inset,
        food.y * variant.cell + inset,
        variant.cell - inset * 2,
        variant.cell - inset * 2,
      );
      ctx.beginPath();
      ctx.moveTo(food.x * variant.cell + variant.cell / 2, food.y * variant.cell + 2);
      ctx.lineTo(food.x * variant.cell + variant.cell / 2, food.y * variant.cell + variant.cell - 2);
      ctx.stroke();

      ctx.fillStyle = "#3aa653";
      ctx.font = `700 ${Math.max(8, Math.round(variant.cell * 0.45))}px monospace`;
      ctx.textAlign = "right";
      ctx.fillText(variant.name, width - 8, 14);
    };

    const step = () => {
      directionRef.current = queuedDirectionRef.current;
      const head = snakeRef.current[0];
      const delta = directionRef.current === "up" ? { x: 0, y: -1 }
        : directionRef.current === "down" ? { x: 0, y: 1 }
          : directionRef.current === "left" ? { x: -1, y: 0 }
            : { x: 1, y: 0 };
      const next = { x: head.x + delta.x, y: head.y + delta.y };
      const hitWall = next.x < 0 || next.x >= variant.cols || next.y < 0 || next.y >= variant.rows;
      const hitSelf = snakeRef.current.some((cell) => cell.x === next.x && cell.y === next.y);

      if (performance.now() < pausedUntilRef.current) {
        draw();
        return;
      }

      if (hitWall || hitSelf) {
        award(-4);
        setMessage("SNAKE ERROR // -4 // GET READY_");
        showFeedback({ title: "SNAKE ERROR", detail: hitWall ? "WALL COLLISION" : "SELF COLLISION", delta: -4, tone: "bad" }, 1000);
        pausedUntilRef.current = performance.now() + 1100;
        if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = window.setTimeout(() => {
          resetSnake();
          setMessage("NEW SNAKE // READY_");
        }, 1050);
        draw();
        return;
      }

      snakeRef.current = [next, ...snakeRef.current];
      const food = foodRef.current;
      if (next.x === food.x && next.y === food.y) {
        award(5);
        setLength(snakeRef.current.length);
        setMessage(`BYTE CONSUMED // LENGTH ${snakeRef.current.length} // +5_`);
        showFeedback({ title: "BYTE EATEN", detail: `LENGTH ${snakeRef.current.length}`, delta: 5, tone: snakeRef.current.length % 5 === 0 ? "great" : "good" }, snakeRef.current.length % 5 === 0 ? 950 : 560);
        foodRef.current = randomFood(snakeRef.current, variant);
      } else {
        snakeRef.current.pop();
      }
      draw();
    };

    draw();
    const timer = window.setInterval(step, effectiveStepMs);
    canvas.focus({ preventScroll: true });
    return () => {
      window.clearInterval(timer);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, [effectiveStepMs, height, showFeedback, variant, width]);

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const key = event.key.toLowerCase();
    if (key === "arrowup" || key === "w") setDirection("up");
    else if (key === "arrowdown" || key === "s") setDirection("down");
    else if (key === "arrowleft" || key === "a") setDirection("left");
    else if (key === "arrowright" || key === "d") setDirection("right");
    else return;
    event.preventDefault();
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const direction = swipeDirection(
      swipeStartRef.current,
      { x: event.clientX, y: event.clientY },
    );
    swipeStartRef.current = null;
    if (direction) setDirection(direction);
  }

  return (
    <div className="intermission-game snake-game">
      <header className="intermission-game-instructions">
        <strong>DATA SNAKE // {variant.name}</strong>
        <span>WASD / ARROWS // SWIPE OR D-PAD // BOARD {variant.cols}x{variant.rows}</span>
        <span>BYTE +5 // CRASH -4 // {effectiveStepMs <= 95 ? "TURBO" : effectiveStepMs >= 130 ? "RELAXED" : "STANDARD"} SPEED</span>
      </header>
      <div className="arcade-playfield">
        <canvas
          ref={canvasRef}
          className="arcade-canvas grid-arcade-canvas"
          width={width}
          height={height}
          tabIndex={0}
          onKeyDown={keyDown}
          onPointerDown={pointerDown}
          onPointerUp={pointerUp}
          onPointerCancel={() => { swipeStartRef.current = null; }}
          aria-label="Retro snake game"
        />
        <ArcadeFeedback feedback={feedback} mode="compact" />
      </div>
      <div className="arcade-touch-dpad" aria-label="Snake touch controls">
        <button type="button" onClick={() => setDirection("up")}>▲</button>
        <div><button type="button" onClick={() => setDirection("left")}>◀</button><button type="button" onClick={() => setDirection("down")}>▼</button><button type="button" onClick={() => setDirection("right")}>▶</button></div>
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>LENGTH {length}</strong></footer>
    </div>
  );
}
