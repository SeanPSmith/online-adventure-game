import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import type { ArcadeGameProps } from "../arcade/arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../arcade/engine/ArcadeFeedback";

const WIDTH = 66;
const HEIGHT = 19;
const MIN_SURFACE_Y = 9;
const MAX_SURFACE_Y = HEIGHT - 3;

interface Point {
  x: number;
  y: number;
}

interface Battlefield {
  terrain: number[];
  playerX: number;
  enemyX: number;
  wind: number;
  seed: number;
}

interface ShotResult {
  points: Point[];
  hit: boolean;
  impact: Point | null;
  impactKind: "target" | "terrain" | "bounds";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(turnNumber: number, fieldIndex: number, salt = 0) {
  return (
    Math.imul(Math.max(1, turnNumber), 0x45d9f3b) ^
    Math.imul(fieldIndex + 1, 0x119de1f3) ^
    Math.imul(salt + 17, 0x27d4eb2d)
  ) >>> 0;
}

function flattenPlatform(terrain: number[], center: number, width = 2) {
  const start = clamp(center - width, 1, WIDTH - 2);
  const end = clamp(center + width, 1, WIDTH - 2);
  const platformY = Math.round(
    terrain.slice(start, end + 1).reduce((total, value) => total + value, 0) /
      Math.max(1, end - start + 1),
  );
  for (let x = start; x <= end; x += 1) terrain[x] = platformY;
}

function generateTerrain(random: () => number) {
  const terrain = Array.from({ length: WIDTH }, () => MAX_SURFACE_Y);
  let surface = 13 + Math.floor(random() * 3);

  for (let x = 0; x < WIDTH; x += 1) {
    if (x % 2 === 0) {
      const step = random() < 0.28 ? -1 : random() > 0.72 ? 1 : 0;
      surface = clamp(surface + step, MIN_SURFACE_Y, MAX_SURFACE_Y);
    }
    terrain[x] = surface;
  }

  return terrain;
}

function createBattlefield(turnNumber: number, fieldIndex: number): Battlefield {
  const seed = mixSeed(turnNumber, fieldIndex);
  const random = seededRandom(seed);
  const terrain = generateTerrain(random);
  const playerX = 4 + Math.floor(random() * 8);
  const enemyX = 48 + Math.floor(random() * 13);
  flattenPlatform(terrain, playerX);
  flattenPlatform(terrain, enemyX);
  const wind = Math.floor(random() * 13) - 6;
  return { terrain, playerX, enemyX, wind, seed };
}

function relocateTarget(
  terrain: number[],
  seed: number,
  exchangeIndex: number,
  previousX: number,
) {
  const random = seededRandom(mixSeed(seed || 1, exchangeIndex + 1, 91));
  const candidates = Array.from({ length: 14 }, (_, index) => 47 + index)
    .filter((x) => Math.abs(x - previousX) >= 4);
  const nextX = candidates[Math.floor(random() * candidates.length)] ?? 55;
  flattenPlatform(terrain, nextX, 1);
  return nextX;
}

function simulateTrajectory({
  angle,
  power,
  wind,
  playerX,
  enemyX,
  terrain,
}: {
  angle: number;
  power: number;
  wind: number;
  playerX: number;
  enemyX: number;
  terrain: number[];
}): ShotResult {
  const radians = (angle * Math.PI) / 180;
  const speed = power * 0.29;
  const vx = Math.cos(radians) * speed;
  const vy = Math.sin(radians) * speed;
  const gravity = 6.0;
  const windAcceleration = wind * 0.045;
  const startX = playerX;
  const startY = terrain[playerX] - 2;
  const enemyY = terrain[enemyX] - 1;
  const points: Point[] = [];
  let impact: Point | null = null;
  let impactKind: ShotResult["impactKind"] = "bounds";

  for (let t = 0.04; t <= 8; t += 0.04) {
    const rawX = startX + (vx * t) + (0.5 * windAcceleration * t * t);
    const rise = (vy * t) - (0.5 * gravity * t * t);
    const rawY = startY - rise;
    const point = { x: Math.round(rawX), y: Math.round(rawY) };

    if (point.x >= WIDTH - 1 || point.x < 1) {
      impact = point;
      impactKind = "bounds";
      break;
    }

    if (point.y >= 1 && point.y < HEIGHT - 1) points.push(point);

    if (
      Math.abs(point.x - enemyX) <= 1 &&
      Math.abs(point.y - enemyY) <= 1
    ) {
      impact = point;
      impactKind = "target";
      return { points, hit: true, impact, impactKind };
    }

    const surfaceY = terrain[clamp(point.x, 0, WIDTH - 1)];
    if (t > 0.16 && point.y >= surfaceY) {
      impact = { x: point.x, y: surfaceY };
      impactKind = "terrain";
      break;
    }
  }

  return { points, hit: false, impact, impactKind };
}

function renderField({
  terrain,
  playerX,
  enemyX,
  projectile,
  trace,
  impact,
  playerHp,
  enemyHp,
}: {
  terrain: number[];
  playerX: number;
  enemyX: number;
  projectile: Point | null;
  trace: Point[];
  impact: Point | null;
  playerHp: number;
  enemyHp: number;
}) {
  const cells = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => " "),
  );

  for (let x = 0; x < WIDTH; x += 1) {
    for (let y = terrain[x]; y < HEIGHT; y += 1) {
      cells[y][x] = y === terrain[x] ? "▄" : "▓";
    }
  }

  for (const point of trace) {
    if (
      point.y > 0 && point.y < HEIGHT &&
      point.x > 0 && point.x < WIDTH - 1 &&
      point.y < terrain[point.x]
    ) {
      cells[point.y][point.x] = "·";
    }
  }

  cells[terrain[playerX] - 1][playerX] = playerHp > 0 ? "A" : "x";
  cells[terrain[enemyX] - 1][enemyX] = enemyHp > 0 ? "M" : "x";

  if (
    impact &&
    impact.x > 0 && impact.x < WIDTH - 1 &&
    impact.y > 0 && impact.y < HEIGHT
  ) {
    cells[impact.y][impact.x] = "×";
  }

  if (
    projectile &&
    projectile.y > 0 && projectile.y < HEIGHT &&
    projectile.x > 0 && projectile.x < WIDTH - 1
  ) {
    cells[projectile.y][projectile.x] = "●";
  }

  const border = `╔${"═".repeat(WIDTH)}╗`;
  return [
    border,
    ...cells.map((row) => `║${row.join("")}║`),
    `╚${"═".repeat(WIDTH)}╝`,
  ].join("\n");
}

