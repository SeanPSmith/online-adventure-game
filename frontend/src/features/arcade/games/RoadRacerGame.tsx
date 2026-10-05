import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 380;
const PLAYER_Y = HEIGHT - 72;
const ROAD_LEFT = 112;
const ROAD_RIGHT = WIDTH - 112;
const PLAYER_W = 38;
const PLAYER_H = 58;

interface RoadVariant {
  name: string;
  lanes: number;
  startSpeed: number;
  maxSpeed: number;
  acceleration: number;
  spawnBase: number;
  trafficMin: number;
}

const ROAD_VARIANTS: RoadVariant[] = [
  { name: "CRUISE", lanes: 3, startSpeed: 205, maxSpeed: 390, acceleration: 7.2, spawnBase: 1.1, trafficMin: 0.46 },
  { name: "RUSH HOUR", lanes: 4, startSpeed: 225, maxSpeed: 420, acceleration: 7.8, spawnBase: 0.9, trafficMin: 0.39 },
  { name: "NIGHT RUN", lanes: 3, startSpeed: 250, maxSpeed: 455, acceleration: 8.5, spawnBase: 0.76, trafficMin: 0.34 },
];

interface TrafficCar {
  lane: number;
  y: number;
  speed: number;
  passed: boolean;
  contacted: boolean;
  closestClearance: number;
}

