import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const WIDTH = 720;
const HEIGHT = 380;
const GROUND = HEIGHT - 34;

interface Missile {
  x: number;
  y: number;
  tx: number;
  speed: number;
}

interface Interceptor {
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
}

interface Explosion {
  x: number;
  y: number;
  radius: number;
  life: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function MissileDefenseGame({
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
  const spawnRef = useRef(0);
  const missilesRef = useRef<Missile[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const aimRef = useRef({ x: WIDTH / 2, y: HEIGHT / 2 });
  const scoreRef = useRef(score);
  const [cities, setCities] = useState(5);
  const citiesRef = useRef(5);
  const [message, setMessage] = useState("CLICK THE SKY // DEFEND THE LINE_");

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  function award(delta: number) {
    const next = clamp(scoreRef.current + delta, 0, 999);
    scoreRef.current = next;
    onScoreChange(next);
  }

  function launch(x: number, y: number) {
    interceptorsRef.current.push({
      x: WIDTH / 2,
      y: GROUND,
      tx: clamp(x, 10, WIDTH - 10),
      ty: clamp(y, 18, GROUND - 24),
      speed: 430,
    });
    setMessage("INTERCEPTOR AWAY_");
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

      spawnRef.current -= dt;
      if (spawnRef.current <= 0) {
        missilesRef.current.push({
          x: 20 + Math.random() * (WIDTH - 40),
          y: -10,
          tx: 45 + Math.random() * (WIDTH - 90),
          speed: 44 + Math.random() * 34,
        });
        spawnRef.current = 0.55 + Math.random() * 0.7;
      }

      for (const missile of missilesRef.current) {
        const dx = missile.tx - missile.x;
        const dy = GROUND - missile.y;
        const dist = Math.hypot(dx, dy) || 1;
        missile.x += (dx / dist) * missile.speed * dt;
        missile.y += (dy / dist) * missile.speed * dt;
      }

      for (const interceptor of interceptorsRef.current) {
        const dx = interceptor.tx - interceptor.x;
        const dy = interceptor.ty - interceptor.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= interceptor.speed * dt + 2) {
          interceptor.x = interceptor.tx;
          interceptor.y = interceptor.ty;
          explosionsRef.current.push({
            x: interceptor.tx,
            y: interceptor.ty,
            radius: 2,
            life: 1,
          });
          interceptor.speed = 0;
        } else if (dist > 0) {
          interceptor.x += (dx / dist) * interceptor.speed * dt;
          interceptor.y += (dy / dist) * interceptor.speed * dt;
        }
      }
      interceptorsRef.current = interceptorsRef.current.filter((item) => item.speed > 0);

      for (const explosion of explosionsRef.current) {
        explosion.life -= dt * 0.9;
        explosion.radius = 58 * Math.sin(Math.max(0, explosion.life) * Math.PI);
      }
      explosionsRef.current = explosionsRef.current.filter((item) => item.life > 0);

      const surviving: Missile[] = [];
      let destroyed = 0;
      let impacts = 0;

      for (const missile of missilesRef.current) {
        const hit = explosionsRef.current.some(
          (explosion) => Math.hypot(missile.x - explosion.x, missile.y - explosion.y) <= explosion.radius,
        );

        if (hit) {
          destroyed += 1;
          continue;
        }

        if (missile.y >= GROUND - 3) {
          impacts += 1;
          continue;
        }

        surviving.push(missile);
      }

      missilesRef.current = surviving;

      if (destroyed > 0) {
        award(destroyed * 5);
        setMessage(`INTERCEPT // +${destroyed * 5}_`);
      }

      if (impacts > 0) {
        const nextCities = Math.max(0, citiesRef.current - impacts);
        citiesRef.current = nextCities;
        setCities(nextCities);
        award(-impacts * 2);
        setMessage(`IMPACT // ${nextCities} CITIES REMAIN // -${impacts * 2}_`);

        if (nextCities <= 0) {
          citiesRef.current = 5;
          setCities(5);
          missilesRef.current = [];
          explosionsRef.current = [];
          setMessage("LINE LOST // CIVILIZATION HAS BEEN REINSTALLED_");
        }
      }

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "#1e6a2e";
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(WIDTH, GROUND);
      ctx.stroke();

      ctx.fillStyle = "#7dff9b";
      for (let i = 0; i < citiesRef.current; i += 1) {
        const x = 70 + (i * 125);
        ctx.fillRect(x, GROUND - 13, 28, 13);
        ctx.fillRect(x + 9, GROUND - 21, 10, 8);
      }

      ctx.strokeStyle = "#7dff9b";
      for (const missile of missilesRef.current) {
        ctx.beginPath();
        ctx.moveTo(missile.x, missile.y - 7);
        ctx.lineTo(missile.x, missile.y);
        ctx.stroke();
      }

      for (const interceptor of interceptorsRef.current) {
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2, GROUND);
        ctx.lineTo(interceptor.x, interceptor.y);
        ctx.stroke();
      }

      for (const explosion of explosionsRef.current) {
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, Math.max(1, explosion.radius), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = "#5bcf77";
      ctx.beginPath();
      ctx.moveTo(aimRef.current.x - 8, aimRef.current.y);
      ctx.lineTo(aimRef.current.x + 8, aimRef.current.y);
      ctx.moveTo(aimRef.current.x, aimRef.current.y - 8);
      ctx.lineTo(aimRef.current.x, aimRef.current.y + 8);
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

    if (key === "arrowleft" || key === "a") aim.x -= 18;
    else if (key === "arrowright" || key === "d") aim.x += 18;
    else if (key === "arrowup" || key === "w") aim.y -= 18;
    else if (key === "arrowdown" || key === "s") aim.y += 18;
    else if (event.key === " ") {
      event.preventDefault();
      launch(aim.x, aim.y);
      return;
    } else return;

    event.preventDefault();
    aim.x = clamp(aim.x, 10, WIDTH - 10);
    aim.y = clamp(aim.y, 10, GROUND - 20);
  }

  return (
    <div className="intermission-game missile-game">
      <header className="intermission-game-instructions">
        <strong>MISSILE DEFENSE // MAKE THE SKY SOMEONE ELSE'S PROBLEM</strong>
        <span>CLICK/TAP THE SKY TO DETONATE AN INTERCEPTOR // CHAIN EXPLOSIONS</span>
        <span>WASD/ARROWS MOVE RETICLE // SPACE FIRES // INTERCEPT +5 // IMPACT -2</span>
      </header>

      <canvas
        ref={canvasRef}
        className="arcade-canvas missile-canvas"
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        onPointerMove={pointer}
        onPointerDown={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          pointer(event);
          launch(aimRef.current.x, aimRef.current.y);
        }}
        onKeyDown={keyDown}
      />

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>CITIES {cities}/5</strong>
      </footer>
    </div>
  );
}
