import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const WIDTH = 720;
const HEIGHT = 360;
const PADDLE_W = 12;
const PADDLE_H = 82;
const BALL = 10;

interface GameState {
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  playerY: number;
  aiY: number;
  keys: Set<string>;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function freshState(): GameState {
  return {
    ballX: WIDTH / 2,
    ballY: HEIGHT / 2,
    ballVX: -260,
    ballVY: 135,
    playerY: (HEIGHT - PADDLE_H) / 2,
    aiY: (HEIGHT - PADDLE_H) / 2,
    keys: new Set(),
  };
}

export function PongGame({
  score,
  onScoreChange,
}: {
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameState>(freshState());
  const scoreRef = useRef(score);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [message, setMessage] = useState("KEEP IT OFF YOUR WALL_");

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  function award(delta: number) {
    const next = clamp(scoreRef.current + delta, 0, 999);
    scoreRef.current = next;
    onScoreChange(next);
  }

  function resetBall(direction: 1 | -1) {
    const game = gameRef.current;
    game.ballX = WIDTH / 2;
    game.ballY = HEIGHT / 2;
    game.ballVX = 255 * direction;
    game.ballVY = (Math.random() * 220) - 110;
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
      const speed = 320;

      if (game.keys.has("arrowup") || game.keys.has("w")) {
        game.playerY -= speed * dt;
      }
      if (game.keys.has("arrowdown") || game.keys.has("s")) {
        game.playerY += speed * dt;
      }
      game.playerY = clamp(game.playerY, 0, HEIGHT - PADDLE_H);

      const aiTarget = game.ballY - (PADDLE_H / 2);
      const aiDelta = clamp(aiTarget - game.aiY, -225 * dt, 225 * dt);
      game.aiY = clamp(game.aiY + aiDelta, 0, HEIGHT - PADDLE_H);

      game.ballX += game.ballVX * dt;
      game.ballY += game.ballVY * dt;

      if (game.ballY <= 0 && game.ballVY < 0) {
        game.ballY = 0;
        game.ballVY *= -1;
      } else if (game.ballY >= HEIGHT - BALL && game.ballVY > 0) {
        game.ballY = HEIGHT - BALL;
        game.ballVY *= -1;
      }

      const playerX = 24;
      if (
        game.ballVX < 0 &&
        game.ballX <= playerX + PADDLE_W &&
        game.ballX + BALL >= playerX &&
        game.ballY + BALL >= game.playerY &&
        game.ballY <= game.playerY + PADDLE_H
      ) {
        game.ballX = playerX + PADDLE_W;
        game.ballVX = Math.abs(game.ballVX) * 1.035;
        const offset = ((game.ballY + BALL / 2) - (game.playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
        game.ballVY += offset * 120;
        award(1);
        setMessage("RETURNED // +1_");
      }

      const aiX = WIDTH - 24 - PADDLE_W;
      if (
        game.ballVX > 0 &&
        game.ballX + BALL >= aiX &&
        game.ballX <= aiX + PADDLE_W &&
        game.ballY + BALL >= game.aiY &&
        game.ballY <= game.aiY + PADDLE_H
      ) {
        game.ballX = aiX - BALL;
        game.ballVX = -Math.abs(game.ballVX) * 1.025;
        const offset = ((game.ballY + BALL / 2) - (game.aiY + PADDLE_H / 2)) / (PADDLE_H / 2);
        game.ballVY += offset * 95;
      }

      if (game.ballX > WIDTH + 20) {
        award(10);
        setMessage("BREACH // +10_");
        resetBall(-1);
      } else if (game.ballX < -30) {
        award(-2);
        setMessage("YOUR WALL LEAKED // -2_");
        resetBall(1);
      }

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#1e6a2e";
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 0);
      ctx.lineTo(WIDTH / 2, HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(playerX, game.playerY, PADDLE_W, PADDLE_H);
      ctx.fillRect(aiX, game.aiY, PADDLE_W, PADDLE_H);
      ctx.fillRect(game.ballX, game.ballY, BALL, BALL);

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "w", "s"].includes(key)) {
      event.preventDefault();
      gameRef.current.keys.add(key);
    }
  }

  function keyUp(event: KeyboardEvent<HTMLCanvasElement>) {
    gameRef.current.keys.delete(event.key.toLowerCase());
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    gameRef.current.playerY = clamp(y - PADDLE_H / 2, 0, HEIGHT - PADDLE_H);
  }

  return (
    <div className="intermission-game pong-game">
      <header className="intermission-game-instructions">
        <strong>TERMINAL PONG // DO NOT LET THE SIGNAL THROUGH</strong>
        <span>W/S OR ↑/↓ // MOUSE OR TOUCH TRACKS THE LEFT PADDLE</span>
        <span>RETURN +1 // SCORE AGAINST THE MACHINE +10 // MISS -2</span>
      </header>

      <canvas
        ref={canvasRef}
        className="arcade-canvas pong-canvas"
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onPointerMove={pointerMove}
        onPointerDown={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          pointerMove(event);
        }}
      />

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>YOU ARE THE LEFT PADDLE</strong>
      </footer>
    </div>
  );
}