interface RacerState {
  x: number;
  targetX: number;
  speed: number;
  roadOffset: number;
  spawnTimer: number;
  traffic: TrafficCar[];
  keys: Set<string>;
  crashedUntil: number;
  passStreak: number;
  runSeconds: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function laneX(lane: number, laneCount: number) {
  const usable = ROAD_RIGHT - ROAD_LEFT;
  return ROAD_LEFT + usable * ((lane + 0.5) / laneCount);
}

function freshState(variant: RoadVariant): RacerState {
  return {
    x: WIDTH / 2,
    targetX: WIDTH / 2,
    speed: variant.startSpeed,
    roadOffset: 0,
    spawnTimer: 0.45,
    traffic: [],
    keys: new Set(),
    crashedUntil: 0,
    passStreak: 0,
    runSeconds: 0,
  };
}

export function RoadRacerGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [variant] = useState<RoadVariant>(() => ROAD_VARIANTS[Math.floor(Math.random() * ROAD_VARIANTS.length)]);
  const { feedback, showFeedback } = useArcadeFeedback(520);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RacerState>(freshState(variant));
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [message, setMessage] = useState("KEEP IT BETWEEN THE LINES // PASS EVERYTHING_");
  const coarsePointer = typeof window !== "undefined"
    && window.matchMedia?.("(pointer: coarse)").matches;
  const motionScale = coarsePointer ? 0.82 : 1;

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => {
    if (storyReady) setMessage("STORY READY // FINISH THE RUN CLEAN_");
  }, [storyReady]);

  function award(delta: number) {
    const next = clamp(scoreRef.current + delta, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
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
      const worldDt = dt * motionScale;

      const steer = 330;
      if (game.keys.has("arrowleft") || game.keys.has("a")) game.targetX -= steer * dt;
      if (game.keys.has("arrowright") || game.keys.has("d")) game.targetX += steer * dt;
      game.targetX = clamp(game.targetX, ROAD_LEFT + PLAYER_W / 2 + 8, ROAD_RIGHT - PLAYER_W / 2 - 8);
      game.x += (game.targetX - game.x) * Math.min(1, dt * 12);

      game.runSeconds += worldDt;
      const difficulty = clamp(game.runSeconds / 42, 0, 1);
      const acceleration = variant.acceleration * (1 + difficulty * 0.5);
      game.speed = clamp(game.speed + worldDt * acceleration, variant.startSpeed, variant.maxSpeed);
      game.roadOffset = (game.roadOffset + game.speed * worldDt) % 52;
      game.spawnTimer -= worldDt;

      if (game.spawnTimer <= 0) {
        const lane = Math.floor(Math.random() * variant.lanes);
        game.traffic.push({
          lane,
          y: -72,
          speed: game.speed * (0.76 + Math.random() * 0.22 + difficulty * 0.05),
          passed: false,
          contacted: false,
          closestClearance: Number.POSITIVE_INFINITY,
        });
        const speedPressure = (game.speed - variant.startSpeed) / Math.max(1, variant.maxSpeed - variant.startSpeed);
        game.spawnTimer = Math.max(
          variant.trafficMin * 0.72,
          variant.spawnBase - speedPressure * 0.3 - difficulty * 0.28,
        ) + Math.random() * 0.2;
      }

      const now = performance.now();
      const canCrash = now >= game.crashedUntil;
      for (const car of game.traffic) {
        car.y += car.speed * worldDt;
        const x = laneX(car.lane, variant.lanes);
        const centerDistance = Math.abs(game.x - x);
        const collisionDistance = (PLAYER_W + 34) / 2;
        const overlapX = centerDistance < collisionDistance;
        const overlapY = car.y + 50 > PLAYER_Y && car.y < PLAYER_Y + PLAYER_H;
        const dangerBandY = car.y + 50 > PLAYER_Y - 18 && car.y < PLAYER_Y + PLAYER_H + 18;

        if (dangerBandY && !car.contacted) {
          car.closestClearance = Math.min(
            car.closestClearance,
            Math.max(0, centerDistance - collisionDistance),
          );
        }

        if (canCrash && !car.contacted && overlapX && overlapY) {
          car.contacted = true;
          game.crashedUntil = now + 850;
          game.speed = Math.max(variant.startSpeed, game.speed - 42);
          game.targetX = WIDTH / 2;
          game.passStreak = 0;
          award(-7);
          setMessage("CONTACT // -7 // CAR RECOVERING_");
          showFeedback({ title: "CONTACT!", detail: "STREAK LOST", delta: -7, tone: "bad" }, 720);
        }

        if (!car.passed && car.y > PLAYER_Y + PLAYER_H) {
          car.passed = true;
          if (car.contacted) continue;

          game.passStreak += 1;
          const clearance = Number.isFinite(car.closestClearance) ? car.closestClearance : 99;
          const streakBonus = game.passStreak > 0 && game.passStreak % 5 === 0 ? 3 : 0;
          const pass = clearance <= 5
            ? { title: "THREAD THE NEEDLE", base: 10, tone: "great" as const, label: "NEAR MISS" }
            : clearance <= 14
              ? { title: "CLOSE CALL", base: 7, tone: "great" as const, label: "RISKY PASS" }
              : clearance <= 28
                ? { title: "RISKY PASS", base: 5, tone: "good" as const, label: "TIGHT CLEARANCE" }
                : { title: "CLEAN PASS", base: 3, tone: "good" as const, label: "CLEAR" };
          const delta = pass.base + streakBonus;
          award(delta);
          const clearanceLabel = clearance < 90 ? `${Math.max(1, Math.round(clearance))}PX CLEAR` : `SPEED ${Math.round(game.speed)} KPH`;
          setMessage(`${pass.label} // +${delta}${streakBonus ? " // x5 STREAK" : ""}_`);
          showFeedback({
            title: streakBonus ? `PASS STREAK x5 // ${pass.title}` : pass.title,
            detail: clearanceLabel,
            delta,
            tone: pass.tone,
          }, pass.base >= 7 || streakBonus ? 760 : 420);
        }
      }
      game.traffic = game.traffic.filter((car) => car.y < HEIGHT + 90);

      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#061106";
      ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT);
      ctx.strokeStyle = "#3aa653";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ROAD_LEFT, 0);
      ctx.lineTo(ROAD_LEFT, HEIGHT);
      ctx.moveTo(ROAD_RIGHT, 0);
      ctx.lineTo(ROAD_RIGHT, HEIGHT);
      ctx.stroke();

      ctx.strokeStyle = "#1d5b2b";
      ctx.lineWidth = 4;
      for (let lane = 1; lane < variant.lanes; lane += 1) {
        const x = ROAD_LEFT + ((ROAD_RIGHT - ROAD_LEFT) * lane) / variant.lanes;
        for (let y = -52 + game.roadOffset; y < HEIGHT; y += 52) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 24);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = "#164d23";
      for (let y = -34 + (game.roadOffset * 1.35) % 68; y < HEIGHT; y += 68) {
        ctx.beginPath();
        ctx.moveTo(ROAD_LEFT - 24, y);
        ctx.lineTo(ROAD_LEFT - 24, y + 18);
        ctx.moveTo(ROAD_RIGHT + 24, y);
        ctx.lineTo(ROAD_RIGHT + 24, y + 18);
        ctx.stroke();
      }

      for (const car of game.traffic) {
        const x = laneX(car.lane, variant.lanes);
        ctx.fillStyle = "#2b7f3e";
        ctx.fillRect(x - 17, car.y, 34, 50);
        ctx.fillStyle = "#020702";
        ctx.fillRect(x - 10, car.y + 8, 20, 13);
        ctx.fillStyle = "#7dff9b";
        ctx.fillRect(x - 15, car.y + 42, 7, 4);
        ctx.fillRect(x + 8, car.y + 42, 7, 4);
      }

      if (now >= game.crashedUntil || Math.floor(now / 90) % 2 === 0) {
        ctx.fillStyle = "#7dff9b";
        ctx.fillRect(game.x - PLAYER_W / 2, PLAYER_Y, PLAYER_W, PLAYER_H);
        ctx.fillStyle = "#020702";
        ctx.fillRect(game.x - 12, PLAYER_Y + 11, 24, 17);
        ctx.fillRect(game.x - 13, PLAYER_Y + 47, 8, 5);
        ctx.fillRect(game.x + 5, PLAYER_Y + 47, 8, 5);
      }

      ctx.fillStyle = "#7dff9b";
      ctx.font = "700 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SPEED ${Math.round(game.speed)} KPH`, 16, 22);
      ctx.fillText(`SCORE ${String(scoreRef.current).padStart(3, "0")}`, 16, 39);
      ctx.fillText(`STREAK ${game.passStreak}`, 16, 56);
      ctx.textAlign = "right";
      ctx.fillText(`HIGHWAY 84 // ${variant.name}`, WIDTH - 16, 22);
      ctx.fillText(`${variant.lanes} LANES`, WIDTH - 16, 39);
      ctx.fillText(`HEAT ${Math.min(5, 1 + Math.floor(difficulty * 5))}/5`, WIDTH - 16, 56);

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    canvas.focus({ preventScroll: true });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [motionScale, showFeedback, variant]);

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
    gameRef.current.targetX = clamp(x, ROAD_LEFT + 30, ROAD_RIGHT - 30);
  }

  return (
    <div className="intermission-game road-racer-game">
      <header className="intermission-game-instructions">
        <strong>HIGHWAY 84 // {variant.name}</strong>
        <span>A/D OR ←/→ // POINTER / TOUCH STEERING // {variant.lanes}-LANE BOARD</span>
        <span>CLEAN +3 // RISKY +5 // CLOSE +7 // NEEDLE +10 // x5 STREAK BONUS // CONTACT -7</span>
      </header>
      <div className="arcade-playfield">
        <canvas
          ref={canvasRef}
          className="arcade-canvas road-racer-canvas"
          width={WIDTH}
          height={HEIGHT}
          tabIndex={0}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          onPointerMove={pointerMove}
          onPointerDown={pointerMove}
          aria-label="Retro highway racing game"
        />
        <ArcadeFeedback feedback={feedback} mode="compact" />
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>{variant.name} // NO BRAKES</strong></footer>
    </div>
  );
}
