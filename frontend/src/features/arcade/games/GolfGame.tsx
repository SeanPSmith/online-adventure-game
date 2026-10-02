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
      }

      // Live top-down course map. Unlike the old decorative inset, both axes
      // are meaningful: vertical position is carry distance and horizontal
      // position is lateral drift. The rendered curve uses the same aim,
      // shot-shape, and wind inputs that determine the authoritative landing.
      const mapX = WIDTH - 194;
      const mapY = 16;
      const mapW = 172;
      const mapH = 128;
      const mapCenterX = mapX + mapW / 2;
      const mapTop = mapY + 22;
      const mapBottom = mapY + mapH - 12;
      const mapMaxDistance = Math.max(190, currentHole.target + 22);
      const mapUsableHeight = mapBottom - mapTop;
      const lateralScale = (mapW * 0.39) / 35;

      const mapPoint = (distance: number, lateral: number) => ({
        x: mapCenterX + clamp(lateral, -35, 35) * lateralScale,
        y: mapBottom - clamp(distance / mapMaxDistance, 0, 1) * mapUsableHeight,
      });

      ctx.fillStyle = "#030c04";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.strokeStyle = "#235f31";
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      // Crude VGA fairway taper.
      ctx.fillStyle = "#071807";
      ctx.beginPath();
      ctx.moveTo(mapCenterX - 22, mapBottom);
      ctx.lineTo(mapCenterX - 58, mapTop);
      ctx.lineTo(mapCenterX + 58, mapTop);
      ctx.lineTo(mapCenterX + 22, mapBottom);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#164822";
      ctx.stroke();

      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = "#164822";
      ctx.beginPath();
      ctx.moveTo(mapCenterX, mapBottom);
      ctx.lineTo(mapCenterX, mapTop);
      ctx.stroke();
      ctx.setLineDash([]);

      const pinMap = mapPoint(currentHole.target, 0);
      ctx.fillStyle = "#0b2611";
      ctx.beginPath();
      ctx.ellipse(pinMap.x, pinMap.y, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3aa653";
      ctx.stroke();
      ctx.strokeStyle = "#7dff9b";
      ctx.beginPath();
      ctx.moveTo(pinMap.x, pinMap.y + 4);
      ctx.lineTo(pinMap.x, pinMap.y - 11);
      ctx.lineTo(pinMap.x + 7, pinMap.y - 8);
      ctx.stroke();

      const teeMap = mapPoint(0, 0);
      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(teeMap.x - 2, teeMap.y - 2, 4, 4);

      const mapShot = shotRef.current;
      if (mapShot) {
        const duration = 1150;
        const rawProgress = clamp((now - mapShot.startedAt) / duration, 0, 1);
        const progress = 1 - Math.pow(1 - rawProgress, 1.55);
        const aimComponent = mapShot.sample.aim * 24;
        const curveComponent = (mapShot.sample.modifier * 18) + (currentHole.wind * 1.4);
        const lateralAt = (q: number) => (aimComponent * q) + (curveComponent * q * q);

        // Full predicted shot shape, then brighter traveled portion over it.
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = "#1e5b2d";
        ctx.beginPath();
        for (let i = 0; i <= 24; i += 1) {
          const q = i / 24;
          const point = mapPoint(mapShot.distance * q, lateralAt(q));
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#7dff9b";
        ctx.beginPath();
        const traveledSteps = Math.max(1, Math.ceil(progress * 24));
        for (let i = 0; i <= traveledSteps; i += 1) {
          const q = Math.min(progress, (i / traveledSteps) * progress);
          const point = mapPoint(mapShot.distance * q, lateralAt(q));
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();

        const liveMapBall = mapPoint(mapShot.distance * progress, lateralAt(progress));
        ctx.fillStyle = "#7dff9b";
        ctx.beginPath();
        ctx.arc(liveMapBall.x, liveMapBall.y, 3, 0, Math.PI * 2);
        ctx.fill();

        const predictedLanding = mapPoint(mapShot.distance, mapShot.lateral);
        ctx.strokeStyle = "#7dff9b";
        ctx.strokeRect(predictedLanding.x - 4, predictedLanding.y - 4, 8, 8);

        const offline = Math.abs(mapShot.lateral);
        const side = mapShot.lateral < 0 ? "L" : mapShot.lateral > 0 ? "R" : "C";
        ctx.fillStyle = "#7dff9b";
        ctx.font = "700 8px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${Math.round(mapShot.distance * progress)}Y // ${side}${offline}`, mapX + 7, mapY + mapH - 4);
      } else if (last) {
        const landingMap = mapPoint(last.distance, last.lateral);
        ctx.strokeStyle = "#7dff9b";
        ctx.beginPath();
        ctx.moveTo(landingMap.x - 5, landingMap.y - 5);
        ctx.lineTo(landingMap.x + 5, landingMap.y + 5);
        ctx.moveTo(landingMap.x + 5, landingMap.y - 5);
        ctx.lineTo(landingMap.x - 5, landingMap.y + 5);
        ctx.stroke();
      }

      ctx.fillStyle = "#7dff9b";
      ctx.font = "700 8px monospace";
      ctx.textAlign = "left";
      ctx.fillText("TOP VIEW // LIVE", mapX + 7, mapY + 12);

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

      <footer className="intermission-game-message"><span>{message}</span><strong>{landing ? `${landing.distance}Y // ${landing.lateral === 0 ? "ON LINE" : `${landing.lateral < 0 ? "L" : "R"}${Math.abs(landing.lateral)}Y`}` : "PAR IS A SUGGESTION"}</strong></footer>
    </div>
  );
}
