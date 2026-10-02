import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 720;
const HEIGHT = 360;
const GROUND = 292;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function newHole() {
  return {
    target: 95 + Math.floor(Math.random() * 71),
    wind: Math.floor(Math.random() * 13) - 6,
  };
}

interface GolfShot {
  sample: TimingShotSample;
  distance: number;
  lateral: number;
  radialError: number;
  award: number;
  startedAt: number;
  scored: boolean;
}

export function GolfGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({ aimPeriodMs: 2050, powerPeriodMs: 1550, modifierPeriodMs: 1250 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const shotRef = useRef<GolfShot | null>(null);
  const frameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [hole, setHole] = useState(() => newHole());
  const holeRef = useRef(hole);
  const [landing, setLanding] = useState<{ distance: number; lateral: number } | null>(null);
  const landingRef = useRef<{ distance: number; lateral: number } | null>(null);
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SHOT SHAPE_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { holeRef.current = hole; }, [hole]);
  useEffect(() => { landingRef.current = landing; }, [landing]);

  function finishShot(shot: GolfShot) {
    if (shot.scored) return;
    shot.scored = true;
    const next = clamp(scoreRef.current + shot.award, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
    setLanding({ distance: shot.distance, lateral: shot.lateral });
    setMessage(shot.radialError < 6
      ? `PIN SEEKER // ${shot.radialError.toFixed(1)} YD ERROR // +${shot.award}_`
      : `SHOT LANDED // ${shot.radialError.toFixed(1)} YD ERROR // +${shot.award}_`);

    resetTimerRef.current = window.setTimeout(() => {
      shotRef.current = null;
      setLanding(null);
      const nextHole = newHole();
      setHole(nextHole);
      setMessage(storyReadyRef.current ? "STORY READY // LAST BALLS COUNT_" : "NEW HOLE // LOCK AIM_");
      engine.reset();
    }, 1350);
  }

  function startShot(sample: TimingShotSample) {
    const currentHole = holeRef.current;
    const distance = Math.round(185 * sample.power);
    const lateral = Math.round(sample.aim * 24 + sample.modifier * 18 + currentHole.wind * 1.4);
    const radialError = Math.hypot(distance - currentHole.target, lateral);
    const award = clamp(Math.round(30 - radialError / 2.5), 1, 30);
    shotRef.current = {
      sample,
      distance,
      lateral,
      radialError,
      award,
      startedAt: performance.now(),
      scored: false,
    };
    setMessage("BALL IN FLIGHT // PLEASE PRETEND THE CROWD GASPS_");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (now: number) => {
      const currentHole = holeRef.current;
      ctx.fillStyle = "#020702";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Cheap VGA sky, horizon, fairway, bunker and green.
      ctx.strokeStyle = "#123b1b";
      for (let y = 44; y < 170; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      ctx.fillStyle = "#061306";
      ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
      ctx.strokeStyle = "#2a7a3b";
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(WIDTH, GROUND);
      ctx.stroke();

      const xForYards = (yards: number) => 44 + clamp(yards / 190, 0, 1.08) * 620;
      const flagX = xForYards(currentHole.target);

      ctx.fillStyle = "#0a1c0c";
      ctx.beginPath();
      ctx.ellipse(flagX, GROUND - 3, 58, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3aa653";
      ctx.stroke();

      ctx.fillStyle = "#102814";
      ctx.beginPath();
      ctx.ellipse(flagX - 105, GROUND + 5, 34, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#7dff9b";
      ctx.beginPath();
      ctx.moveTo(flagX, GROUND - 8);
      ctx.lineTo(flagX, GROUND - 74);
      ctx.lineTo(flagX + 31, GROUND - 62);
      ctx.lineTo(flagX, GROUND - 51);
      ctx.stroke();

      ctx.fillStyle = "#7dff9b";
      ctx.font = "700 10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`PIN ${currentHole.target} YDS`, 18, 24);
      ctx.fillText(`WIND ${currentHole.wind >= 0 ? "+" : ""}${currentHole.wind} MPH`, 18, 40);

      // Tee marker.
      ctx.strokeStyle = "#3aa653";
      ctx.beginPath();
      ctx.moveTo(44, GROUND - 2);
      ctx.lineTo(44, GROUND - 14);
      ctx.stroke();

      let ballX = 44;
      let ballY = GROUND - 16;
      const shot = shotRef.current;
      if (shot) {
        const duration = 1150;
        const p = clamp((now - shot.startedAt) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - p, 1.55);
        const landingX = xForYards(shot.distance);
        const windBend = Math.sin(p * Math.PI) * (currentHole.wind + shot.sample.modifier * 4) * 1.5;
        ballX = 44 + (landingX - 44) * eased + windBend;
        const arcHeight = 68 + shot.sample.power * 112;
        ballY = GROUND - 16 - Math.sin(p * Math.PI) * arcHeight;

        // Flight trail.
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = "#235f31";
        ctx.beginPath();
        ctx.moveTo(44, GROUND - 16);
        for (let i = 1; i <= 18; i += 1) {
          const q = (p * i) / 18;
          const qx = 44 + (landingX - 44) * q + Math.sin(q * Math.PI) * (currentHole.wind + shot.sample.modifier * 4) * 1.5;
          const qy = GROUND - 16 - Math.sin(q * Math.PI) * arcHeight;
          ctx.lineTo(qx, qy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (p >= 1 && !shot.scored) finishShot(shot);
      }

      ctx.fillStyle = "#7dff9b";
      ctx.beginPath();
      ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
      ctx.fill();

      const last = landingRef.current;
      if (last) {
        const lx = xForYards(last.distance);
        ctx.strokeStyle = "#7dff9b";
        ctx.beginPath();
        ctx.moveTo(lx - 7, GROUND - 7);
        ctx.lineTo(lx + 7, GROUND + 7);
        ctx.moveTo(lx + 7, GROUND - 7);
        ctx.lineTo(lx - 7, GROUND + 7);
        ctx.stroke();

        // Tiny top-down dispersion inset: lateral error finally has a visible consequence.
        ctx.strokeStyle = "#235f31";
        ctx.strokeRect(WIDTH - 142, 18, 120, 72);
        ctx.beginPath();
        ctx.arc(WIDTH - 82, 54, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#7dff9b";
        ctx.fillRect(WIDTH - 84 + clamp(last.lateral, -28, 28) * 1.7, 69, 4, 4);
        ctx.font = "700 8px monospace";
        ctx.fillText("TOP VIEW", WIDTH - 134, 32);
      }

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

  const buttonLabel = engine.phase === "aim" ? "LOCK AIM" : engine.phase === "power" ? "LOCK POWER" : engine.phase === "modifier" ? "LOCK SHAPE" : "BALL IN FLIGHT";
  const windArrow = hole.wind === 0 ? "CALM" : hole.wind < 0 ? `${"<".repeat(Math.min(3, Math.ceil(Math.abs(hole.wind) / 2)))} ${Math.abs(hole.wind)} MPH` : `${">".repeat(Math.min(3, Math.ceil(Math.abs(hole.wind) / 2)))} ${hole.wind} MPH`;

  return (
    <div className="intermission-game timing-sport-game golf-game">
      <header className="intermission-game-instructions">
        <strong>PIXEL LINKS // CLOSEST TO THE PIN</strong>
        <span>SPACE / ENTER / TAP // AIM → POWER → SHOT SHAPE</span>
        <span>TARGET {hole.target} YDS // WIND {windArrow}</span>
      </header>

      <canvas
        ref={canvasRef}
        className="arcade-canvas retro-sport-canvas"
        width={WIDTH}
        height={HEIGHT}
        tabIndex={0}
        onKeyDown={keyDown}
        aria-label="Animated retro golf hole"
      />

      <TimingShotMeters phase={engine.phase} aim={engine.aim} power={engine.power} modifier={engine.modifier} modifierLabel="SHAPE" />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>{landing ? `${landing.distance}Y // ${Math.abs(landing.lateral)}Y OFFLINE` : "PAR IS A SUGGESTION"}</strong></footer>
    </div>
  );
}
