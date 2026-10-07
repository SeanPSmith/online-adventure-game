import { useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { AimPowerShotControls, type AimPowerPhase } from "../engine/AimPowerShotControls";

const WIDTH = 640;
const HEIGHT = 390;
const GRAVITY = 220;
const CUP_R = 14;
const CUP_RIM_Z = 18;
const TABLE_LEFT = 74;
const TABLE_RIGHT = WIDTH - 74;
const TABLE_FAR_Y = 30;
const TABLE_NEAR_Y = HEIGHT - 24;

// Six-cup rack, oriented exactly like the bowling pins from the shooter's view:
// one front cup nearest the player, then rows of two and three behind it.
const CUP_POSITIONS = [
  { x: 320, y: 124 },
  { x: 304, y: 94 }, { x: 336, y: 94 },
  { x: 288, y: 64 }, { x: 320, y: 64 }, { x: 352, y: 64 },
] as const;

type Phase = AimPowerPhase | "result";
type TrailPoint = { x: number; y: number; z: number };

type BallState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  previousZ: number;
  startedAt: number;
  rimHits: number;
  tableBounces: number;
  sunkCup: number | null;
  resolved: boolean;
  trail: TrailPoint[];
};

type ProjectedPoint = { x: number; y: number; scale: number; depth: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pingPong(elapsed: number, period: number) {
  const n = ((elapsed % period) + period) % period / period;
  return n <= 0.5 ? n * 2 : (1 - n) * 2;
}

function projectTablePoint(x: number, y: number, z = 0): ProjectedPoint {
  const depth = clamp((y - TABLE_FAR_Y) / (TABLE_NEAR_Y - TABLE_FAR_Y), 0, 1);
  const halfWidth = 150 + depth * 105;
  const normalizedX = (x - WIDTH / 2) / ((TABLE_RIGHT - TABLE_LEFT) / 2);
  const perspectiveSkew = (0.5 - depth) * 34;
  return {
    x: WIDTH / 2 + normalizedX * halfWidth + perspectiveSkew,
    y: 58 + depth * 278 - z * 0.52,
    scale: 0.62 + depth * 0.38,
    depth,
  };
}

function predictedTrajectory(aim: number, power: number): TrailPoint[] {
  let x = WIDTH / 2;
  let y = 330;
  let z = 18;
  let vx = aim * 72;
  let vy = -(145 + power * 100);
  let vz = 100 + power * 36;
  const points: TrailPoint[] = [];
  const dt = 0.065;

  for (let step = 0; step < 52; step += 1) {
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    vz -= GRAVITY * dt;
    vx *= Math.pow(0.994, dt * 60);
    points.push({ x, y, z: Math.max(0, z) });
    if (z <= 0 || y < TABLE_FAR_Y - 40) break;
  }
  return points;
}

export function BeerPongGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const frameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const phaseStartedRef = useRef(performance.now());
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const phaseRef = useRef<Phase>("aim");
  const aimRef = useRef(0);
  const lockedAimRef = useRef(0);
  const powerRef = useRef(0.62);
  const throwNoRef = useRef(1);
  const cupsRef = useRef<number[]>(Array.from({ length: CUP_POSITIONS.length }, (_, index) => index));
  const finishRef = useRef<(ball: BallState) => void>(() => {});

  const [cups, setCups] = useState(() => Array.from({ length: CUP_POSITIONS.length }, (_, index) => index));
  const [phase, setPhase] = useState<Phase>("aim");
  const [aim, setAim] = useState(0);
  const [lockedAim, setLockedAim] = useState(0);
  const [power, setPower] = useState(0.62);
  const [throwNo, setThrowNo] = useState(1);
  const [message, setMessage] = useState("READ THE TABLE DEPTH // SWEEP AIM // THEN SET POWER_");
  const { feedback, showFeedback } = useArcadeFeedback(1900);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { aimRef.current = aim; }, [aim]);
  useEffect(() => { lockedAimRef.current = lockedAim; }, [lockedAim]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { throwNoRef.current = throwNo; }, [throwNo]);
  useEffect(() => { cupsRef.current = cups; }, [cups]);

  useEffect(() => {
    if (phase !== "aim" && phase !== "power") return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - phaseStartedRef.current;
      if (phase === "aim") setAim(pingPong(elapsed, 3200) * 2 - 1);
      else setPower(0.28 + pingPong(elapsed, 2550) * 0.72);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
  }, []);

  function resetThrow() {
    ballRef.current = null;
    setPhase("aim");
    phaseStartedRef.current = performance.now();
    setAim(0);
    setLockedAim(0);
    setPower(0.62);
    setThrowNo((value) => value + 1);
    setMessage(storyReadyRef.current ? "STORY READY // LAST THROW IF YOU WANT IT_" : "READ THE ARC + SHADOW // SWEEP AIM // THEN SET POWER_");
  }

  function finishThrow(ball: BallState) {
    if (ball.resolved) return;
    ball.resolved = true;
    setPhase("result");

    if (ball.sunkCup !== null) {
      const cup = ball.sunkCup;
      const clean = ball.rimHits === 0 && ball.tableBounces === 0;
      const award = clean ? 15 : 10;
      const remaining = cupsRef.current.filter((id) => id !== cup);
      setCups(remaining);
      const nextScore = Math.min(999, scoreRef.current + award);
      scoreRef.current = nextScore;
      onScoreChangeRef.current(nextScore);
      setMessage(`${clean ? "CLEAN CUP" : "BOUNCE-IN"} // +${award} // ${remaining.length} CUPS LEFT_`);
      showFeedback({
        title: clean ? "SPLASH!" : "BANKED IT!",
        detail: `THROW ${throwNoRef.current} // ${remaining.length} CUPS REMAIN`,
        delta: award,
        tone: clean ? "great" : "good",
      }, 2050);
      if (remaining.length === 0) {
        resetTimerRef.current = window.setTimeout(() => {
          const rerack = Array.from({ length: CUP_POSITIONS.length }, (_, index) => index);
          setCups(rerack);
          cupsRef.current = rerack;
          setMessage("TABLE CLEARED // FRESH 1-2-3 RACK_");
          resetThrow();
        }, 2500);
        return;
      }
    } else {
      const reason = ball.rimHits ? "RIM OUT" : ball.tableBounces ? "TABLE BOUNCE" : powerRef.current < 0.48 ? "SHORT" : powerRef.current > 0.87 ? "LONG" : "MISS";
      setMessage(`${reason} // FOLLOW THE SHADOW AND ADJUST_`);
      showFeedback({ title: reason, detail: `THROW ${throwNoRef.current} // NO CUP`, tone: "bad" }, 1750);
    }

    resetTimerRef.current = window.setTimeout(resetThrow, 2200);
  }

  finishRef.current = finishThrow;

  function launchBall(finalPower: number) {
    const startX = WIDTH / 2;
    const startY = 330;
    ballRef.current = {
      x: startX,
      y: startY,
      z: 18,
      vx: lockedAimRef.current * 72,
      vy: -(145 + finalPower * 100),
      vz: 100 + finalPower * 36,
      previousZ: 18,
      startedAt: performance.now(),
      rimHits: 0,
      tableBounces: 0,
      sunkCup: null,
      resolved: false,
      trail: [],
    };
    setPhase("resolving");
    setMessage(`THROW ${throwNoRef.current} // WATCH THE SHADOW + ARC_`);
  }

  function lockControl() {
    if (storyReady || phase === "resolving" || phase === "result") return;
    if (phase === "aim") {
      setLockedAim(aim);
      lockedAimRef.current = aim;
      setPhase("power");
      phaseStartedRef.current = performance.now();
      setMessage("AIM LOCKED // SET VERTICAL POWER_");
      return;
    }
    if (phase === "power") launchBall(power);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    // Capture the validated context for nested drawing helpers. TypeScript does not
    // preserve the outer null-narrowing across callback/function boundaries.
    const cupCtx = ctx;

    function drawCup(index: number) {
      const cup = CUP_POSITIONS[index];
      const live = cupsRef.current.includes(index);
      const top = projectTablePoint(cup.x, cup.y, CUP_RIM_Z);
      const base = projectTablePoint(cup.x, cup.y, 0);
      const radius = CUP_R * top.scale;
      const baseRadius = radius * 0.76;
      cupCtx.globalAlpha = live ? 1 : 0.11;
      cupCtx.fillStyle = "#a91f2c";
      cupCtx.beginPath();
      cupCtx.moveTo(top.x - radius, top.y);
      cupCtx.lineTo(top.x + radius, top.y);
      cupCtx.lineTo(base.x + baseRadius, base.y + 6 * base.scale);
      cupCtx.lineTo(base.x - baseRadius, base.y + 6 * base.scale);
      cupCtx.closePath();
      cupCtx.fill();
      cupCtx.fillStyle = "#ef5961";
      cupCtx.beginPath(); cupCtx.ellipse(top.x, top.y, radius, radius * 0.38, 0, 0, Math.PI * 2); cupCtx.fill();
      cupCtx.fillStyle = "#f3d8b2";
      cupCtx.beginPath(); cupCtx.ellipse(top.x, top.y, radius * 0.72, radius * 0.25, 0, 0, Math.PI * 2); cupCtx.fill();
      cupCtx.fillStyle = "#772326";
      cupCtx.beginPath(); cupCtx.ellipse(top.x, top.y + 1, radius * 0.5, radius * 0.16, 0, 0, Math.PI * 2); cupCtx.fill();
      cupCtx.globalAlpha = 1;
    }

    let previous = performance.now();
    const draw = (now: number) => {
      const dt = clamp((now - previous) / 1000, 0, 0.032);
      previous = now;
      const ball = ballRef.current;

      if (ball && phaseRef.current === "resolving") {
        ball.previousZ = ball.z;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.z += ball.vz * dt;
        ball.vz -= GRAVITY * dt;
        ball.vx *= Math.pow(0.994, dt * 60);
        ball.trail.push({ x: ball.x, y: ball.y, z: ball.z });
        if (ball.trail.length > 24) ball.trail.shift();

        for (const cupIndex of cupsRef.current) {
          const cup = CUP_POSITIONS[cupIndex];
          const dx = ball.x - cup.x;
          const dy = ball.y - cup.y;
          const dist = Math.hypot(dx, dy);

          if (ball.vz < 0 && ball.previousZ >= CUP_RIM_Z && ball.z < CUP_RIM_Z && dist < CUP_R * 0.62) {
            ball.sunkCup = cupIndex;
            ball.vx *= 0.1;
            ball.vy *= 0.1;
            ball.vz = -28;
            break;
          }

          if (dist > CUP_R * 0.65 && dist < CUP_R * 1.32 && Math.abs(ball.z - CUP_RIM_Z) < 9 && ball.rimHits < 4) {
            const nx = dx / Math.max(dist, 0.001);
            const ny = dy / Math.max(dist, 0.001);
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 1.7 * dot * nx;
            ball.vy -= 1.7 * dot * ny;
            ball.vx *= 0.72;
            ball.vy *= 0.72;
            ball.vz = Math.max(26, Math.abs(ball.vz) * 0.55);
            ball.rimHits += 1;
          }
        }

        if (ball.z <= 0 && ball.sunkCup === null) {
          ball.z = 0;
          if (Math.abs(ball.vz) > 18) {
            ball.vz = Math.abs(ball.vz) * 0.42;
            ball.vx *= 0.82;
            ball.vy *= 0.78;
            ball.tableBounces += 1;
          } else {
            ball.vz = 0;
          }
        }

        const elapsed = now - ball.startedAt;
        if (ball.sunkCup !== null && ball.z < 4) finishRef.current(ball);
        else if (elapsed > 3300 || ball.y < -60 || ball.y > HEIGHT + 70 || ball.x < -70 || ball.x > WIDTH + 70 || (ball.z === 0 && Math.abs(ball.vz) < 6 && elapsed > 1300)) finishRef.current(ball);
      }

      // Basement / VGA backdrop.
      ctx.fillStyle = "#100a16";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#25213a";
      for (let y = 0; y < HEIGHT; y += 26) ctx.fillRect(0, y, WIDTH, 1);

      // Isometric three-quarter table. Physics still runs in world x/y/z coordinates.
      const farLeft = projectTablePoint(TABLE_LEFT, TABLE_FAR_Y);
      const farRight = projectTablePoint(TABLE_RIGHT, TABLE_FAR_Y);
      const nearRight = projectTablePoint(TABLE_RIGHT, TABLE_NEAR_Y);
      const nearLeft = projectTablePoint(TABLE_LEFT, TABLE_NEAR_Y);
      ctx.fillStyle = "#153e4c";
      ctx.strokeStyle = "#69bfd6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(farLeft.x, farLeft.y);
      ctx.lineTo(farRight.x, farRight.y);
      ctx.lineTo(nearRight.x, nearRight.y);
      ctx.lineTo(nearLeft.x, nearLeft.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Perspective guide lines make short/long distance readable.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(105,191,214,0.22)";
      for (const worldX of [196, 258, 320, 382, 444]) {
        const a = projectTablePoint(worldX, TABLE_FAR_Y);
        const b = projectTablePoint(worldX, TABLE_NEAR_Y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const worldY of [90, 150, 210, 270, 330]) {
        const a = projectTablePoint(TABLE_LEFT, worldY);
        const b = projectTablePoint(TABLE_RIGHT, worldY);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // Cups draw far-to-near so the 1-2-3 rack reads correctly in depth.
      [...CUP_POSITIONS.keys()]
        .sort((a, b) => CUP_POSITIONS[a].y - CUP_POSITIONS[b].y)
        .forEach(drawCup);

      const currentPhase = phaseRef.current;
      if (!ball && (currentPhase === "aim" || currentPhase === "power")) {
        const previewAim = currentPhase === "aim" ? aimRef.current : lockedAimRef.current;
        const preview = predictedTrajectory(previewAim, powerRef.current);
        ctx.fillStyle = "rgba(247,241,210,0.48)";
        preview.forEach((point, index) => {
          if (index % 2 !== 0) return;
          const projected = projectTablePoint(point.x, point.y, point.z);
          ctx.beginPath(); ctx.arc(projected.x, projected.y, 2.2, 0, Math.PI * 2); ctx.fill();
        });
        const landing = preview[preview.length - 1];
        if (landing) {
          const lp = projectTablePoint(landing.x, landing.y, 0);
          ctx.strokeStyle = currentPhase === "aim" ? "#f4cf66" : "#7ed8ef";
          ctx.beginPath(); ctx.ellipse(lp.x, lp.y, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(lp.x - 14, lp.y); ctx.lineTo(lp.x + 14, lp.y); ctx.stroke();
        }
      }

      // Throwing hand / launch origin at the near end.
      const hand = projectTablePoint(WIDTH / 2, 330, 7);
      ctx.fillStyle = "#f4cf66";
      ctx.fillRect(hand.x - 12, hand.y - 4, 24, 14);

      if (ball) {
        // Shadow stays on the table, so height/depth is always legible.
        const shadow = projectTablePoint(ball.x, ball.y, 0);
        const flying = projectTablePoint(ball.x, ball.y, Math.max(0, ball.z));
        const shadowFade = clamp(0.46 - ball.z / 260, 0.13, 0.46);
        ctx.fillStyle = `rgba(0,0,0,${shadowFade.toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 8 * shadow.scale, 4 * shadow.scale, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(247,241,210,0.16)";
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(shadow.x, shadow.y); ctx.lineTo(flying.x, flying.y); ctx.stroke();
        ctx.setLineDash([]);

        ball.trail.forEach((point, index) => {
          const p = projectTablePoint(point.x, point.y, Math.max(0, point.z));
          const alpha = ((index + 1) / Math.max(ball.trail.length, 1)) * 0.36;
          ctx.fillStyle = `rgba(247,241,210,${alpha.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
        });

        ctx.fillStyle = "#f7f1d2";
        ctx.strokeStyle = "#8da2ad";
        ctx.lineWidth = 2;
        const radius = 6 + clamp(ball.z / 65, 0, 1) * 3;
        ctx.beginPath(); ctx.arc(flying.x, flying.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.fillStyle = "#7ed8ef";
      ctx.font = "700 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`BASEMENT LEAGUE // THROW ${throwNoRef.current}`, 42, 28);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f4cf66";
      ctx.fillText("ARC + SHADOW = DEPTH", WIDTH / 2, 28);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ff8f8f";
      ctx.fillText(`${cupsRef.current.length} CUPS`, WIDTH - 42, 28);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="intermission-game beer-pong-game beer-pong-game-v2 beer-pong-game-isometric">
      <header className="intermission-game-instructions">
        <strong>BEER PONG // ISOMETRIC PHYSICS TABLE // REV 38I // {cups.length} CUPS REMAIN</strong>
        <span>1-2-3 RACK // HORIZONTAL AIM // VERTICAL POWER // ARC + SHADOW SHOW DEPTH</span>
      </header>

      <div className="arcade-physics-layout">
        <canvas ref={canvasRef} className="arcade-physics-canvas beer-pong-physics-canvas beer-pong-isometric-canvas" width={WIDTH} height={HEIGHT} aria-label="Isometric beer pong physics table with projectile arc and ball shadow" />
        <AimPowerShotControls
          phase={phase === "result" ? "locked" : phase}
          aim={phase === "aim" ? aim : lockedAim}
          power={power}
          aimTarget={0}
          aimTolerance={0.3}
          powerTarget={0.64}
          powerTolerance={0.24}
        />
      </div>

      <button type="button" className="button primary arcade-shot-lock-button" onClick={lockControl} disabled={storyReady || phase === "resolving" || phase === "result"}>
        {phase === "aim" ? "LOCK AIM" : phase === "power" ? "THROW" : "BALL LIVE"}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
