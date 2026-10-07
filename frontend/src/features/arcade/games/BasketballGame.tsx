import { useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const WIDTH = 640;
const HEIGHT = 360;
const FLOOR_Y = 318;
const GRAVITY = 420;
const BALL_RADIUS = 8;
const RIM_RADIUS = 5;
const ANGLE_MIN = 36;
const ANGLE_MAX = 68;

type ShotPhase = "angle" | "power" | "resolving" | "result";

type TrailPoint = { x: number; y: number };

type CourtGeometry = {
  shooterX: number;
  frontRimX: number;
  backRimX: number;
  backboardX: number;
  rimY: number;
  shotLabel: string;
  hoopLabel: string;
};

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

function seeded01(seed: number) {
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295;
}

function courtGeometryForShot(turnNumber: number, shotNumber: number): CourtGeometry {
  const base = ((turnNumber + 17) * 1103515245) ^ (shotNumber * 2654435761);
  const r1 = seeded01(base ^ 0x45d9f3b);
  const r2 = seeded01(base ^ 0x27d4eb2d);
  const r3 = seeded01(base ^ 0x165667b1);

  // Every attempt is a reachable two-point shot, but the shooter and basket move.
  // The same turnNumber + shotNumber produces the same geometry for both players.
  const shooterX = 82 + Math.round(r1 * 112);
  const frontRimX = 468 + Math.round(r2 * 48);
  const backRimX = frontRimX + 34;
  const backboardX = backRimX + 22;
  const rimY = 134 + Math.round(r3 * 28);
  const span = frontRimX - shooterX;

  const shotLabel = span > 408 ? "DEEP TWO" : span > 348 ? "MIDRANGE" : "SHORT TWO";
  const hoopLabel = rimY < 143 ? "HIGH GLASS" : rimY > 153 ? "LOW RIM" : "CENTER RIM";

  return { shooterX, frontRimX, backRimX, backboardX, rimY, shotLabel, hoopLabel };
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

export function BasketballGame({ score, onScoreChange, storyReady, turnNumber }: ArcadeGameProps) {
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
  const streakRef = useRef(0);
  const shotNoRef = useRef(1);
  const geometryRef = useRef<CourtGeometry>(courtGeometryForShot(turnNumber, 1));
  const resolveBallRef = useRef<(ball: BallState) => void>(() => {});

  const [phase, setPhase] = useState<ShotPhase>("angle");
  const [angle, setAngle] = useState(52);
  const [lockedAngle, setLockedAngle] = useState(52);
  const [power, setPower] = useState(0.66);
  const [streak, setStreak] = useState(0);
  const [shotNo, setShotNo] = useState(1);
  const [geometry, setGeometry] = useState<CourtGeometry>(() => courtGeometryForShot(turnNumber, 1));
  const [message, setMessage] = useState("NEW SPOT // SET THE ARC // THEN SET POWER_");
  const { feedback, showFeedback } = useArcadeFeedback(1900);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { angleRef.current = angle; }, [angle]);
  useEffect(() => { lockedAngleRef.current = lockedAngle; }, [lockedAngle]);
  useEffect(() => { powerRef.current = power; }, [power]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { shotNoRef.current = shotNo; }, [shotNo]);
  useEffect(() => { geometryRef.current = geometry; }, [geometry]);
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
    const nextShot = shotNoRef.current + 1;
    const nextGeometry = courtGeometryForShot(turnNumber, nextShot);
    shotNoRef.current = nextShot;
    geometryRef.current = nextGeometry;
    setShotNo(nextShot);
    setGeometry(nextGeometry);
    setPhase("angle");
    phaseStartedRef.current = performance.now();
    setAngle(52);
    setLockedAngle(52);
    setPower(0.66);
    setMessage(storyReadyRef.current ? "STORY READY // TAKE ONE LAST SHOT_" : `${nextGeometry.shotLabel} // ${nextGeometry.hoopLabel} // SET THE ARC_`);
  }

  function resolveBall(ball: BallState) {
    if (ball.scored) return;
    ball.scored = true;
    setPhase("result");
    const currentGeometry = geometryRef.current;

    if (ball.made) {
      const nextStreak = streakRef.current + 1;
      const streakBonus = Math.min(4, Math.floor(nextStreak / 3));
      const award = 2 + streakBonus;
      setStreak(nextStreak);
      const nextScore = Math.min(999, scoreRef.current + award);
      scoreRef.current = nextScore;
      onScoreChangeRef.current(nextScore);
      const swish = ball.rimHits === 0 && ball.glassHits === 0;
      setMessage(`${swish ? "NOTHING BUT NET" : "BUCKET"} // +${award} // STREAK ${nextStreak}_`);
      showFeedback({
        title: swish ? "SWISH!" : "BUCKET!",
        detail: `${currentGeometry.shotLabel} // ${ball.glassHits ? "OFF THE GLASS" : ball.rimHits ? "FRIENDLY RIM" : `SHOT ${shotNoRef.current}`}`,
        delta: award,
        tone: swish ? "great" : "good",
      }, 2050);
    } else {
      setStreak(0);
      const miss = ball.glassHits
        ? "OFF GLASS"
        : ball.rimHits
          ? "RIM OUT"
          : ball.x < currentGeometry.frontRimX - 30
            ? "SHORT"
            : ball.x > currentGeometry.backboardX + 35
              ? "LONG"
              : "BRICK";
      setMessage(`${miss} // NEW GEOMETRY NEXT SHOT_`);
      showFeedback({ title: miss, detail: `${currentGeometry.shotLabel} // SHOT ${shotNoRef.current}`, tone: "bad" }, 1900);
    }

    resetTimerRef.current = window.setTimeout(resetShot, 2400);
  }

  resolveBallRef.current = resolveBall;

  function launchBall(finalPower: number) {
    const currentGeometry = geometryRef.current;
    const x = currentGeometry.shooterX + 22;
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
    setMessage(`SHOT ${shotNoRef.current} // ${currentGeometry.shotLabel} // BALL LIVE_`);
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
      const court = geometryRef.current;

      if (ball && phaseRef.current === "resolving") {
        ball.previousX = ball.x;
        ball.previousY = ball.y;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vy += GRAVITY * dt;
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 18) ball.trail.shift();

        // side-view collision against the vertical glass plane.
        if (
          ball.x + BALL_RADIUS >= court.backboardX &&
          ball.previousX + BALL_RADIUS < court.backboardX &&
          ball.y > court.rimY - 72 &&
          ball.y < court.rimY + 44
        ) {
          ball.x = court.backboardX - BALL_RADIUS - 0.5;
          ball.vx = -Math.abs(ball.vx) * 0.68;
          ball.vy *= 0.9;
          ball.glassHits += 1;
        }

        // Side-view rim: front and back iron are two physical collision points.
        const hitFront = collideCircle(ball, court.frontRimX, court.rimY, RIM_RADIUS);
        const hitBack = collideCircle(ball, court.backRimX, court.rimY, RIM_RADIUS);
        if ((hitFront || hitBack) && ball.rimHits < 6) ball.rimHits += 1;

        // Basket capture: descending ball must physically pass through the rim opening.
        if (
          !ball.made &&
          ball.vy > 0 &&
          ball.previousY <= court.rimY &&
          ball.y > court.rimY &&
          ball.x > court.frontRimX + BALL_RADIUS * 0.4 &&
          ball.x < court.backRimX - BALL_RADIUS * 0.4
        ) {
          ball.made = true;
          ball.vx *= 0.26;
          ball.vy *= 0.58;
        }

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

      // Changing two-point geometry is visible before every attempt.
      ctx.strokeStyle = "#74bde7";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(court.shooterX, FLOOR_Y); ctx.lineTo(court.shooterX, FLOOR_Y - 16); ctx.stroke();
      ctx.fillStyle = "#a9d9f5";
      ctx.font = "700 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(court.shotLabel, court.shooterX, FLOOR_Y + 17);

      ctx.fillStyle = "#e9eef2";
      ctx.fillRect(court.backboardX, court.rimY - 73, 7, 119);
      ctx.fillStyle = "#93cae8";
      ctx.fillRect(court.backboardX + 7, court.rimY - 42, 15, 6);
      ctx.strokeStyle = "#ff704b";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(court.frontRimX, court.rimY); ctx.lineTo(court.backRimX, court.rimY); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#f4f0d2";
      for (let x = court.frontRimX + 4; x <= court.backRimX - 4; x += 7) {
        ctx.beginPath(); ctx.moveTo(x, court.rimY + 3); ctx.lineTo((court.frontRimX + court.backRimX) / 2, court.rimY + 34); ctx.stroke();
      }

      const sx = court.shooterX;
      ctx.fillStyle = "#67d9ff";
      ctx.fillRect(sx - 7, FLOOR_Y - 53, 14, 31);
      ctx.beginPath(); ctx.arc(sx, FLOOR_Y - 64, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#67d9ff";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx - 3, FLOOR_Y - 40); ctx.lineTo(sx - 12, FLOOR_Y - 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 3, FLOOR_Y - 40); ctx.lineTo(sx + 14, FLOOR_Y - 16); ctx.stroke();
      ctx.lineWidth = 1;

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
      ctx.fillText(`SHOT ${shotNoRef.current} // ${court.shotLabel}`, 22, 25);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd260";
      ctx.fillText(`${Math.round(phaseRef.current === "angle" ? angleRef.current : lockedAngleRef.current)}° // ${court.hoopLabel}`, WIDTH / 2, 25);
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
  const shotDistance = geometry.frontRimX - (geometry.shooterX + 22);
  const suggestedAngle = clamp(49 + (shotDistance > 380 ? 4 : shotDistance < 320 ? -2 : 0) + (geometry.rimY < 143 ? 2 : geometry.rimY > 153 ? -1 : 0), 40, 62);
  const suggestedAnglePercent = ((suggestedAngle - ANGLE_MIN) / (ANGLE_MAX - ANGLE_MIN)) * 100;
  const suggestedPower = clamp(0.53 + (shotDistance - 285) / 520 + (150 - geometry.rimY) * 0.002, 0.48, 0.84);

  return (
    <div className="intermission-game basketball-game basketball-game-sideview">
      <header className="intermission-game-instructions">
        <strong>PIXEL HOOPS // VARIABLE SIDE-VIEW PHYSICS // REV 38I // {geometry.shotLabel}</strong>
        <span>NEW PLAYER + HOOP POSITION EACH SHOT // ANGLE // POWER // PHYSICS DECIDE</span>
      </header>

      <div className="arcade-physics-layout basketball-sideview-layout">
        <canvas
          ref={canvasRef}
          className="arcade-physics-canvas basketball-sideview-canvas"
          width={WIDTH}
          height={HEIGHT}
          aria-label="Side-view basketball angle and power physics simulation with variable player and hoop geometry"
        />

        <div className="basketball-shot-controls" aria-label="Basketball shot controls">
          <section className={`basketball-angle-control ${phase === "angle" ? "active" : "locked"}`}>
            <div className="basketball-shot-control-heading">
              <strong>ANGLE</strong>
              <span>{Math.round(phase === "angle" ? angle : lockedAngle)}°</span>
            </div>
            <div className="basketball-angle-track" aria-label="Shot angle">
              <span className="basketball-angle-sweetspot" style={{ left: `${clamp(suggestedAnglePercent - 8, 2, 82)}%` }} />
              <span
                className="basketball-angle-marker"
                style={{ left: `${phase === "angle" ? anglePercent : lockedAnglePercent}%` }}
              />
            </div>
            <div className="basketball-angle-scale"><span>{ANGLE_MIN}°</span><span>{Math.round(suggestedAngle)}°</span><span>{ANGLE_MAX}°</span></div>
          </section>

          <section className={`basketball-power-control ${phase === "power" ? "active" : phase === "angle" ? "waiting" : "locked"}`}>
            <div className="basketball-shot-control-heading">
              <strong>POWER</strong>
              <span>{Math.round(power * 100)}%</span>
            </div>
            <div className="basketball-power-track" aria-label="Shot power">
              <span className="basketball-power-sweetspot" style={{ bottom: `${clamp(suggestedPower * 100 - 9, 4, 78)}%` }} />
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
