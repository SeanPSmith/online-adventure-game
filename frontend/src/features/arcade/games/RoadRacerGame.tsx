import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 380;
const PLAYER_Y = HEIGHT - 72;
const ROAD_LEFT = 126;
const ROAD_RIGHT = WIDTH - 126;
const PLAYER_W = 38;
const PLAYER_H = 58;

interface TrafficCar {
  lane: number;
  y: number;
  speed: number;
  passed: boolean;
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
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function laneX(lane: number) {
  const usable = ROAD_RIGHT - ROAD_LEFT;
  return ROAD_LEFT + usable * ((lane + 0.5) / 3);
}

function freshState(): RacerState {
  return {
    x: WIDTH / 2,
    targetX: WIDTH / 2,
    speed: 245,
    roadOffset: 0,
    spawnTimer: 0.35,
    traffic: [],
    keys: new Set(),
    crashedUntil: 0,
  };
}

export function RoadRacerGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<RacerState>(freshState());
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [message, setMessage] = useState("KEEP IT BETWEEN THE LINES // PASS EVERYTHING_");

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

    const tick = (time: number) => {
      const last = lastTimeRef.current ?? time;
      const dt = Math.min(0.034, Math.max(0, (time - last) / 1000));
      lastTimeRef.current = time;
      const game = gameRef.current;

      const steer = 330;
      if (game.keys.has("arrowleft") || game.keys.has("a")) game.targetX -= steer * dt;
      if (game.keys.has("arrowright") || game.keys.has("d")) game.targetX += steer * dt;
      game.targetX = clamp(game.targetX, ROAD_LEFT + PLAYER_W / 2 + 8, ROAD_RIGHT - PLAYER_W / 2 - 8);
      game.x += (game.targetX - game.x) * Math.min(1, dt * 12);

      game.speed = clamp(game.speed + dt * 2.8, 245, 340);
      game.roadOffset = (game.roadOffset + game.speed * dt) % 52;
      game.spawnTimer -= dt;

      if (game.spawnTimer <= 0) {
        const lane = Math.floor(Math.random() * 3);
        game.traffic.push({
          lane,
          y: -72,
          speed: game.speed * (0.74 + Math.random() * 0.18),
          passed: false,
        });
        game.spawnTimer = Math.max(0.48, 1.02 - (game.speed - 245) / 270) + Math.random() * 0.28;
      }

      const now = performance.now();
      const canCrash = now >= game.crashedUntil;
      for (const car of game.traffic) {
        car.y += car.speed * dt;
        const x = laneX(car.lane);
        if (!car.passed && car.y > PLAYER_Y + PLAYER_H) {
          car.passed = true;
          award(3);
          setMessage("CLEAN PASS // +3_");
        }

        const overlapX = Math.abs(game.x - x) < (PLAYER_W + 34) / 2;
        const overlapY = car.y + 50 > PLAYER_Y && car.y < PLAYER_Y + PLAYER_H;
        if (canCrash && overlapX && overlapY) {
          game.crashedUntil = now + 850;
          game.speed = Math.max(245, game.speed - 38);
          game.targetX = WIDTH / 2;
          award(-7);
          setMessage("CONTACT // -7 // CAR RECOVERING_");
        }
      }
      game.traffic = game.traffic.filter((car) => car.y < HEIGHT + 90);

      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Road shoulder and surface.
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

      // Moving lane stripes create most of the speed illusion.
      ctx.strokeStyle = "#1d5b2b";
      ctx.lineWidth = 4;
      for (let lane = 1; lane <= 2; lane += 1) {
        const x = ROAD_LEFT + ((ROAD_RIGHT - ROAD_LEFT) * lane) / 3;
        for (let y = -52 + game.roadOffset; y < HEIGHT; y += 52) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 24);
          ctx.stroke();
        }
      }

      // Roadside posts.
      ctx.strokeStyle = "#164d23";
      for (let y = -34 + (game.roadOffset * 1.35) % 68; y < HEIGHT; y += 68) {
        ctx.beginPath();
        ctx.moveTo(ROAD_LEFT - 24, y);
        ctx.lineTo(ROAD_LEFT - 24, y + 18);
        ctx.moveTo(ROAD_RIGHT + 24, y);
        ctx.lineTo(ROAD_RIGHT + 24, y + 18);
        ctx.stroke();
      }

      // Traffic.
      for (const car of game.traffic) {
        const x = laneX(car.lane);
        ctx.fillStyle = "#2b7f3e";
        ctx.fillRect(x - 17, car.y, 34, 50);
        ctx.fillStyle = "#020702";
        ctx.fillRect(x - 10, car.y + 8, 20, 13);
        ctx.fillStyle = "#7dff9b";
        ctx.fillRect(x - 15, car.y + 42, 7, 4);
        ctx.fillRect(x + 8, car.y + 42, 7, 4);
      }

      // Player car flashes during crash recovery.
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
      ctx.textAlign = "right";
      ctx.fillText("HIGHWAY 84", WIDTH - 16, 22);

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    canvas.focus({ preventScroll: true });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
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
    gameRef.current.targetX = clamp(x, ROAD_LEFT + 30, ROAD_RIGHT - 30);
  }

  return (
    <div className="intermission-game road-racer-game">
      <header className="intermission-game-instructions">
        <strong>HIGHWAY 84 // PASS TRAFFIC WITHOUT BECOMING TRAFFIC</strong>
        <span>A/D OR ←/→ // POINTER / TOUCH STEERING</span>
        <span>CLEAN PASS +3 // CONTACT -7 // SPEED CREEPS UP</span>
      </header>
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
      <footer className="intermission-game-message"><span>{message}</span><strong>NO BRAKES // GREAT PLAN</strong></footer>
    </div>
  );
}
