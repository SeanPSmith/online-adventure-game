import { useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { AimPowerShotControls, type AimPowerPhase } from "../engine/AimPowerShotControls";

const WIDTH = 640;
const HEIGHT = 360;
const HOOP_X = WIDTH / 2;
const HOOP_Y = 72;
const RIM_Z = 42;
const GRAVITY = 260;

type ShotPhase = AimPowerPhase | "result";

type BallState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  previousZ: number;
  startedAt: number;
  made: boolean;
  scored: boolean;
  rimHits: number;
  glassHits: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pingPong(elapsed: number, period: number) {
  const n = ((elapsed % period) + period) % period / period;
  return n <= 0.5 ? n * 2 : (1 - n) * 2;
}

export function BasketballGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const frameRef = useRef<number | null>(null);
  const phaseStartedRef = useRef(performance.now());
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const resetTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<ShotPhase>("aim");
  const aimRef = useRef(0);
  const lockedAimRef = useRef(0);
  const powerRef = useRef(0.62);
  const distanceRef = useRef<2 | 3>(2);
  const streakRef = useRef(0);
  const shotNoRef = useRef(1);
  const resolveBallRef = useRef<(ball: BallState) => void>(() => {});

  const [phase, setPhase] = useState<ShotPhase>("aim");
  const [aim, setAim] = useState(0);
  const [power, setPower] = useState(0.62);
  const [lockedAim, setLockedAim] = useState(0);
  const [distance, setDistance] = useState<2 | 3>(() => (Math.random() < 0.38 ? 3 : 2));
  const [streak, setStreak] = useState(0);
  const [shotNo, setShotNo] = useState(1);
  const [message, setMessage] = useState("CENTER AIM // THEN LOCK POWER_");
  const { feedback, showFeedback } = useArcadeFeedback(1900);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { aimRef.current = aim; }, [aim]);
  useEffect(() => { lockedAimRef.current = lockedAim; }, [lockedAim]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { shotNoRef.current = shotNo; }, [shotNo]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);

  useEffect(() => {
    if (phase !== "aim" && phase !== "power") return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - phaseStartedRef.current;
      if (phase === "aim") setAim(pingPong(elapsed, 2850) * 2 - 1);
      else setPower(0.28 + pingPong(elapsed, 2250) * 0.72);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
  }, []);

  function resetShot() {
    ballRef.current = null;
    setPhase("aim");
    phaseStartedRef.current = performance.now();
    setAim(0);
    setPower(0.62);
    setLockedAim(0);
    setDistance(Math.random() < 0.38 ? 3 : 2);
    setShotNo((value) => value + 1);
    setMessage(storyReadyRef.current ? "STORY READY // TAKE ONE LAST SHOT_" : "CENTER AIM // THEN LOCK POWER_");
  }

  function resolveBall(ball: BallState) {
    if (ball.scored) return;
    ball.scored = true;
    setPhase("result");

    if (ball.made) {
      const nextStreak = streak + 1;
      const streakBonus = Math.min(4, Math.floor(nextStreak / 3));
      const award = distance + streakBonus;
      setStreak(nextStreak);
      const nextScore = Math.min(999, scoreRef.current + award);
      scoreRef.current = nextScore;
      onScoreChangeRef.current(nextScore);
      const swish = ball.rimHits === 0 && ball.glassHits === 0;
      setMessage(`${swish ? "NOTHING BUT NET" : "BUCKET"} // +${award} // STREAK ${nextStreak}_`);
      showFeedback({
        title: swish ? "SWISH!" : distance === 3 ? "THREE!" : "BUCKET!",
        detail: ball.glassHits ? "OFF THE GLASS" : ball.rimHits ? "FRIENDLY RIM" : `SHOT ${shotNo}`,
        delta: award,
        tone: swish ? "great" : "good",
      }, 2050);
    } else {
      setStreak(0);
      const miss = ball.glassHits ? "OFF GLASS" : ball.rimHits ? "RIM OUT" : power < 0.48 ? "SHORT" : "BRICK";
      setMessage(`${miss} // ADJUST AIM OR POWER_`);
      showFeedback({ title: miss, detail: `SHOT ${shotNo} // NO POINTS`, tone: "bad" }, 1900);
    }

    resetTimerRef.current = window.setTimeout(resetShot, 2400);
  }

  resolveBallRef.current = resolveBall;

  function launchBall(finalPower: number) {
    const startY = distance === 3 ? 326 : 296;
    const forwardSpeed = 170 + finalPower * 92;
    const lateralSpeed = lockedAim * 62;
    const verticalSpeed = 145 + finalPower * 56;
    ballRef.current = {
      x: WIDTH / 2,
      y: startY,
      z: 17,
      vx: lateralSpeed,
      vy: -forwardSpeed,
      vz: verticalSpeed,
      previousZ: 17,
      startedAt: performance.now(),
      made: false,
      scored: false,
      rimHits: 0,
      glassHits: 0,
    };
    setPhase("resolving");
    setMessage(`SHOT ${shotNo} // BALL LIVE_`);
  }

  function lockShotControl() {
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

      if (ball && phase === "resolving") {
        ball.previousZ = ball.z;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.z += ball.vz * dt;
        ball.vz -= GRAVITY * dt;
        ball.vx *= Math.pow(0.992, dt * 60);

        // Backboard: physical rebound if the shot carries too deep.
        if (ball.y <= 48 && ball.y - ball.vy * dt > 48 && Math.abs(ball.x - HOOP_X) < 48 && ball.z > 24 && ball.z < 88) {
          ball.y = 49;
          ball.vy = Math.abs(ball.vy) * 0.62;
          ball.vz += 15;
          ball.glassHits += 1;
        }

        // Rim ring collision. Contact redirects the ball instead of deciding the result ahead of time.
        const dx = ball.x - HOOP_X;
        const dy = ball.y - HOOP_Y;
        const distanceToRim = Math.hypot(dx, dy);
        if (distanceToRim > 17 && distanceToRim < 30 && Math.abs(ball.z - RIM_Z) < 10 && ball.rimHits < 3) {
          const nx = dx / Math.max(distanceToRim, 0.001);
          const ny = dy / Math.max(distanceToRim, 0.001);
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 1.65 * dot * nx;
          ball.vy -= 1.65 * dot * ny;
          ball.vx *= 0.76;
          ball.vy *= 0.76;
          ball.vz = Math.max(ball.vz, 28);
          ball.rimHits += 1;
        }

        // Basket capture: ball must physically descend through the rim cylinder.
        if (!ball.made && ball.vz < 0 && ball.previousZ >= RIM_Z && ball.z < RIM_Z && Math.hypot(ball.x - HOOP_X, ball.y - HOOP_Y) < 16) {
          ball.made = true;
          ball.vx *= 0.2;
          ball.vy *= 0.3;
        }

        if (ball.z <= 0) {
          ball.z = 0;
          if (Math.abs(ball.vz) > 24) {
            ball.vz = Math.abs(ball.vz) * 0.48;
            ball.vx *= 0.84;
            ball.vy *= 0.78;
          } else {
            ball.vz = 0;
          }
        }

        const elapsed = now - ball.startedAt;
        if (elapsed > 2850 || (ball.z === 0 && Math.abs(ball.vz) < 8 && elapsed > 1450) || ball.y > HEIGHT + 90 || ball.x < -90 || ball.x > WIDTH + 90) {
          resolveBallRef.current(ball);
        }
      }

      // Court.
      ctx.fillStyle = "#06111e";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#143758";
      ctx.fillRect(26, 26, WIDTH - 52, HEIGHT - 48);
      ctx.strokeStyle = "#79bfe8";
      ctx.lineWidth = 2;
      ctx.strokeRect(26, 26, WIDTH - 52, HEIGHT - 48);
      ctx.beginPath();
      ctx.arc(HOOP_X, 98, 73, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(95, 250); ctx.quadraticCurveTo(HOOP_X, 150, WIDTH - 95, 250); ctx.stroke();
      ctx.lineWidth = 1;

      // Backboard + rim, viewed from high/oblique angle.
      ctx.fillStyle = "#e8edf2";
      ctx.fillRect(HOOP_X - 52, 35, 104, 8);
      ctx.fillStyle = "#ff714b";
      ctx.beginPath();
      ctx.ellipse(HOOP_X, HOOP_Y, 27, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f5f0d7";
      for (let x = -14; x <= 14; x += 7) {
        ctx.beginPath(); ctx.moveTo(HOOP_X + x, HOOP_Y + 7); ctx.lineTo(HOOP_X + x * 0.55, HOOP_Y + 27); ctx.stroke();
      }

      // Shooter marker / three-point starting distance.
      const currentDistance = distanceRef.current;
      const currentPhase = phaseRef.current;
      const shooterY = currentDistance === 3 ? 326 : 296;
      ctx.fillStyle = "#6fd8ff";
      ctx.fillRect(HOOP_X - 10, shooterY - 11, 20, 22);
      ctx.fillStyle = "#ff9a42";
      ctx.beginPath(); ctx.arc(HOOP_X, shooterY - 16, 6, 0, Math.PI * 2); ctx.fill();

      // Aim guide before launch.
      if (!ball && (currentPhase === "aim" || currentPhase === "power")) {
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = currentPhase === "aim" ? "#f4cf66" : "#6fd8ff";
        ctx.beginPath();
        ctx.moveTo(HOOP_X, shooterY - 20);
        ctx.lineTo(HOOP_X + (currentPhase === "aim" ? aimRef.current : lockedAimRef.current) * 80, HOOP_Y + 15);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (ball) {
        // Shadow remains on court; the ball rises away from it based on simulated Z.
        ctx.fillStyle = "rgba(0,0,0,0.38)";
        ctx.beginPath();
        ctx.ellipse(ball.x, ball.y, 8 + ball.z * 0.018, 4 + ball.z * 0.009, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff9a42";
        ctx.strokeStyle = "#6b2f0e";
        ctx.lineWidth = 2;
        const ballY = ball.y - ball.z * 0.46;
        const radius = 7 + clamp(ball.z / 70, 0, 1) * 3;
        ctx.beginPath(); ctx.arc(ball.x, ballY, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.fillStyle = "#b9dff5";
      ctx.font = "700 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SHOT ${shotNoRef.current} // ${currentDistance}PT`, 40, 48);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffd260";
      ctx.fillText(`STREAK ${streakRef.current}`, WIDTH - 40, 48);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="intermission-game basketball-game basketball-game-v2">
      <header className="intermission-game-instructions">
        <strong>PIXEL HOOPS // PHYSICS COURT // {distance}-POINTER</strong>
        <span>HORIZONTAL AIM // VERTICAL POWER // RIM + GLASS COLLISIONS DECIDE THE SHOT</span>
      </header>

      <div className="arcade-physics-layout">
        <canvas ref={canvasRef} className="arcade-physics-canvas basketball-physics-canvas" width={WIDTH} height={HEIGHT} aria-label="Basketball half-court physics simulation" />
        <AimPowerShotControls
          phase={phase === "result" ? "locked" : phase}
          aim={phase === "aim" ? aim : lockedAim}
          power={power}
          aimTarget={0}
          aimTolerance={distance === 3 ? 0.18 : 0.24}
          powerTarget={distance === 3 ? 0.79 : 0.68}
          powerTolerance={0.2}
        />
      </div>

      <button type="button" className="button primary arcade-shot-lock-button" onClick={lockShotControl} disabled={storyReady || phase === "resolving" || phase === "result"}>
        {phase === "aim" ? "LOCK AIM" : phase === "power" ? "SHOOT" : "BALL LIVE"}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
