import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 640;
const HEIGHT = 390;
const LANE_LEFT = 116;
const LANE_RIGHT = 524;
const BALL_START_Y = 344;
const PIN_RADIUS = 9;
const BALL_RADIUS = 11;

type LaneOil = "DRY" | "HOUSE" | "OILY";

type PinBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angular: number;
  knocked: boolean;
};

type BallBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  startedAt: number;
  gutter: boolean;
  resolved: boolean;
};

type BowlingShot = {
  sample: TimingShotSample;
  ball: BallBody;
};

const PIN_LAYOUT = [
  { x: 320, y: 112 },
  { x: 304, y: 91 }, { x: 336, y: 91 },
  { x: 288, y: 70 }, { x: 320, y: 70 }, { x: 352, y: 70 },
  { x: 272, y: 49 }, { x: 304, y: 49 }, { x: 336, y: 49 }, { x: 368, y: 49 },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomOil(): LaneOil {
  const roll = Math.random();
  return roll < 0.3 ? "DRY" : roll < 0.78 ? "HOUSE" : "OILY";
}

function spinFactor(oil: LaneOil) {
  return oil === "DRY" ? 1.25 : oil === "OILY" ? 0.62 : 0.92;
}

function freshPins(): PinBody[] {
  return PIN_LAYOUT.map((pin) => ({ x: pin.x, y: pin.y, vx: 0, vy: 0, angle: 0, angular: 0, knocked: false }));
}

export function BowlingGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({ aimPeriodMs: 3250, powerPeriodMs: 2700, modifierPeriodMs: 3050 });
  const { feedback, showFeedback } = useArcadeFeedback(1700);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const shotRef = useRef<BowlingShot | null>(null);
  const pinsRef = useRef<PinBody[]>(freshPins());
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const oilRef = useRef<LaneOil>("HOUSE");
  const finishRef = useRef<(shot: BowlingShot) => void>(() => {});
  const aimRef = useRef(engine.aim);

  const [pinsDown, setPinsDown] = useState(0);
  const [oil, setOil] = useState<LaneOil>(() => randomOil());
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SPIN_");

  const spinHelp = useMemo(
    () => oil === "DRY" ? "HOOKS EARLY" : oil === "OILY" ? "SLIDES LONG" : "NORMAL HOUSE SHOT",
    [oil],
  );

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { oilRef.current = oil; }, [oil]);
  useEffect(() => { aimRef.current = engine.aim; }, [engine.aim]);

  function finishShot(shot: BowlingShot) {
    if (shot.ball.resolved) return;
    shot.ball.resolved = true;
    const knocked = pinsRef.current.filter((pin) => pin.knocked).length;
    const award = knocked === 10 ? 25 : knocked * 2;
    const next = clamp(scoreRef.current + award, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
    setPinsDown(knocked);

    if (knocked === 10) {
      setMessage("STRIKE // THE RACK EXPLODED // +25_");
      showFeedback({ title: "STRIKE!", detail: "ALL TEN // PHYSICS DID THE WORK", delta: 25, tone: "great" }, 1900);
    } else if (knocked >= 8) {
      setMessage(`${knocked} PINS // HEAVY POCKET // +${award}_`);
      showFeedback({ title: `${knocked} PINS`, detail: "SOLID POCKET HIT", delta: award, tone: "good" }, 1750);
    } else if (knocked >= 4) {
      setMessage(`${knocked} PINS // WORKABLE // +${award}_`);
      showFeedback({ title: `${knocked} PINS`, detail: "WATCH THE LEAVE", delta: award, tone: "neutral" }, 1650);
    } else {
      const title = shot.ball.gutter ? "GUTTER BALL" : `${knocked} PINS`;
      setMessage(`${title} // CHANGE LINE / POWER / SPIN_`);
      showFeedback({ title, detail: knocked ? "LIGHT CONTACT" : "THE RACK SURVIVES", delta: award, tone: "bad" }, 1650);
    }

    resetTimerRef.current = window.setTimeout(() => {
      shotRef.current = null;
      pinsRef.current = freshPins();
      setPinsDown(0);
      setOil(randomOil());
      setMessage(storyReadyRef.current ? "STORY READY // ONE MORE FRAME IF YOU HAVE IT_" : "NEXT FRAME // LOCK AIM_");
      engine.reset();
    }, 2950);
  }

  finishRef.current = finishShot;

  function startShot(sample: TimingShotSample) {
    pinsRef.current = freshPins();
    const targetX = WIDTH / 2 + sample.aim * 118;
    const speed = 190 + sample.power * 145;
    const travelSeconds = 1.05;
    const vx = (targetX - WIDTH / 2) / travelSeconds;
    shotRef.current = {
      sample,
      ball: {
        x: WIDTH / 2,
        y: BALL_START_Y,
        vx,
        vy: -speed,
        spin: sample.modifier * spinFactor(oilRef.current),
        startedAt: performance.now(),
        gutter: false,
        resolved: false,
      },
    };
    setMessage("BALL AWAY // WATCH THE HOOK + PIN ACTION_");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let previous = performance.now();

    function resolvePinCollision(a: PinBody, b: PinBody) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = PIN_RADIUS * 2;
      if (dist <= 0 || dist >= minDist) return;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative > 0) return;
      const impulse = Math.abs(relative) * 0.38 + 8;
      a.vx += nx * impulse * 0.35;
      a.vy += ny * impulse * 0.35;
      b.vx -= nx * impulse * 0.35;
      b.vy -= ny * impulse * 0.35;
      if (Math.hypot(a.vx, a.vy) > 38) a.knocked = true;
      if (Math.hypot(b.vx, b.vy) > 38) b.knocked = true;
    }

    const draw = (now: number) => {
      const dt = clamp((now - previous) / 1000, 0, 0.028);
      previous = now;
      const shot = shotRef.current;

      if (shot && !shot.ball.resolved) {
        const ball = shot.ball;
        const hookBuild = clamp((BALL_START_Y - ball.y) / 230, 0, 1);
        ball.vx += ball.spin * hookBuild * 58 * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vy *= Math.pow(0.997, dt * 60);

        if (!ball.gutter && (ball.x < LANE_LEFT + 18 || ball.x > LANE_RIGHT - 18)) {
          ball.gutter = true;
          ball.x = ball.x < WIDTH / 2 ? LANE_LEFT + 8 : LANE_RIGHT - 8;
          ball.vx = 0;
          ball.vy *= 0.88;
        }

        if (!ball.gutter) {
          for (const pin of pinsRef.current) {
            const dx = pin.x - ball.x;
            const dy = pin.y - ball.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0 && dist < BALL_RADIUS + PIN_RADIUS) {
              const nx = dx / dist;
              const ny = dy / dist;
              const speed = Math.hypot(ball.vx, ball.vy);
              pin.knocked = true;
              pin.vx += nx * speed * 0.48 + ball.vx * 0.12;
              pin.vy += ny * speed * 0.48 + ball.vy * 0.12;
              pin.angular += (Math.random() - 0.5) * 9;
              ball.vx -= nx * speed * 0.07;
              ball.vy *= 0.92;
              const overlap = BALL_RADIUS + PIN_RADIUS - dist;
              ball.x -= nx * overlap * 0.45;
              ball.y -= ny * overlap * 0.45;
            }
          }
        }

        for (const pin of pinsRef.current) {
          if (!pin.knocked) continue;
          pin.x += pin.vx * dt;
          pin.y += pin.vy * dt;
          pin.angle += pin.angular * dt;
          pin.vx *= Math.pow(0.94, dt * 60);
          pin.vy *= Math.pow(0.94, dt * 60);
          pin.angular *= Math.pow(0.94, dt * 60);
          if (pin.x < LANE_LEFT + PIN_RADIUS) { pin.x = LANE_LEFT + PIN_RADIUS; pin.vx = Math.abs(pin.vx) * 0.55; }
          if (pin.x > LANE_RIGHT - PIN_RADIUS) { pin.x = LANE_RIGHT - PIN_RADIUS; pin.vx = -Math.abs(pin.vx) * 0.55; }
          if (pin.y < 24) { pin.y = 24; pin.vy = Math.abs(pin.vy) * 0.45; }
          if (pin.y > 145) { pin.y = 145; pin.vy = -Math.abs(pin.vy) * 0.45; }
        }

        for (let i = 0; i < pinsRef.current.length; i += 1) {
          for (let j = i + 1; j < pinsRef.current.length; j += 1) {
            const a = pinsRef.current[i];
            const b = pinsRef.current[j];
            if (a.knocked || b.knocked) resolvePinCollision(a, b);
          }
        }

        const elapsed = now - ball.startedAt;
        const movingPins = pinsRef.current.some((pin) => pin.knocked && Math.hypot(pin.vx, pin.vy) > 7);
        if (elapsed > 2800 || (ball.y < 8 && elapsed > 1500 && !movingPins)) finishRef.current(shot);
      }

      // Top-down lane / gutters.
      ctx.fillStyle = "#07101a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#152735";
      ctx.fillRect(72, 18, WIDTH - 144, HEIGHT - 36);
      ctx.fillStyle = "#08131c";
      ctx.fillRect(82, 18, 34, HEIGHT - 36);
      ctx.fillRect(524, 18, 34, HEIGHT - 36);
      ctx.fillStyle = "#c99b58";
      ctx.fillRect(LANE_LEFT, 18, LANE_RIGHT - LANE_LEFT, HEIGHT - 36);
      for (let x = LANE_LEFT; x < LANE_RIGHT; x += 18) {
        ctx.fillStyle = x % 36 === 0 ? "#b7874d" : "#d2a866";
        ctx.fillRect(x, 18, 1, HEIGHT - 36);
      }
      ctx.strokeStyle = "#f2d7a3";
      ctx.strokeRect(LANE_LEFT, 18, LANE_RIGHT - LANE_LEFT, HEIGHT - 36);
      ctx.strokeStyle = "#7d4d24";
      ctx.beginPath(); ctx.moveTo(LANE_LEFT, 294); ctx.lineTo(LANE_RIGHT, 294); ctx.stroke();

      // Arrows and aim guide.
      ctx.fillStyle = "#5d3722";
      for (const x of [248, 284, 320, 356, 392]) {
        ctx.beginPath(); ctx.moveTo(x, 232); ctx.lineTo(x - 6, 244); ctx.lineTo(x + 6, 244); ctx.closePath(); ctx.fill();
      }
      if (!shot) {
        const targetX = WIDTH / 2 + aimRef.current * 118;
        ctx.setLineDash([6, 7]);
        ctx.strokeStyle = "#2d6d86";
        ctx.beginPath(); ctx.moveTo(WIDTH / 2, BALL_START_Y); ctx.lineTo(targetX, 102); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pins are dynamic bodies.
      for (const pin of pinsRef.current) {
        ctx.save();
        ctx.translate(pin.x, pin.y);
        ctx.rotate(pin.angle);
        ctx.fillStyle = pin.knocked ? "#efe5cf" : "#fff7df";
        ctx.strokeStyle = "#85342c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, pin.knocked ? 11 : 8, pin.knocked ? 6 : 12, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#d9443f";
        ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.stroke();
        ctx.restore();
      }

      if (shot) {
        const ball = shot.ball;
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath(); ctx.ellipse(ball.x + 3, ball.y + 5, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#26213f";
        ctx.strokeStyle = "#6fd8ff";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#02050a";
        ctx.beginPath(); ctx.arc(ball.x - 3, ball.y - 3, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ball.x + 2, ball.y - 4, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1;
      } else {
        ctx.fillStyle = "#26213f";
        ctx.beginPath(); ctx.arc(WIDTH / 2, BALL_START_Y, BALL_RADIUS, 0, Math.PI * 2); ctx.fill();
      }

      ctx.fillStyle = "#9ed9f5";
      ctx.font = "700 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`KINGPIN // ${oilRef.current} OIL`, 26, 34);
      ctx.textAlign = "right";
      ctx.fillStyle = "#f4cf66";
      const liveDown = pinsRef.current.filter((pin) => pin.knocked).length;
      ctx.fillText(`${liveDown}/10 DOWN`, WIDTH - 26, 34);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    canvas.focus({ preventScroll: true });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
    };
  }, []);

  function action() {
    const sample = engine.lock();
    if (sample) startShot(sample);
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      action();
    }
  }

  const buttonLabel = engine.phase === "aim" ? "LOCK AIM"
    : engine.phase === "power" ? "LOCK POWER"
      : engine.phase === "modifier" ? "LOCK SPIN"
        : "BALL IN MOTION";

  return (
    <div className="intermission-game timing-sport-game bowling-game bowling-game-v2">
      <header className="intermission-game-instructions">
        <strong>BOWL-O-MATIC // TOP-DOWN PHYSICS LANES</strong>
        <span>HORIZONTAL AIM → VERTICAL POWER → SPIN // BALL + PIN COLLISIONS DETERMINE THE SCORE</span>
        <span>{oil} OIL // {spinHelp} // STRIKE +25</span>
      </header>

      <div className="arcade-playfield">
        <canvas ref={canvasRef} className="arcade-canvas retro-sport-canvas bowling-physics-canvas" width={WIDTH} height={HEIGHT} tabIndex={0} onKeyDown={keyDown} aria-label="Top-down physics bowling lane" />
        <ArcadeFeedback feedback={feedback} />
      </div>

      <TimingShotMeters
        phase={engine.phase}
        aim={engine.aim}
        power={engine.power}
        modifier={engine.modifier}
        modifierLabel="SPIN"
        aimTarget={0}
        aimTolerance={0.4}
        powerTarget={0.78}
        powerTolerance={0.32}
        modifierTarget={0}
        modifierTolerance={0.55}
      />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving" || storyReady} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>{pinsDown > 0 ? `${pinsDown}/10 DOWN` : `${oil} OIL`}</strong></footer>
    </div>
  );
}