export function ProjectileDuelGame({
  score,
  onScoreChange,
  storyReady,
  turnNumber,
  playMode,
}: ArcadeGameProps) {
  const { feedback, showFeedback } = useArcadeFeedback(1200);
  const initialBattlefield = useMemo(() => createBattlefield(turnNumber, 0), [turnNumber]);
  const [fieldIndex, setFieldIndex] = useState(0);
  const [terrain, setTerrain] = useState(() => [...initialBattlefield.terrain]);
  const [playerX, setPlayerX] = useState(initialBattlefield.playerX);
  const [enemyX, setEnemyX] = useState(initialBattlefield.enemyX);
  const [wind, setWind] = useState(initialBattlefield.wind);
  const [battlefieldSeed, setBattlefieldSeed] = useState(initialBattlefield.seed);
  const [exchangeIndex, setExchangeIndex] = useState(0);
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(68);
  const [playerHp, setPlayerHp] = useState(3);
  const [enemyHp, setEnemyHp] = useState(3);
  const [projectile, setProjectile] = useState<Point | null>(null);
  const [trace, setTrace] = useState<Point[]>([]);
  const [impact, setImpact] = useState<Point | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("READ THE TERRAIN // DIAL IT IN // FIRE_");

  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyReadyRef = useRef(storyReady);
  const scoreRef = useRef(score);
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    storyReadyRef.current = storyReady;
    if (storyReady && !busy) setMessage("STORY READY // LAST SHOTS COUNT UNTIL ZERO_");
  }, [storyReady, busy]);

  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true });
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const loadBattlefield = useCallback((nextFieldIndex: number) => {
    const next = createBattlefield(turnNumber, nextFieldIndex);
    setFieldIndex(nextFieldIndex);
    setTerrain([...next.terrain]);
    setPlayerX(next.playerX);
    setEnemyX(next.enemyX);
    setWind(next.wind);
    setBattlefieldSeed(next.seed);
    setExchangeIndex(0);
    setProjectile(null);
    setTrace([]);
    setImpact(null);
  }, [turnNumber]);

  const resetExchange = useCallback((enemyDefeated = false, playerDefeated = false) => {
    setProjectile(null);
    setTrace([]);
    setImpact(null);

    if (enemyDefeated || playerDefeated) {
      loadBattlefield(fieldIndex + 1);
      if (enemyDefeated) setEnemyHp(3);
      if (playerDefeated) setPlayerHp(3);
    } else {
      const nextExchange = exchangeIndex + 1;
      const nextTerrain = [...terrain];
      const nextEnemyX = relocateTarget(nextTerrain, battlefieldSeed, nextExchange, enemyX);
      setTerrain(nextTerrain);
      setEnemyX(nextEnemyX);
      setExchangeIndex(nextExchange);
    }

    setBusy(false);
    if (!storyReadyRef.current) {
      setMessage(enemyDefeated || playerDefeated
        ? "NEW TERRAIN // NEW FIRING SOLUTION_"
        : "TARGET RELOCATED // RECALCULATE AND FIRE_");
    }
  }, [battlefieldSeed, enemyX, exchangeIndex, fieldIndex, loadBattlefield, terrain]);

  const resolveShot = useCallback((shot: ShotResult) => {
    setImpact(shot.impact);

    if (shot.hit) {
      const nextEnemyHp = enemyHp - 1;
      setEnemyHp(nextEnemyHp);
      const reward = nextEnemyHp <= 0 ? 25 : 10;
      const nextScore = Math.min(999, scoreRef.current + reward);
      scoreRef.current = nextScore;
      onScoreChange(nextScore);

      if (nextEnemyHp <= 0) {
        setMessage("DIRECT HIT // TARGET DOWN // NEW BATTLEFIELD INCOMING_");
        showFeedback({ title: "TARGET DOWN", detail: "DIRECT HIT // TERRAIN RESET", delta: reward, tone: "great" }, 1450);
        settleTimerRef.current = setTimeout(() => resetExchange(true, false), 1750);
      } else {
        setMessage(`DIRECT HIT // TARGET ARMOR ${nextEnemyHp}/3 // RELOCATING_`);
        showFeedback({ title: "DIRECT HIT", detail: `TARGET RELOCATING // ARMOR ${nextEnemyHp}/3`, delta: reward, tone: "good" });
        settleTimerRef.current = setTimeout(() => resetExchange(false, false), 1350);
      }
      return;
    }

    const nextPlayerHp = playerHp - 1;
    setPlayerHp(nextPlayerHp);
    const missDetail = shot.impactKind === "terrain" ? "TERRAIN IMPACT" : "SHOT WIDE";

    if (nextPlayerHp <= 0) {
      const nextScore = Math.max(0, scoreRef.current - 5);
      scoreRef.current = nextScore;
      onScoreChange(nextScore);
      setMessage(`${missDetail} // RETURN FIRE FLATTENS YOU // -5_`);
      showFeedback({ title: "YOU GOT FLATTENED", detail: `${missDetail} // NEW FIELD`, delta: -5, tone: "bad" }, 1350);
      settleTimerRef.current = setTimeout(() => resetExchange(false, true), 1800);
    } else {
      setMessage(`${missDetail} // RETURN FIRE CONNECTS // TARGET RELOCATING_`);
      showFeedback({ title: "MISS", detail: `${missDetail} // ARMOR ${nextPlayerHp}/3`, tone: "bad" });
      settleTimerRef.current = setTimeout(() => resetExchange(false, false), 1400);
    }
  }, [enemyHp, onScoreChange, playerHp, resetExchange, showFeedback]);

  const fire = useCallback(() => {
    if (busy) return;

    setBusy(true);
    setMessage("SHOT AWAY_");
    setTrace([]);
    setImpact(null);

    const shot = simulateTrajectory({ angle, power, wind, playerX, enemyX, terrain });
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reduceMotion) {
      const finalPoint = shot.points.at(-1) ?? null;
      setProjectile(finalPoint);
      setTrace(shot.points.slice(0, -1));
      settleTimerRef.current = setTimeout(() => resolveShot(shot), 160);
      return;
    }

    let index = 0;
    const advance = () => {
      const point = shot.points[index];
      if (!point) {
        setProjectile(null);
        resolveShot(shot);
        return;
      }

      setProjectile(point);
      setTrace((current) => [...current.slice(-52), point]);
      index += 1;
      animationTimerRef.current = setTimeout(advance, 22);
    };

    advance();
  }, [angle, busy, enemyX, playerX, power, resolveShot, terrain, wind]);

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
    () => renderField({ terrain, playerX, enemyX, projectile, trace, impact, playerHp, enemyHp }),
    [enemyHp, enemyX, impact, playerHp, playerX, projectile, terrain, trace],
  );

  return (
    <div className="intermission-game projectile-game">
      <header className="intermission-game-instructions">
        <strong>GORILLA ARTILLERY // TERRAIN BALLISTICS</strong>
        <span>{playMode === "coop" ? "2 PLAYER // BALLISTIC MATCH" : "SOLO // MACHINE DUEL"}</span>
        <span>W/S OR ↑/↓ ANGLE // A/D OR ←/→ POWER // SPACE TO FIRE</span>
      </header>

      <div className="arcade-playfield">
        <div className="projectile-field-wrap" ref={fieldRef} tabIndex={0} onKeyDown={handleKeyDown}>
          <div className="projectile-hud-line">
            <span>YOU [{"#".repeat(playerHp)}{".".repeat(3 - playerHp)}]</span>
            <span>FIELD {fieldIndex + 1} // WIND {wind >= 0 ? "+" : ""}{wind}</span>
            <span>TARGET [{"#".repeat(enemyHp)}{".".repeat(3 - enemyHp)}]</span>
          </div>
          <pre className="projectile-ascii-field" aria-label="Ballistic terrain field">{field}</pre>
        </div>
        <ArcadeFeedback feedback={feedback} />
      </div>

      <div className="projectile-controls">
        <label>
          <span>ANGLE // {angle}°</span>
          <input type="range" min="15" max="75" value={angle} disabled={busy} onChange={(event) => setAngle(Number(event.target.value))} />
        </label>

        <label>
          <span>POWER // {power}</span>
          <input type="range" min="25" max="100" value={power} disabled={busy} onChange={(event) => setPower(Number(event.target.value))} />
        </label>

        <button className="button button-primary projectile-fire" type="button" disabled={busy} onClick={fire}>
          {busy ? "IN FLIGHT_" : "FIRE"}
        </button>
      </div>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>TERRAIN BLOCKS SHOTS // TARGET RELOCATES EVERY VOLLEY</strong>
      </footer>
    </div>
  );
}
