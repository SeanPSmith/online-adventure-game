import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const WIDTH = 720;
const HEIGHT = 380;

interface Target {
  x: number;
  y: number;
  vx: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function newTarget(): Target {
  return {
    x: 170 + Math.random() * 380,
    y: 110 + Math.random() * 150,
    vx: (Math.random() < 0.5 ? -1 : 1) * (42 + Math.random() * 45),
  };
}

export function ArcheryGame({
  score,
  onScoreChange,
}: {
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const targetRef = useRef<Target>(newTarget());
  const aimRef = useRef({ x: WIDTH / 2, y: HEIGHT / 2 });
  const scoreRef = useRef(score);
  const [message, setMessage] = useState("BREATHE // LEAD THE TARGET // RELEASE_");

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  function award(delta: number) {
    const next = clamp(scoreRef.current + delta, 0, 999);
    scoreRef.current = next;
    onScoreChange(next);
  }

  function shoot() {
    const target = targetRef.current;
    const distance = Math.hypot(aimRef.current.x - target.x, aimRef.current.y - target.y);

    let points = 0;
    if (distance <= 12) points = 15;
    else if (distance <= 28) points = 10;
    else if (distance <= 48) points = 6;
    else if (distance <= 72) points = 2;

    if (points > 0) {
      award(points);
      setMessage(points === 15 ? "BULLSEYE // +15_" : `HIT // +${points}_`);
    } else {
      setMessage("MISS // THE TARGET REMAINS UNIMPRESSED_");
    }

    targetRef.current = newTarget();
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

      const target = targetRef.current;
      target.x += target.vx * dt;
      if (target.x < 90 || target.x > WIDTH - 90) {
        target.vx *= -1;
        target.x = clamp(target.x, 90, WIDTH - 90);
      }

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = "#1e6a2e";
      for (let y = 40; y < HEIGHT; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      const rings = [64, 48, 32, 16];
      ctx.strokeStyle = "#7dff9b";
      for (const radius of rings) {
        ctx.beginPath();
        ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(target.x - 3, target.y - 3, 6, 6);

      ctx.strokeStyle = "#5bcf77";
      ctx.beginPath();
      ctx.moveTo(aimRef.current.x - 12, aimRef.current.y);
      ctx.lineTo(aimRef.current.x + 12, aimRef.current.y);
      ctx.moveTo(aimRef.current.x, aimRef.current.y - 12);
      ctx.lineTo(aimRef.current.x, aimRef.current.y + 12);
      ctx.stroke();

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function pointer(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    aimRef.current = {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const key = event.key.toLowerCase();
    const aim = aimRef.current;

    if (key === "arrowleft" || key === "a") aim.x -= 12;
    else if (key === "arrowright" || key === "d") aim.x += 12;
    else if (key === "arrowup" || key === "w") aim.y -= 12;
    else if (key === "arrowdown" || key === "s") aim.y += 12;
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      shoot();
      return;
    } else return;

    event.preventDefault();
    aim.x = clamp(aim.x, 0, WIDTH);
    aim.y = clamp(aim.y, 0, HEIGHT);
  }

  return (
    <div className="intermission-game archery-game">
      <header className="intermission-game-instructions">
        <strong>ARCHERY // THE TARGET HAS SOMEWHERE TO BE</strong>
        <span>MOVE THE RETICLE WITH MOUSE/TOUCH OR WASD/ARROWS</span>
        <span>CLICK/TAP OR SPACE/ENTER TO RELEASE // CLOSER TO CENTER = MORE POINTS</span>
      </header>

      <canvas
        ref={canvasRef}
        className="arcade-canvas archery-canvas"
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        onPointerMove={pointer}
        onPointerDown={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          pointer(event);
          shoot();
        }}
        onKeyDown={keyDown}
      />

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>BULLSEYE +15</strong>
      </footer>
    </div>
  );
}
