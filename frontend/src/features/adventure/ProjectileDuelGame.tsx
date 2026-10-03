import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { ArcadeFeedback, useArcadeFeedback } from "../arcade/engine/ArcadeFeedback";

const WIDTH = 66;
const HEIGHT = 17;
const GROUND_Y = HEIGHT - 2;

interface Point {
  x: number;
  y: number;
}

function randomEnemyX() {
  return 48 + Math.floor(Math.random() * 14);
}

function randomWind() {
  return Math.floor(Math.random() * 13) - 6;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function trajectory(angle: number, power: number, wind: number, enemyX: number) {
  const radians = (angle * Math.PI) / 180;
  const speed = power * 0.28;
  const vx = Math.cos(radians) * speed;
  const vy = Math.sin(radians) * speed;
  const gravity = 6.0;
  const windAcceleration = wind * 0.045;
  const startX = 3;
  const startY = GROUND_Y - 2;
  const points: Point[] = [];
  let hit = false;

  for (let t = 0.04; t <= 8; t += 0.04) {
    const x = startX + (vx * t) + (0.5 * windAcceleration * t * t);
    const rise = (vy * t) - (0.5 * gravity * t * t);
    const y = startY - rise;

    if (x >= WIDTH - 1) break;
    if (x < 1) continue;

    const point = {
      x: Math.round(x),
      y: Math.round(y),
    };

    // Keep off-screen apex points out of the draw list, but keep simulating
    // so high-angle shots can come back down into the field.
    if (point.y >= 1 && point.y <= GROUND_Y) {
      points.push(point);
    }

    if (
      Math.abs(point.x - enemyX) <= 1 &&
      point.y >= GROUND_Y - 3 &&
      point.y <= GROUND_Y
    ) {
      hit = true;
      break;
    }

    if (t > 0.18 && point.y >= GROUND_Y) break;
  }

  return { points, hit };
}

function renderField({
  enemyX,
  projectile,
  trace,
  playerHp,
  enemyHp,
}: {
  enemyX: number;
  projectile: Point | null;
  trace: Point[];
  playerHp: number;
  enemyHp: number;
}) {
  const cells = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => " "),
  );

  for (let x = 0; x < WIDTH; x += 1) {
    cells[GROUND_Y][x] = "_";
  }

  for (const point of trace) {
    if (
      point.y > 0 && point.y < GROUND_Y &&
      point.x > 0 && point.x < WIDTH - 1
    ) {
      cells[point.y][point.x] = ".";
    }
  }

  cells[GROUND_Y - 1][2] = playerHp > 0 ? "A" : "x";
  cells[GROUND_Y - 1][enemyX] = enemyHp > 0 ? "M" : "x";

  if (
    projectile &&
    projectile.y > 0 && projectile.y < GROUND_Y + 1 &&
    projectile.x > 0 && projectile.x < WIDTH - 1
  ) {
    cells[projectile.y][projectile.x] = "*";
  }

  const border = `+${"-".repeat(WIDTH)}+`;
  return [
    border,
    ...cells.map((row) => `|${row.join("")}|`),
    border,
  ].join("\n");
}

