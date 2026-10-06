import { useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const WIDTH = 640;
const HEIGHT = 360;
const FLOOR_Y = 318;
const RIM_Y = 150;
const FRONT_RIM_X = 502;
const BACK_RIM_X = 536;
const BACKBOARD_X = 558;
const GRAVITY = 420;
const BALL_RADIUS = 8;
const RIM_RADIUS = 5;
const ANGLE_MIN = 36;
const ANGLE_MAX = 68;

type ShotPhase = "angle" | "power" | "resolving" | "result";

type TrailPoint = { x: number; y: number };

type BallState = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  startedAt: number;
  made: boolean;
  scored: boolean;
  rimHits: number;
  glassHits: number;
  floorBounces: number;
  trail: TrailPoint[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pingPong(elapsed: number, period: number) {
  const n = ((elapsed % period) + period) % period / period;
  return n <= 0.5 ? n * 2 : (1 - n) * 2;
}

function collideCircle(ball: BallState, cx: number, cy: number, radius: number) {
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const distance = Math.hypot(dx, dy);
  const minDistance = BALL_RADIUS + radius;
  if (distance <= 0.001 || distance >= minDistance) return false;

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  ball.x += nx * overlap;
  ball.y += ny * overlap;

  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    ball.vx -= 1.72 * dot * nx;
    ball.vy -= 1.72 * dot * ny;
    ball.vx *= 0.83;
    ball.vy *= 0.83;
  }
  return true;
}

export function BasketballGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const frameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const phaseStartedRef = useRef(performance.now());
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const phaseRef = useRef<ShotPhase>("angle");
  const angleRef = useRef(52);
  const lockedAngleRef = useRef(52);
  const powerRef = useRef(0.66);
  const distanceRef = useRef<2 | 3>(2);
  const streakRef = useRef(0);
  const shotNoRef = useRef(1);
  const resolveBallRef = useRef<(ball: BallState) => void>(() => {});

  const [phase, setPhase] = useState<ShotPhase>("angle");
  const [angle, setAngle] = useState(52);
  const [lockedAngle, setLockedAngle] = useState(52);
  const [power, setPower] = useState(0.66);
  const [distance, setDistance] = useState<2 | 3>(() => (Math.random() < 0.38 ? 3 : 2));
  const [streak, setStreak] = useState(0);
  const [shotNo, setShotNo] = useState(1);
  const [message, setMessage] = useState("SET THE ARC // THEN SET POWER_");
  const { feedback, showFeedback } = useArcadeFeedback(1900);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { angleRef.current = angle; }, [angle]);
  useEffect(() => { lockedAngleRef.current = lockedAngle; }, [lockedAngle]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { shotNoRef.current = shotNo; }, [shotNo]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);

  useEffect(() => {
    if (phase !== "angle" && phase !== "power") return;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - phaseStartedRef.current;
      if (phase === "angle") {
        setAngle(ANGLE_MIN + pingPong(elapsed, 2850) * (ANGLE_MAX - ANGLE_MIN));
      } else {
        setPower(0.34 + pingPong(elapsed, 2250) * 0.66);
      }
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
    setPhase("angle");
    phaseStartedRef.current = performance.now();
    setAngle(52);
    setLockedAngle(52);
    setPower(0.66);
    setDistance(Math.random() < 0.38 ? 3 : 2);
    setShotNo((value) => value + 1);
    setMessage(storyReadyRef.current ? "STORY READY // TAKE ONE LAST SHOT_" : "SET THE ARC // THEN SET POWER_");
  }

  function resolveBall(ball: BallState) {
    if (ball.scored) return;
    ball.scored = true;
    setPhase("result");

    if (ball.made) {
      const nextStreak = streakRef.current + 1;
      const streakBonus = Math.min(4, Math.floor(nextStreak / 3));
      const award = distanceRef.current + streakBonus;
      setStreak(nextStreak);
      const nextScore = Math.min(999, scoreRef.current + award);
      scoreRef.current = nextScore;
      onScoreChangeRef.current(nextScore);
      const swish = ball.rimHits === 0 && ball.glassHits === 0;
      setMessage(`${swish ? "NOTHING BUT NET" : "BUCKET"} // +${award} // STREAK ${nextStreak}_`);
      showFeedback({
        title: swish ? "SWISH!" : distanceRef.current === 3 ? "THREE!" : "BUCKET!",
        detail: ball.glassHits ? "OFF THE GLASS" : ball.rimHits ? "FRIENDLY RIM" : `SHOT ${shotNoRef.current}`,
        delta: award,
        tone: swish ? "great" : "good",
      }, 2050);
    } else {
      setStreak(0);
      const miss = ball.glassHits
        ? "OFF GLASS"
        : ball.rimHits
          ? "RIM OUT"
          : ball.x < FRONT_RIM_X - 30
            ? "SHORT"
            : ball.x > BACKBOARD_X + 35
              ? "LONG"
              : "BRICK";
      setMessage(`${miss} // ADJUST ANGLE OR POWER_`);
      showFeedback({ title: miss, detail: `SHOT ${shotNoRef.current} // NO POINTS`, tone: "bad" }, 1900);
    }

    resetTimerRef.current = window.setTimeout(resetShot, 2400);
  }

  resolveBallRef.current = resolveBall;

  function shooterX() {
    return distanceRef.current === 3 ? 74 : 118;
  }

  function launchBall(finalPower: number) {
    const x = shooterX() + 22;
    const y = FLOOR_Y - 64;
    const radians = lockedAngleRef.current * Math.PI / 180;
    const speed = 350 + finalPower * 205;

    ballRef.current = {
      x,
      y,
      previousX: x,
      previousY: y,
      vx: Math.cos(radians) * speed,
      vy: -Math.sin(radians) * speed,
      startedAt: performance.now(),
      made: false,
      scored: false,
      rimHits: 0,
      glassHits: 0,
      floorBounces: 0,
      trail: [],
    };
    setPhase("resolving");
    setMessage(`SHOT ${shotNoRef.current} // BALL LIVE_`);
  }

  function lockShotControl() {
    if (storyReady || phase === "resolving" || phase === "result") return;
    if (phase === "angle") {
      setLockedAngle(angle);
      setPhase("power");
      phaseStartedRef.current = performance.now();
      setMessage(`ANGLE ${Math.round(angle)}° LOCKED // SET POWER_`);
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
        ball.previousX = ball.x;
        ball.previousY = ball.y;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vy += GRAVITY * dt;
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 18) ball.trail.shift();

        // Backboard: side-view collision against the vertical glass plane.
        if (
          ball.x + BALL_RADIUS >= BACKBOARD_X &&
          ball.previousX + BALL_RADIUS < BACKBOARD_X &&
          ball.y > 78 &&
          ball.y < 194
        ) {
          ball.x = BACKBOARD_X - BALL_RADIUS - 0.5;
          ball.vx = -Math.abs(ball.vx) * 0.68;
          ball.vy *= 0.9;
          ball.glassHits += 1;
        }

        // Side-view rim: front and back iron are two physical collision points.
        const hitFront = collideCircle(ball, FRONT_RIM_X, RIM_Y, RIM_RADIUS);
        const hitBack = collideCircle(ball, BACK_RIM_X, RIM_Y, RIM_RADIUS);
        if ((hitFront || hitBack) && ball.rimHits < 6) ball.rimHits += 1;

        // Basket capture: the ball must physically descend through the opening.
        if (
          !ball.made &&
          ball.vy > 0 &&
          ball.previousY <= RIM_Y &&
          ball.y > RIM_Y &&
          ball.x > FRONT_RIM_X + BALL_RADIUS * 0.4 &&
          ball.x < BACK_RIM_X - BALL_RADIUS * 0.4
        ) {
          ball.made = true;
          ball.vx *= 0.26;
          ball.vy *= 0.58;
        }

        // Floor bounce is visual feedback after a miss/make; it is not pre-scored.
        if (ball.y + BALL_RADIUS >= FLOOR_Y) {
          ball.y = FLOOR_Y - BALL_RADIUS;
          if (Math.abs(ball.vy) > 48 && ball.floorBounces < 3) {
            ball.vy = -Math.abs(ball.vy) * 0.43;
            ball.vx *= 0.76;
            ball.floorBounces += 1;
          } else {
            ball.vy = 0;
            ball.vx *= 0.86;
          }
        }

        const elapsed = now - ball.startedAt;
        if (
          elapsed > 3600 ||
          (ball.floorBounces > 0 && Math.abs(ball.vy) < 8 && elapsed > 1700) ||
          ball.x < -80 ||
          ball.x > WIDTH + 100 ||
          ball.y < -100
        ) {
          resolveBallRef.current(ball);
        }
      }

      // VGA/DOS-style side-view gym.
      const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
      sky.addColorStop(0, "#071224");
      sky.addColorStop(1, "#102d47");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#18334c";
      ctx.fillRect(0, 38, WIDTH, 14);
      ctx.fillStyle = "#214b6d";
      for (let x = 12; x < WIDTH; x += 38) ctx.fillRect(x, 55, 23, 7);

      ctx.fillStyle = "#9c6334";
      ctx.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);
      ctx.fillStyle = "#d29a55";
      ctx.fillRect(0, FLOOR_Y, WIDTH, 3);
      ctx.strokeStyle = "rgba(255,236,185,0.32)";
      for (let x = 22; x < WIDTH; x += 52) {
        ctx.beginPath(); ctx.moveTo(x, FLOOR_Y); ctx.lineTo(x - 7, HEIGHT); ctx.stroke();
      }

      // Distance markers.
      ctx.strokeStyle = "#74bde7";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(108, FLOOR_Y); ctx.lineTo(108, FLOOR_Y - 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(64, FLOOR_Y); ctx.lineTo(64, FLOOR_Y - 22); ctx.stroke();
      ctx.fillStyle = "#a9d9f5";
      ctx.font = "700 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("2PT", 108, FLOOR_Y + 18);
      ctx.fillText("3PT", 64, FLOOR_Y + 18);

      // Backboard, rim and net from the side.
      ctx.fillStyle = "#e9eef2";
      ctx.fillRect(BACKBOARD_X, 77, 7, 119);
      ctx.fillStyle = "#93cae8";
      ctx.fillRect(BACKBOARD_X + 7, 108, 15, 6);
      ctx.strokeStyle = "#ff704b";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(FRONT_RIM_X, RIM_Y); ctx.lineTo(BACK_RIM_X, RIM_Y); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#f4f0d2";
      for (let x = FRONT_RIM_X + 4; x <= BACK_RIM_X - 4; x += 7) {
        ctx.beginPath(); ctx.moveTo(x, RIM_Y + 3); ctx.lineTo((FRONT_RIM_X + BACK_RIM_X) / 2, RIM_Y + 34); ctx.stroke();
      }

      // Simple side-view shooter sprite.
      const sx = distanceRef.current === 3 ? 74 : 118;
      ctx.fillStyle = "#67d9ff";
      ctx.fillRect(sx - 7, FLOOR_Y - 53, 14, 31);
      ctx.beginPath(); ctx.arc(sx, FLOOR_Y - 64, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#67d9ff";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx - 3, FLOOR_Y - 40); ctx.lineTo(sx - 12, FLOOR_Y - 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 3, FLOOR_Y - 40); ctx.lineTo(sx + 14, FLOOR_Y - 16); ctx.stroke();
      ctx.lineWidth = 1;

      // Angle preview projects from the ball release point toward the chosen arc.
      if (!ball && (phaseRef.current === "angle" || phaseRef.current === "power")) {
        const previewAngle = phaseRef.current === "angle" ? angleRef.current : lockedAngleRef.current;
        const radians = previewAngle * Math.PI / 180;
        const px = sx + 22;
        const py = FLOOR_Y - 64;
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = phaseRef.current === "angle" ? "#ffd568" : "#6fd8ff";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(radians) * 94, py - Math.sin(radians) * 94);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (ball) {
        // Fading trajectory dots make the arc readable without turning it into a modern effect soup.
        ball.trail.forEach((point, index) => {
          const alpha = ((index + 1) / Math.max(ball.trail.length, 1)) * 0.34;
          ctx.fillStyle = `rgba(255,154,66,${alpha.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = "#ff9a42";
        ctx.strokeStyle = "#6b2f0e";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
      }

      ctx.fillStyle = "#b9dff5";
      ctx.font = "700 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SHOT ${shotNoRef.current} // ${distanceRef.current}PT`, 22, 25);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd260";
      ctx.fillText(`${Math.round(phaseRef.current === "angle" ? angleRef.current : lockedAngleRef.current)}°`, WIDTH / 2, 25);
      ctx.textAlign = "right";
      ctx.fillText(`STREAK ${streakRef.current}`, WIDTH - 22, 25);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const anglePercent = ((angle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN)) * 100;
  const lockedAnglePercent = ((lockedAngle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN)) * 100;

  return (
    <div className="intermission-game basketball-game basketball-game-sideview">
      <header className="intermission-game-instructions">
        <strong>PIXEL HOOPS // SIDE-VIEW PHYSICS // REV 38H // {distance}-POINTER</strong>
        <span>ANGLE // POWER // SHOOT // RIM, GLASS + GRAVITY DECIDE THE RESULT</span>
      </header>

      <div className="arcade-physics-layout basketball-sideview-layout">
        <canvas
          ref={canvasRef}
          className="arcade-physics-canvas basketball-sideview-canvas"
          width={WIDTH}
          height={HEIGHT}
          aria-label="Side-view basketball angle and power physics simulation"
        />

        <div className="basketball-shot-controls" aria-label="Basketball shot controls">
          <section className={`basketball-angle-control ${phase === "angle" ? "active" : "locked"}`}>
            <div className="basketball-shot-control-heading">
              <strong>ANGLE</strong>
              <span>{Math.round(phase === "angle" ? angle : lockedAngle)}°</span>
            </div>
            <div className="basketball-angle-track" aria-label="Shot angle">
              <span className="basketball-angle-sweetspot" />
              <span
                className="basketball-angle-marker"
                style={{ left: `${phase === "angle" ? anglePercent : lockedAnglePercent}%` }}
              />
            </div>
            <div className="basketball-angle-scale"><span>{ANGLE_MIN}°</span><span>52°</span><span>{ANGLE_MAX}°</span></div>
          </section>

          <section className={`basketball-power-control ${phase === "power" ? "active" : phase === "angle" ? "waiting" : "locked"}`}>
            <div className="basketball-shot-control-heading">
              <strong>POWER</strong>
              <span>{Math.round(power * 100)}%</span>
            </div>
            <div className="basketball-power-track" aria-label="Shot power">
              <span className="basketball-power-sweetspot" />
              <span className="basketball-power-fill" style={{ height: `${power * 100}%` }} />
              <span className="basketball-power-marker" style={{ bottom: `${power * 100}%` }} />
            </div>
          </section>
        </div>
      </div>

      <button
        type="button"
        className="button primary arcade-shot-lock-button"
        onClick={lockShotControl}
        disabled={storyReady || phase === "resolving" || phase === "result"}
      >
        {phase === "angle" ? "LOCK ANGLE" : phase === "power" ? "SHOOT" : "BALL LIVE"}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
