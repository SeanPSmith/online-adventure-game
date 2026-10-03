import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 360;

type LaneOil = "DRY" | "HOUSE" | "OILY";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

interface BowlingShot {
  sample: TimingShotSample;
  knocked: number;
  award: number;
  startedAt: number;
  scored: boolean;
}

const PIN_LAYOUT = [
  [0, 0],
  [-18, 16], [18, 16],
  [-36, 32], [0, 32], [36, 32],
  [-54, 48], [-18, 48], [18, 48], [54, 48],
] as const;

function randomOil(): LaneOil {
  const roll = Math.random();
  return roll < 0.3 ? "DRY" : roll < 0.78 ? "HOUSE" : "OILY";
}

function spinFactor(oil: LaneOil) {
  return oil === "DRY" ? 0.43 : oil === "OILY" ? 0.23 : 0.33;
}

export function BowlingGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({ aimPeriodMs: 2850, powerPeriodMs: 2250, modifierPeriodMs: 2750 });
  const { feedback, showFeedback } = useArcadeFeedback(1250);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const shotRef = useRef<BowlingShot | null>(null);
  const aimRef = useRef(engine.aim);
  const pinsDownRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [pinsDown, setPinsDown] = useState(0);
  const [oil, setOil] = useState<LaneOil>(() => randomOil());
  const oilRef = useRef(oil);
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SPIN_");

  const spinHelp = useMemo(() => oil === "DRY" ? "HOOKS EARLY" : oil === "OILY" ? "SLIDES LONG" : "NORMAL HOUSE SHOT", [oil]);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { aimRef.current = engine.aim; }, [engine.aim]);
  useEffect(() => { pinsDownRef.current = pinsDown; }, [pinsDown]);
  useEffect(() => { oilRef.current = oil; }, [oil]);

  function finishShot(shot: BowlingShot) {
    if (shot.scored) return;
    shot.scored = true;
    const next = clamp(scoreRef.current + shot.award, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
    setPinsDown(shot.knocked);

    if (shot.knocked === 10) {
      setMessage("STRIKE // THAT WAS DISGUSTING // +25_");
      showFeedback({ title: "STRIKE!", detail: "ALL TEN // CLEAN POCKET", delta: 25, tone: "great" }, 1450);
    } else if (shot.knocked >= 8) {
      setMessage(`${shot.knocked} PINS // SOLID HIT // +${shot.award}_`);
      showFeedback({ title: `${shot.knocked} PINS`, detail: "SOLID POCKET HIT", delta: shot.award, tone: "good" });
    } else if (shot.knocked >= 4) {
      setMessage(`${shot.knocked} PINS // WORKABLE // +${shot.award}_`);
      showFeedback({ title: `${shot.knocked} PINS`, detail: "YOU DEFINITELY HIT SOMETHING", delta: shot.award, tone: "neutral" });
    } else {
      setMessage(`${shot.knocked} PINS // FIND THE POCKET // +${shot.award}_`);
      showFeedback({ title: shot.knocked === 0 ? "GUTTER ENERGY" : `${shot.knocked} PINS`, detail: "THE LANE REMAINS UNIMPRESSED", delta: shot.award, tone: "bad" });
    }

    resetTimerRef.current = window.setTimeout(() => {
      shotRef.current = null;
      setPinsDown(0);
      setOil(randomOil());
      setMessage(storyReadyRef.current ? "STORY READY // ONE MORE FRAME IF YOU HAVE IT_" : "NEXT FRAME // LOCK AIM_");
      engine.reset();
    }, 1850);
  }

  function startShot(sample: TimingShotSample) {
    const oilFactor = spinFactor(oilRef.current);
    const line = sample.aim * 0.74 + sample.modifier * oilFactor;
    const centerQuality = clamp(1 - Math.abs(line), 0, 1);
    // More forgiving power window than the first pass.
    const powerQuality = clamp(1 - Math.abs(sample.power - 0.78) / 0.64, 0, 1);
    const impact = clamp(centerQuality * 0.7 + powerQuality * 0.3, 0, 1);
    let knocked = Math.round(impact * 10 + (Math.random() * 1.25 - 0.25));
    if (centerQuality > 0.9 && sample.power > 0.65) knocked = 10;
    knocked = clamp(knocked, 0, 10);
    const award = knocked === 10 ? 25 : knocked * 2;

    shotRef.current = {
      sample,
      knocked,
      award,
      startedAt: performance.now(),
      scored: false,
    };
    setMessage("BALL AWAY // WATCH THE BREAK_");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const draw = (now: number) => {
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Back wall and pin deck.
      ctx.strokeStyle = "#1e6a2e";
      ctx.fillStyle = "#041004";
      ctx.fillRect(255, 32, 210, 62);
      ctx.strokeRect(255, 32, 210, 62);
      ctx.fillStyle = "#7dff9b";
      ctx.font = "700 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("KINGPIN LANES", WIDTH / 2, 58);
      ctx.font = "700 10px monospace";
      ctx.fillStyle = "#3aa653";
      ctx.fillText(`${oilRef.current} OIL // ${oilRef.current === "DRY" ? "EARLY HOOK" : oilRef.current === "OILY" ? "LATE BREAK" : "HOUSE SHOT"}`, WIDTH / 2, 77);

      // Perspective lane and gutters.
      ctx.fillStyle = "#071307";
      ctx.beginPath();
      ctx.moveTo(292, 94);
      ctx.lineTo(428, 94);
      ctx.lineTo(620, 335);
      ctx.lineTo(100, 335);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#3aa653";
      ctx.stroke();

      ctx.strokeStyle = "#164d23";
      ctx.beginPath();
      ctx.moveTo(285, 94);
      ctx.lineTo(78, 335);
      ctx.moveTo(435, 94);
      ctx.lineTo(642, 335);
      ctx.stroke();

      for (let i = 1; i <= 7; i += 1) {
        const p = i / 8;
        const y = 100 + p * 215;
        const half = 66 + p * 176;
        ctx.strokeStyle = i === 7 ? "#3aa653" : "#0f3618";
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2 - half, y);
        ctx.lineTo(WIDTH / 2 + half, y);
        ctx.stroke();
      }

      // Aim guide is visible before release so success is learnable.
      if (!shotRef.current) {
        const guideX = WIDTH / 2 + aimRef.current * 60;
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = "#235f31";
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2 + aimRef.current * 105, 309);
        ctx.lineTo(guideX, 111);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      PIN_LAYOUT.forEach(([dx, dy], index) => {
        const pinX = WIDTH / 2 + dx * 0.72;
        const pinY = 104 + dy * 0.58;
        const down = index < pinsDownRef.current;
        ctx.strokeStyle = down ? "#235f31" : "#7dff9b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (down) {
          const scatter = ((index % 3) - 1) * 8;
          ctx.moveTo(pinX - 7 + scatter, pinY + 5);
          ctx.lineTo(pinX + 7 + scatter, pinY + 1);
        } else {
          ctx.moveTo(pinX, pinY - 6);
          ctx.lineTo(pinX - 4, pinY + 6);
          ctx.lineTo(pinX + 4, pinY + 6);
          ctx.closePath();
        }
        ctx.stroke();
      });
      ctx.lineWidth = 1;

      let ballX = WIDTH / 2 + aimRef.current * 105;
      let ballY = 308;
      let radius = 13;
      const shot = shotRef.current;

      if (shot) {
        const duration = 1080;
        const p = clamp((now - shot.startedAt) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - p, 2.15);
        const startX = WIDTH / 2 + shot.sample.aim * 105;
        const oilFactor = spinFactor(oilRef.current);
        const endX = WIDTH / 2 + shot.sample.aim * 48 + shot.sample.modifier * oilFactor * 105;
        const curve = Math.sin(p * Math.PI) * shot.sample.modifier * oilFactor * 74;
        ballX = startX + (endX - startX) * eased + curve;
        ballY = 308 - eased * 190;
        radius = 13 - eased * 7;

        if (p >= 0.92) {
          // Impact flash makes it impossible to miss the moment the pins are hit.
          const flash = 1 - clamp((p - 0.92) / 0.08, 0, 1);
          ctx.strokeStyle = `rgba(125,255,155,${flash})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(WIDTH / 2, 113, 18 + (1 - flash) * 28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        if (p >= 1 && !shot.scored) finishShot(shot);
      }

      ctx.fillStyle = "#7dff9b";
      ctx.beginPath();
      ctx.arc(ballX, ballY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#020702";
      ctx.beginPath();
      ctx.arc(ballX - radius * 0.25, ballY - radius * 0.15, Math.max(1.2, radius * 0.12), 0, Math.PI * 2);
      ctx.fill();

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    canvas.focus({ preventScroll: true });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, [engine.reset]);

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
    <div className="intermission-game timing-sport-game bowling-game">
      <header className="intermission-game-instructions">
        <strong>BOWL-O-MATIC // THREE-TAP DELIVERY</strong>
        <span>SPACE / ENTER / TAP // AIM → POWER → SPIN // GREEN BANDS = GOOD WINDOWS</span>
        <span>{oil} OIL // {spinHelp} // STRIKE +25</span>
      </header>

      <div className="arcade-playfield">
        <canvas
          ref={canvasRef}
          className="arcade-canvas retro-sport-canvas"
          width={WIDTH}
          height={HEIGHT}
          tabIndex={0}
          onKeyDown={keyDown}
          aria-label="Animated retro bowling lane"
        />
        <ArcadeFeedback feedback={feedback} />
      </div>

      <TimingShotMeters
        phase={engine.phase}
        aim={engine.aim}
        power={engine.power}
        modifier={engine.modifier}
        modifierLabel="SPIN"
        aimTarget={0}
        aimTolerance={0.34}
        powerTarget={0.78}
        powerTolerance={0.28}
        modifierTarget={0}
        modifierTolerance={0.5}
      />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>{pinsDown > 0 ? `${pinsDown}/10 DOWN` : `${oil} OIL`}</strong></footer>
    </div>
  );
}