export function ProjectileDuelGame({
  score,
  onScoreChange,
  storyReady,
}: {
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
}) {
  const { feedback, showFeedback } = useArcadeFeedback(1200);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(68);
  const [wind, setWind] = useState(() => randomWind());
  const [enemyX, setEnemyX] = useState(() => randomEnemyX());
  const [playerHp, setPlayerHp] = useState(3);
  const [enemyHp, setEnemyHp] = useState(3);
  const [projectile, setProjectile] = useState<Point | null>(null);
  const [trace, setTrace] = useState<Point[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("DIAL IT IN // THEN FIRE_");

  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyReadyRef = useRef(storyReady);
  const scoreRef = useRef(score);
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    storyReadyRef.current = storyReady;
    if (storyReady && !busy) {
      setMessage("STORY READY // LAST SHOTS COUNT UNTIL ZERO_");
    }
  }, [storyReady, busy]);

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true });
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const resetExchange = useCallback((enemyDefeated = false, playerDefeated = false) => {
    setProjectile(null);
    setTrace([]);

    if (enemyDefeated) {
      setEnemyHp(3);
      setEnemyX(randomEnemyX());
      setWind(randomWind());
    }

    if (playerDefeated) {
      setPlayerHp(3);
    }

    setBusy(false);

    if (!storyReadyRef.current) {
      setMessage("NEXT VOLLEY // ADJUST AND FIRE_");
    }
  }, []);

  const resolveShot = useCallback((hit: boolean) => {
    if (hit) {
      const nextEnemyHp = enemyHp - 1;
      setEnemyHp(nextEnemyHp);
      const nextScore = Math.min(999, scoreRef.current + (nextEnemyHp <= 0 ? 25 : 10));
      scoreRef.current = nextScore;
      onScoreChange(nextScore);

      if (nextEnemyHp <= 0) {
        setMessage("DIRECT HIT // TARGET DOWN // +25_");
        showFeedback({ title: "TARGET DOWN", detail: "DIRECT HIT // MACHINE FLATTENED", delta: 25, tone: "great" }, 1450);
        settleTimerRef.current = setTimeout(
          () => resetExchange(true, false),
          520,
        );
      } else {
        setMessage(`DIRECT HIT // ENEMY ARMOR ${nextEnemyHp}/3 // +10_`);
        showFeedback({ title: "DIRECT HIT", detail: `ENEMY ARMOR ${nextEnemyHp}/3`, delta: 10, tone: "good" });
        settleTimerRef.current = setTimeout(
          () => resetExchange(false, false),
          420,
        );
      }
      return;
    }

    const nextPlayerHp = playerHp - 1;
    setPlayerHp(nextPlayerHp);

    if (nextPlayerHp <= 0) {
      const nextScore = Math.max(0, scoreRef.current - 5);
      scoreRef.current = nextScore;
      onScoreChange(nextScore);
      setMessage("RETURN FIRE // YOU GOT FLATTENED // -5_");
      showFeedback({ title: "YOU GOT FLATTENED", detail: "RETURN FIRE CONNECTED", delta: -5, tone: "bad" }, 1350);
      settleTimerRef.current = setTimeout(
        () => resetExchange(false, true),
        620,
      );
    } else {
      setMessage(`MISS // RETURN FIRE CONNECTS // ARMOR ${nextPlayerHp}/3_`);
      showFeedback({ title: "MISS", detail: `RETURN FIRE // ARMOR ${nextPlayerHp}/3`, tone: "bad" });
      settleTimerRef.current = setTimeout(
        () => resetExchange(false, false),
        480,
      );
    }
  }, [enemyHp, playerHp, onScoreChange, resetExchange, showFeedback]);

  const fire = useCallback(() => {
    if (busy) return;

    setBusy(true);
    setMessage("SHOT AWAY_\n");
    setTrace([]);

    const shot = trajectory(angle, power, wind, enemyX);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reduceMotion) {
      const finalPoint = shot.points.at(-1) ?? null;
      setProjectile(finalPoint);
      setTrace(shot.points.slice(0, -1));
      settleTimerRef.current = setTimeout(
        () => resolveShot(shot.hit),
        160,
      );
      return;
    }

    let index = 0;
    const advance = () => {
      const point = shot.points[index];

      if (!point) {
        setProjectile(null);
        resolveShot(shot.hit);
        return;
      }

      setProjectile(point);
      setTrace((current) => [...current.slice(-44), point]);
      index += 1;
      animationTimerRef.current = setTimeout(advance, 24);
    };

    advance();
  }, [busy, angle, power, wind, enemyX, resolveShot]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();

    if (event.key === "ArrowUp" || key === "w") {
      event.preventDefault();
      setAngle((value) => clamp(value + 2, 15, 75));
    } else if (event.key === "ArrowDown" || key === "s") {
      event.preventDefault();
      setAngle((value) => clamp(value - 2, 15, 75));
    } else if (event.key === "ArrowRight" || key === "d") {
      event.preventDefault();
      setPower((value) => clamp(value + 2, 25, 100));
    } else if (event.key === "ArrowLeft" || key === "a") {
      event.preventDefault();
      setPower((value) => clamp(value - 2, 25, 100));
    } else if (event.key === " ") {
      event.preventDefault();
      fire();
    }
  }

  const field = useMemo(
    () => renderField({ enemyX, projectile, trace, playerHp, enemyHp }),
    [enemyX, projectile, trace, playerHp, enemyHp],
  );

  return (
    <div className="intermission-game projectile-game">
      <header className="intermission-game-instructions">
        <strong>ASCII ARTILLERY // DROP THE OTHER MACHINE BEFORE IT DROPS YOU</strong>
        <span>W/S OR ↑/↓ ANGLE // A/D OR ←/→ POWER // SPACE TO FIRE</span>
        <span>TOUCH/MOUSE // USE THE SLIDERS + FIRE BUTTON</span>
      </header>

      <div className="arcade-playfield">
        <div
          className="projectile-field-wrap"
          ref={fieldRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
        <div className="projectile-hud-line">
          <span>YOU [{"#".repeat(playerHp)}{".".repeat(3 - playerHp)}]</span>
          <span>WIND {wind >= 0 ? "+" : ""}{wind}</span>
          <span>THEM [{"#".repeat(enemyHp)}{".".repeat(3 - enemyHp)}]</span>
        </div>
        <pre className="projectile-ascii-field">{field}</pre>
        </div>
        <ArcadeFeedback feedback={feedback} />
      </div>

      <div className="projectile-controls">
        <label>
          <span>ANGLE // {angle}°</span>
          <input
            type="range"
            min="15"
            max="75"
            value={angle}
            disabled={busy}
            onChange={(event) => setAngle(Number(event.target.value))}
          />
        </label>

        <label>
          <span>POWER // {power}</span>
          <input
            type="range"
            min="25"
            max="100"
            value={power}
            disabled={busy}
            onChange={(event) => setPower(Number(event.target.value))}
          />
        </label>

        <button
          className="button button-primary projectile-fire"
          type="button"
          disabled={busy}
          onClick={fire}
        >
          {busy ? "IN FLIGHT_" : "FIRE"}
        </button>
      </div>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>HITS PAY // DEFEATS PAY MORE</strong>
      </footer>
    </div>
  );
}
