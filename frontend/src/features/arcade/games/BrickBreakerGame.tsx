import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 380;
const PADDLE_H = 12;
const BALL = 8;

interface BreakerVariant {
  name: string;
  cols: number;
  rows: number;
  paddleW: number;
  speed: number;
  pattern: "wall" | "checker" | "fort";
}

const VARIANTS: BreakerVariant[] = [
  { name: "WIDE WALL", cols: 9, rows: 4, paddleW: 124, speed: 225, pattern: "wall" },
  { name: "CHECKER GRID", cols: 10, rows: 5, paddleW: 108, speed: 248, pattern: "checker" },
  { name: "FORTRESS", cols: 11, rows: 6, paddleW: 96, speed: 268, pattern: "fort" },
];

interface Block { x: number; y: number; w: number; h: number; alive: boolean; }
interface BreakerState {
  paddleX: number;
  targetX: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  keys: Set<string>;
  blocks: Block[];
  combo: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shouldKeepBlock(variant: BreakerVariant, row: number, col: number) {
  if (variant.pattern === "checker") return (row + col) % 2 === 0 || row === 0 || row === variant.rows - 1;
  if (variant.pattern === "fort") {
    const middle = Math.floor(variant.cols / 2);
    return row < 2 || col === 0 || col === variant.cols - 1 || Math.abs(col - middle) <= Math.max(0, 2 - Math.floor(row / 2));
  }
  return true;
}

function makeBlocks(variant: BreakerVariant) {
  const margin = 44;
  const gap = 7;
  const usable = WIDTH - margin * 2;
  const w = (usable - gap * (variant.cols - 1)) / variant.cols;
  const h = 17;
  const blocks: Block[] = [];
  for (let row = 0; row < variant.rows; row += 1) {
    for (let col = 0; col < variant.cols; col += 1) {
      if (!shouldKeepBlock(variant, row, col)) continue;
      blocks.push({
        x: margin + col * (w + gap),
        y: 46 + row * 25,
        w,
        h,
        alive: true,
      });
    }
  }
  return blocks;
}

function freshState(variant: BreakerVariant): BreakerState {
  return {
    paddleX: WIDTH / 2 - variant.paddleW / 2,
    targetX: WIDTH / 2 - variant.paddleW / 2,
    ballX: WIDTH / 2,
    ballY: HEIGHT - 74,
    vx: variant.speed * 0.82,
    vy: -variant.speed,
    keys: new Set(),
    blocks: makeBlocks(variant),
    combo: 0,
  };
}

export function BrickBreakerGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [variant, setVariant] = useState<BreakerVariant>(() => VARIANTS[Math.floor(Math.random() * VARIANTS.length)]);
  const variantRef = useRef(variant);
  const { feedback, showFeedback } = useArcadeFeedback(720);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<BreakerState>(freshState(variant));
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [message, setMessage] = useState("CLEAR THE WALL // KEEP THE BALL ALIVE_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { if (storyReady) setMessage("STORY READY // LAST BOUNCES COUNT_"); }, [storyReady]);
  useEffect(() => { variantRef.current = variant; }, [variant]);

  function award(delta: number) {
    const next = clamp(scoreRef.current + delta, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
  }

  function resetBall(direction = -1) {
    const game = gameRef.current;
    const current = variantRef.current;
    game.ballX = WIDTH / 2;
    game.ballY = HEIGHT - 74;
    game.vx = (Math.random() > 0.5 ? 1 : -1) * current.speed * 0.82;
    game.vy = Math.abs(current.speed) * direction;
    game.combo = 0;
  }

  function rebuildBoard() {
    const currentIndex = VARIANTS.indexOf(variantRef.current);
    const choices = VARIANTS.filter((_, index) => index !== currentIndex);
    const nextVariant = choices[Math.floor(Math.random() * choices.length)] ?? VARIANTS[0];
    variantRef.current = nextVariant;
    setVariant(nextVariant);
    gameRef.current.blocks = makeBlocks(nextVariant);
    gameRef.current.paddleX = WIDTH / 2 - nextVariant.paddleW / 2;
    gameRef.current.targetX = gameRef.current.paddleX;
    resetBall(-1);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const tick = (time: number) => {
      const last = lastTimeRef.current ?? time;
      const dt = Math.min(0.034, Math.max(0, (time - last) / 1000));
      lastTimeRef.current = time;
      const game = gameRef.current;
      const current = variantRef.current;

      if (game.keys.has("arrowleft") || game.keys.has("a")) game.targetX -= 360 * dt;
      if (game.keys.has("arrowright") || game.keys.has("d")) game.targetX += 360 * dt;
      game.targetX = clamp(game.targetX, 0, WIDTH - current.paddleW);
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
        game.ballX <= game.paddleX + current.paddleW
      ) {
        game.ballY = paddleY - BALL;
        game.vy = -Math.abs(game.vy) * 1.012;
        const offset = ((game.ballX + BALL / 2) - (game.paddleX + current.paddleW / 2)) / (current.paddleW / 2);
        game.vx += offset * 92;
        game.combo = 0;
      }

      for (const block of game.blocks) {
        if (!block.alive) continue;
        if (
          game.ballX + BALL >= block.x && game.ballX <= block.x + block.w &&
          game.ballY + BALL >= block.y && game.ballY <= block.y + block.h
        ) {
          block.alive = false;
          game.combo += 1;
          game.vy *= -1;
          const delta = game.combo >= 4 ? 5 : 3;
          award(delta);
          setMessage(game.combo >= 4 ? `COMBO x${game.combo} // +${delta}_` : `BLOCK ERASED // +${delta}_`);
          showFeedback({
            title: game.combo >= 4 ? `COMBO x${game.combo}` : "BLOCK HIT",
            detail: `${game.blocks.filter((b) => b.alive).length} REMAIN`,
            delta,
            tone: game.combo >= 4 ? "great" : "good",
          }, game.combo >= 4 ? 820 : 430);
          break;
        }
      }

      if (game.blocks.every((block) => !block.alive)) {
        award(25);
        setMessage("WALL CLEARED // +25 // NEXT BOARD_");
        showFeedback({ title: "BOARD CLEARED", detail: "NEXT WALL IS ALREADY BEING RUDE", delta: 25, tone: "great" }, 1200);
        rebuildBoard();
      }

      if (game.ballY > HEIGHT + 20) {
        award(-3);
        setMessage("BALL LOST // -3 // NEW SIGNAL_");
        showFeedback({ title: "BALL LOST", detail: "COMBO RESET", delta: -3, tone: "bad" }, 900);
        resetBall(-1);
      }

      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#164d23";
      ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);

      for (const block of game.blocks) {
        if (!block.alive) continue;
        ctx.fillStyle = "#2d7c3e";
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.strokeStyle = "#7dff9b";
        ctx.strokeRect(block.x, block.y, block.w, block.h);
      }

      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(game.paddleX, paddleY, current.paddleW, PADDLE_H);
      ctx.fillRect(game.ballX, game.ballY, BALL, BALL);

      ctx.font = "700 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`BLOCKS ${game.blocks.filter((block) => block.alive).length}`, 16, 24);
      ctx.fillText(`COMBO ${game.combo}`, 16, 40);
      ctx.textAlign = "right";
      ctx.fillText(current.name, WIDTH - 16, 24);
      ctx.fillText(`${current.cols}x${current.rows} // ${Math.round(current.speed)} SPD`, WIDTH - 16, 40);

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    canvas.focus({ preventScroll: true });
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, [showFeedback]);

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
    const current = variantRef.current;
    gameRef.current.targetX = clamp(x - current.paddleW / 2, 0, WIDTH - current.paddleW);
  }

  return (
    <div className="intermission-game brick-breaker-game">
      <header className="intermission-game-instructions">
        <strong>WALL//BREAKER // {variant.name}</strong>
        <span>A/D OR ←/→ // POINTER / TOUCH // BOARD {variant.cols}x{variant.rows}</span>
        <span>BLOCK +3 // COMBO +5 // FULL CLEAR +25 // LOST BALL -3</span>
      </header>
      <div className="arcade-playfield">
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
        <ArcadeFeedback feedback={feedback} />
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>{variant.name}</strong></footer>
    </div>
  );
}
