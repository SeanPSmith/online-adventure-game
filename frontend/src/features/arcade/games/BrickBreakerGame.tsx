import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 380;
const PADDLE_W = 108;
const PADDLE_H = 12;
const BALL = 8;
const COLS = 10;
const ROWS = 5;

interface Block { x: number; y: number; alive: boolean; }
interface BreakerState {
  paddleX: number;
  targetX: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  keys: Set<string>;
  blocks: Block[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeBlocks() {
  const blocks: Block[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      blocks.push({ x: 55 + col * 61, y: 48 + row * 27, alive: true });
    }
  }
  return blocks;
}

function freshState(): BreakerState {
  return {
    paddleX: WIDTH / 2 - PADDLE_W / 2,
    targetX: WIDTH / 2 - PADDLE_W / 2,
    ballX: WIDTH / 2,
    ballY: HEIGHT - 74,
    vx: 205,
    vy: -245,
    keys: new Set(),
    blocks: makeBlocks(),
  };
}

export function BrickBreakerGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<BreakerState>(freshState());
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [message, setMessage] = useState("CLEAR THE WALL // KEEP THE BALL ALIVE_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { if (storyReady) setMessage("STORY READY // LAST BOUNCES COUNT_"); }, [storyReady]);

  function award(delta: number) {
    const next = clamp(scoreRef.current + delta, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
  }

  function resetBall(direction = -1) {
    const game = gameRef.current;
    game.ballX = WIDTH / 2;
    game.ballY = HEIGHT - 74;
    game.vx = (Math.random() > 0.5 ? 1 : -1) * 205;
    game.vy = Math.abs(250) * direction;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = (time: number) => {
      const last = lastTimeRef.current ?? time;
      const dt = Math.min(0.034, Math.max(0, (time - last) / 1000));
      lastTimeRef.current = time;
      const game = gameRef.current;

      if (game.keys.has("arrowleft") || game.keys.has("a")) game.targetX -= 360 * dt;
      if (game.keys.has("arrowright") || game.keys.has("d")) game.targetX += 360 * dt;
      game.targetX = clamp(game.targetX, 0, WIDTH - PADDLE_W);
      game.paddleX += (game.targetX - game.paddleX) * Math.min(1, dt * 16);

      game.ballX += game.vx * dt;
      game.ballY += game.vy * dt;

      if (game.ballX <= 0 && game.vx < 0) { game.ballX = 0; game.vx *= -1; }
      if (game.ballX >= WIDTH - BALL && game.vx > 0) { game.ballX = WIDTH - BALL; game.vx *= -1; }
      if (game.ballY <= 0 && game.vy < 0) { game.ballY = 0; game.vy *= -1; }

      const paddleY = HEIGHT - 36;
      if (
        game.vy > 0 &&
        game.ballY + BALL >= paddleY &&
        game.ballY <= paddleY + PADDLE_H &&
        game.ballX + BALL >= game.paddleX &&
        game.ballX <= game.paddleX + PADDLE_W
      ) {
        game.ballY = paddleY - BALL;
        game.vy = -Math.abs(game.vy) * 1.015;
        const offset = ((game.ballX + BALL / 2) - (game.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
        game.vx += offset * 105;
      }

      let destroyed = 0;
      for (const block of game.blocks) {
        if (!block.alive) continue;
        if (
          game.ballX + BALL >= block.x && game.ballX <= block.x + 52 &&
          game.ballY + BALL >= block.y && game.ballY <= block.y + 18
        ) {
          block.alive = false;
          destroyed += 1;
          game.vy *= -1;
          break;
        }
      }

      if (destroyed > 0) {
        award(destroyed * 3);
        setMessage(`BLOCK ERASED // +${destroyed * 3}_`);
      }

      if (game.blocks.every((block) => !block.alive)) {
        award(25);
        setMessage("WALL CLEARED // +25 // REBUILDING WORSE WALL_");
        game.blocks = makeBlocks();
        resetBall(-1);
      }

      if (game.ballY > HEIGHT + 20) {
        award(-3);
        setMessage("BALL LOST // -3 // NEW SIGNAL_");
        resetBall(-1);
      }

      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#164d23";
      ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);

      for (const block of game.blocks) {
        if (!block.alive) continue;
        ctx.fillStyle = "#2d7c3e";
        ctx.fillRect(block.x, block.y, 52, 18);
        ctx.strokeStyle = "#7dff9b";
        ctx.strokeRect(block.x, block.y, 52, 18);
      }

      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(game.paddleX, paddleY, PADDLE_W, PADDLE_H);
      ctx.fillRect(game.ballX, game.ballY, BALL, BALL);

      ctx.font = "700 10px monospace";
      ctx.fillText(`BLOCKS ${game.blocks.filter((block) => block.alive).length}`, 16, 24);

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    canvas.focus({ preventScroll: true });
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, []);

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d"].includes(key)) {
      event.preventDefault();
      gameRef.current.keys.add(key);
    }
  }

  function keyUp(event: KeyboardEvent<HTMLCanvasElement>) {
    gameRef.current.keys.delete(event.key.toLowerCase());
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    gameRef.current.targetX = clamp(x - PADDLE_W / 2, 0, WIDTH - PADDLE_W);
  }

  return (
    <div className="intermission-game brick-breaker-game">
      <header className="intermission-game-instructions">
        <strong>WALL//BREAKER // THE RECTANGLES STARTED IT</strong>
        <span>A/D OR ←/→ // POINTER / TOUCH</span>
        <span>BLOCK +3 // FULL CLEAR +25 // LOST BALL -3</span>
      </header>
      <canvas
        ref={canvasRef}
        className="arcade-canvas brick-breaker-canvas"
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onPointerMove={pointerMove}
        onPointerDown={pointerMove}
        aria-label="Retro brick breaker game"
      />
      <footer className="intermission-game-message"><span>{message}</span><strong>BREAKOUT WITHOUT THE LAWYERS</strong></footer>
    </div>
  );
}
