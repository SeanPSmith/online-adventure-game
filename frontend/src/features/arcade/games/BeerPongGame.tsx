import { useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { AimPowerShotControls, type AimPowerPhase } from "../engine/AimPowerShotControls";

const WIDTH = 640;
const HEIGHT = 390;
const GRAVITY = 220;
const CUP_R = 14;
const CUP_RIM_Z = 18;

const CUP_POSITIONS = [
  { x: 320, y: 72 },
  { x: 294, y: 96 }, { x: 346, y: 96 },
  { x: 268, y: 120 }, { x: 320, y: 120 }, { x: 372, y: 120 },
  { x: 242, y: 144 }, { x: 294, y: 144 }, { x: 346, y: 144 }, { x: 398, y: 144 },
] as const;

type Phase = AimPowerPhase | "result";

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
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pingPong(elapsed: number, period: number) {
  const n = ((elapsed % period) + period) % period / period;
  return n <= 0.5 ? n * 2 : (1 - n) * 2;
}

export function BeerPongGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const phaseStartedRef = useRef(performance.now());
  const resetTimerRef = useRef<number | null>(null);
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
  const [message, setMessage] = useState("SWEEP AIM // THEN LOCK THROW POWER_");
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
    setMessage(storyReadyRef.current ? "STORY READY // LAST THROW IF YOU WANT IT_" : "SWEEP AIM // THEN LOCK THROW POWER_");
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
          setMessage("TABLE CLEARED // FRESH RACK_");
          resetThrow();
        }, 2500);
        return;
      }
    } else {
      const reason = ball.rimHits ? "RIM OUT" : ball.tableBounces ? "TABLE BOUNCE" : powerRef.current < 0.48 ? "SHORT" : "MISS";
      setMessage(`${reason} // READ THE TABLE AND ADJUST_`);
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
      vx: lockedAim * 72,
      vy: -(145 + finalPower * 100),
      vz: 100 + finalPower * 36,
      previousZ: 18,
      startedAt: performance.now(),
      rimHits: 0,
      tableBounces: 0,
      sunkCup: null,
      resolved: false,
    };
    setPhase("resolving");
    setMessage(`THROW ${throwNo} // BALL LIVE_`);
  }

  function lockControl() {
    if (storyReady || phase === "resolving" || phase === "result") return;
    if (phase === "aim") {
      setLockedAim(aim);
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

      // Table and basement floor.
      ctx.fillStyle = "#120b16";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#253044";
      for (let y = 0; y < HEIGHT; y += 24) ctx.fillRect(0, y, WIDTH, 1);
      ctx.fillStyle = "#153e4c";
      ctx.fillRect(74, 30, WIDTH - 148, HEIGHT - 54);
      ctx.strokeStyle = "#69bfd6";
      ctx.lineWidth = 3;
      ctx.strokeRect(74, 30, WIDTH - 148, HEIGHT - 54);
      ctx.strokeStyle = "#316f82";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(WIDTH / 2, 30); ctx.lineTo(WIDTH / 2, HEIGHT - 24); ctx.stroke();

      // Cups as actual top-down circles with liquid centers.
      for (let index = 0; index < CUP_POSITIONS.length; index += 1) {
        const cup = CUP_POSITIONS[index];
        const live = cupsRef.current.includes(index);
        ctx.globalAlpha = live ? 1 : 0.14;
        ctx.fillStyle = "#d93b43";
        ctx.beginPath(); ctx.arc(cup.x, cup.y, CUP_R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f2d7b0";
        ctx.beginPath(); ctx.arc(cup.x, cup.y, CUP_R - 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#8d2a27";
        ctx.beginPath(); ctx.arc(cup.x, cup.y, CUP_R - 7, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      const currentPhase = phaseRef.current;
      if (!ball && (currentPhase === "aim" || currentPhase === "power")) {
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = currentPhase === "aim" ? "#f4cf66" : "#7ed8ef";
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2, 326);
        ctx.lineTo(WIDTH / 2 + (currentPhase === "aim" ? aimRef.current : lockedAimRef.current) * 120, 92);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Throwing hand / ball origin.
      ctx.fillStyle = "#f4cf66";
      ctx.fillRect(WIDTH / 2 - 12, 334, 24, 18);

      if (ball) {
        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.beginPath(); ctx.ellipse(ball.x, ball.y, 7 + ball.z * 0.025, 4 + ball.z * 0.012, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f7f1d2";
        ctx.strokeStyle = "#8da2ad";
        ctx.lineWidth = 2;
        const drawY = ball.y - ball.z * 0.42;
        const radius = 6 + clamp(ball.z / 65, 0, 1) * 3;
        ctx.beginPath(); ctx.arc(ball.x, drawY, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.fillStyle = "#7ed8ef";
      ctx.font = "700 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`BASEMENT LEAGUE // THROW ${throwNoRef.current}`, 92, 53);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ff8f8f";
      ctx.fillText(`${cupsRef.current.length} CUPS`, WIDTH - 92, 53);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="intermission-game beer-pong-game beer-pong-game-v2">
      <header className="intermission-game-instructions">
        <strong>BEER PONG // TOP-DOWN PHYSICS TABLE // {cups.length} CUPS REMAIN</strong>
        <span>HORIZONTAL AIM // VERTICAL POWER // BALL CAN BANK, RIM, BOUNCE, OR DROP</span>
      </header>

      <div className="arcade-physics-layout">
        <canvas ref={canvasRef} className="arcade-physics-canvas beer-pong-physics-canvas" width={WIDTH} height={HEIGHT} aria-label="Top-down beer pong physics table" />
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
