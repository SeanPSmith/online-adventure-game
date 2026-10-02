import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 360;

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

export function BowlingGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({ aimPeriodMs: 1900, powerPeriodMs: 1350, modifierPeriodMs: 1550 });
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
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SPIN_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { aimRef.current = engine.aim; }, [engine.aim]);
  useEffect(() => { pinsDownRef.current = pinsDown; }, [pinsDown]);

  function finishShot(shot: BowlingShot) {
    if (shot.scored) return;
    shot.scored = true;
    const next = clamp(scoreRef.current + shot.award, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
    setPinsDown(shot.knocked);
    setMessage(shot.knocked === 10 ? "STRIKE // +25_" : `${shot.knocked} PINS // +${shot.award}_`);

    resetTimerRef.current = window.setTimeout(() => {
      shotRef.current = null;
      setPinsDown(0);
      setMessage(storyReadyRef.current ? "STORY READY // ONE MORE FRAME IF YOU HAVE IT_" : "NEXT FRAME // LOCK AIM_");
      engine.reset();
    }, 1050);
  }

  function startShot(sample: TimingShotSample) {
    const line = sample.aim * 0.78 + sample.modifier * 0.34;
    const centerQuality = clamp(1 - Math.abs(line), 0, 1);
    const powerQuality = clamp(1 - Math.abs(sample.power - 0.82) / 0.82, 0, 1);
    const impact = clamp(centerQuality * 0.72 + powerQuality * 0.28, 0, 1);
    let knocked = Math.round(impact * 10 + (Math.random() * 1.4 - 0.4));
    if (centerQuality > 0.93 && sample.power > 0.72) knocked = 10;
    knocked = clamp(knocked, 0, 10);
    const award = knocked === 10 ? 25 : knocked * 2;

    shotRef.current = {
      sample,
      knocked,
      award,
      startedAt: performance.now(),
      scored: false,
    };
    setMessage("BALL AWAY // HOLD THE LINE_");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
      ctx.fillText("AUTOMATIC SCORING // PROBABLY", WIDTH / 2, 77);

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

      // Pins. Knocked pins become little sideways dashes after impact.
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

      let ballX = WIDTH / 2 + aimRef.current * 105;
      let ballY = 308;
      let radius = 13;
      const shot = shotRef.current;

      if (shot) {
        const duration = 920;
        const p = clamp((now - shot.startedAt) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - p, 2.2);
        const startX = WIDTH / 2 + shot.sample.aim * 105;
        const endX = WIDTH / 2 + (shot.sample.aim * 52) + (shot.sample.modifier * 34);
        const curve = Math.sin(p * Math.PI) * shot.sample.modifier * 28;
        ballX = startX + (endX - startX) * eased + curve;
        ballY = 308 - eased * 190;
        radius = 13 - eased * 7;

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

  const buttonLabel = engine.phase === "aim" ? "LOCK AIM" : engine.phase === "power" ? "LOCK POWER" : engine.phase === "modifier" ? "LOCK SPIN" : "BALL IN MOTION";

  return (
    <div className="intermission-game timing-sport-game bowling-game">
      <header className="intermission-game-instructions">
        <strong>BOWL-O-MATIC // THREE-TAP DELIVERY</strong>
        <span>SPACE / ENTER / TAP // AIM → POWER → SPIN</span>
        <span>STRIKE +25 // OTHERWISE +2 PER PIN</span>
      </header>

      <canvas
        ref={canvasRef}
        className="arcade-canvas retro-sport-canvas"
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        onKeyDown={keyDown}
        aria-label="Animated retro bowling lane"
      />

      <TimingShotMeters phase={engine.phase} aim={engine.aim} power={engine.power} modifier={engine.modifier} modifierLabel="SPIN" />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>{pinsDown > 0 ? `${pinsDown}/10 DOWN` : "VGA LEAGUE"}</strong></footer>
    </div>
  );
}
