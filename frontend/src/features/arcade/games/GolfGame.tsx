import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 640;
const HEIGHT = 360;
const HORIZON_Y = 112;
const TEE_Y = 321;

type HoleMood = "CALM" | "BREEZY" | "TRICKY";

interface GolfHole {
  hole: number;
  target: number;
  wind: number;
  pinOffset: number;
  dogleg: number;
  bunkerSide: -1 | 1;
  mood: HoleMood;
  greenWidth: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function newHole(): GolfHole {
  const roll = Math.random();
  const mood: HoleMood = roll < 0.46 ? "CALM" : roll < 0.8 ? "BREEZY" : "TRICKY";
  const windLimit = mood === "CALM" ? 3 : mood === "BREEZY" ? 5 : 7;
  return {
    hole: 1 + Math.floor(Math.random() * 18),
    target: 108 + Math.floor(Math.random() * 70),
    wind: Math.floor(randomBetween(-windLimit, windLimit + 1)),
    pinOffset: Math.round(randomBetween(-10, 10)),
    dogleg: randomBetween(-0.7, 0.7),
    bunkerSide: Math.random() < 0.5 ? -1 : 1,
    mood,
    greenWidth: 15 + Math.floor(Math.random() * 8),
  };
}

function recommendedPower(hole: GolfHole) {
  return clamp((hole.target - 35) / 155, 0.25, 0.94);
}

function recommendedAim(hole: GolfHole) {
  return clamp((hole.pinOffset - hole.wind * 1.1) / 26, -0.82, 0.82);
}

function recommendedClub(yards: number) {
  if (yards <= 118) return "PITCH WEDGE";
  if (yards <= 136) return "9 IRON";
  if (yards <= 154) return "7 IRON";
  if (yards <= 170) return "6 IRON";
  return "5 IRON";
}

function shotLabel(error: number) {
  if (error < 3.5) return { title: "FLAG HUNTING!", detail: "THAT ONE HAD A CHANCE", tone: "great" as const };
  if (error < 8) return { title: "ON THE GREEN", detail: "PUTTER TERRITORY", tone: "good" as const };
  if (error < 16) return { title: "GOOD MISS", detail: "CHIP AND A PRAYER", tone: "neutral" as const };
  return { title: "IN THE ROUGH", detail: "YOU FOUND MORE COURSE", tone: "bad" as const };
}

export function GolfGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({
    aimPeriodMs: 3100,
    powerPeriodMs: 2450,
    modifierPeriodMs: 2850,
  });
  const { feedback, showFeedback } = useArcadeFeedback(1450);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const shotRef = useRef<GolfShot | null>(null);
  const aimRef = useRef(engine.aim);
  const frameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [hole, setHole] = useState<GolfHole>(() => newHole());
  const holeRef = useRef(hole);
  const [landing, setLanding] = useState<{ distance: number; lateral: number; error: number } | null>(null);
  const landingRef = useRef(landing);
  const [message, setMessage] = useState("LOCK AIM // HIT THE POWER WINDOW // KEEP SHAPE NEAR CENTER_");

  const powerTarget = useMemo(() => recommendedPower(hole), [hole]);
  const aimTarget = useMemo(() => recommendedAim(hole), [hole]);
  const club = useMemo(() => recommendedClub(hole.target), [hole]);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { aimRef.current = engine.aim; }, [engine.aim]);
  useEffect(() => { holeRef.current = hole; }, [hole]);
  useEffect(() => { landingRef.current = landing; }, [landing]);

  function finishShot(shot: GolfShot) {
    if (shot.scored) return;
    shot.scored = true;

    const next = clamp(scoreRef.current + shot.award, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
    setLanding({ distance: shot.distance, lateral: shot.lateral, error: shot.radialError });

    const label = shotLabel(shot.radialError);
    showFeedback({
      ...label,
      delta: shot.award,
    }, 1550);

    if (shot.radialError < 3.5) {
      setMessage(`PIN SEEKER // ${shot.radialError.toFixed(1)} YDS FROM THE STICK // +${shot.award}_`);
    } else {
      setMessage(`LANDED ${shot.radialError.toFixed(1)} YDS FROM PIN // +${shot.award}_`);
    }

    resetTimerRef.current = window.setTimeout(() => {
      shotRef.current = null;
      setLanding(null);
      const nextHole = newHole();
      setHole(nextHole);
      setMessage(storyReadyRef.current ? "STORY READY // ONE LAST HOLE_" : "NEW PAR 3 // LOCK AIM_");
      engine.reset();
    }, 2850);
  }

  function startShot(sample: TimingShotSample) {
    const currentHole = holeRef.current;
    // Forgiving arcade golf: the meters matter, but good-enough timing still creates a playable shot.
    const distance = Math.round(35 + 155 * sample.power);
    const lateral = Math.round(sample.aim * 26 + sample.modifier * 10 + currentHole.wind * 1.1);
    const radialError = Math.hypot(distance - currentHole.target, lateral - currentHole.pinOffset);
    const award = radialError < 3.5 ? 30
      : radialError < 8 ? 24
        : radialError < 16 ? 16
          : clamp(Math.round(12 - radialError / 5), 2, 11);

    shotRef.current = {
      sample,
      distance,
      lateral,
      radialError,
      award,
      startedAt: performance.now(),
      scored: false,
    };
    setMessage("SHOT AWAY // TRACKING BALL_");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const drawPixelGolfer = (swing: number) => {
      const x = 88;
      const y = 286;
      ctx.fillStyle = "#235f31";
      ctx.fillRect(x - 5, y - 42, 11, 11); // head
      ctx.fillStyle = "#3aa653";
      ctx.fillRect(x - 10, y - 30, 20, 28); // torso
      ctx.fillStyle = "#164d23";
      ctx.fillRect(x - 11, y - 2, 8, 24);
      ctx.fillRect(x + 3, y - 2, 8, 24);
      ctx.strokeStyle = "#7dff9b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 21);
      ctx.lineTo(x + 22 + swing * 15, y - 5 - swing * 22);
      ctx.lineTo(x + 28 + swing * 18, y + 15 - swing * 32);
      ctx.stroke();
      ctx.lineWidth = 1;
    };

    const draw = (now: number) => {
      const currentHole = holeRef.current;
      const maxDistance = Math.max(205, currentHole.target + 30);
      const shot = shotRef.current;
      const rawProgress = shot ? clamp((now - shot.startedAt) / 1650, 0, 1) : 0;
      const progress = shot ? 1 - Math.pow(1 - rawProgress, 1.35) : 0;
      const swingProgress = shot ? clamp((now - shot.startedAt) / 260, 0, 1) : 0;

      const centerAt = (distance: number) => {
        const depth = clamp(distance / maxDistance, 0, 1);
        return WIDTH / 2 + Math.sin(depth * Math.PI * 0.65) * currentHole.dogleg * 74;
      };
      const groundPoint = (distance: number, lateral: number) => {
        const depth = clamp(distance / maxDistance, 0, 1);
        const y = TEE_Y - Math.pow(depth, 0.72) * (TEE_Y - HORIZON_Y);
        const pixelsPerYard = lerp(6.0, 1.15, depth);
        return {
          x: centerAt(distance) + lateral * pixelsPerYard,
          y,
          depth,
        };
      };

      // VGA sky.
      ctx.fillStyle = "#07170c";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#0b2413";
      ctx.fillRect(0, 36, WIDTH, HORIZON_Y - 36);
      ctx.strokeStyle = "#164d23";
      for (let y = 50; y < HORIZON_Y; y += 17) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
      }

      // Blocky clouds.
      ctx.fillStyle = "#1a4e27";
      ctx.fillRect(65, 56, 72, 9);
      ctx.fillRect(83, 48, 35, 9);
      ctx.fillRect(438, 68, 89, 8);
      ctx.fillRect(472, 59, 39, 9);

      // Distant tree line.
      ctx.fillStyle = "#123b1b";
      for (let x = 0; x < WIDTH; x += 13) {
        const h = 10 + ((x * 17 + currentHole.hole * 11) % 22);
        ctx.fillRect(x, HORIZON_Y - h, 11, h);
      }

      // Rough.
      ctx.fillStyle = "#061306";
      ctx.fillRect(0, HORIZON_Y, WIDTH, HEIGHT - HORIZON_Y);

      // Fairway as perspective strips, so dogleg/shape actually changes each hole.
      const slices = 18;
      for (let i = slices; i >= 0; i -= 1) {
        const d = (i / slices) * maxDistance;
        const nextD = Math.min(maxDistance, ((i + 1) / slices) * maxDistance);
        const a = groundPoint(d, 0);
        const b = groundPoint(nextD, 0);
        const halfA = lerp(225, 43, a.depth);
        const halfB = lerp(225, 43, b.depth);
        ctx.fillStyle = i % 2 === 0 ? "#0a2411" : "#0b2b14";
        ctx.beginPath();
        ctx.moveTo(a.x - halfA, a.y);
        ctx.lineTo(a.x + halfA, a.y);
        ctx.lineTo(b.x + halfB, b.y);
        ctx.lineTo(b.x - halfB, b.y);
        ctx.closePath();
        ctx.fill();
      }

      // Green and bunker are genuinely placed in the hole geometry.
      const pin = groundPoint(currentHole.target, currentHole.pinOffset);
      const greenRadiusX = lerp(72, 31, pin.depth) + currentHole.greenWidth;
      const greenRadiusY = lerp(20, 7, pin.depth);
      ctx.fillStyle = "#123d1b";
      ctx.beginPath();
      ctx.ellipse(pin.x, pin.y + 2, greenRadiusX, greenRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2b7f3e";
      ctx.stroke();

      const bunker = groundPoint(
        currentHole.target - 7,
        currentHole.pinOffset + currentHole.bunkerSide * (currentHole.greenWidth + 8),
      );
      ctx.fillStyle = "#355d2d";
      ctx.beginPath();
      ctx.ellipse(bunker.x, bunker.y + 5, Math.max(9, greenRadiusX * 0.35), Math.max(3, greenRadiusY * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();

      // Flag.
      ctx.strokeStyle = "#7dff9b";
      ctx.lineWidth = 2;
      const flagHeight = lerp(48, 25, pin.depth);
      ctx.beginPath();
      ctx.moveTo(pin.x, pin.y + 3);
      ctx.lineTo(pin.x, pin.y - flagHeight);
      ctx.lineTo(pin.x + lerp(27, 14, pin.depth), pin.y - flagHeight + 7);
      ctx.lineTo(pin.x, pin.y - flagHeight + 14);
      ctx.stroke();
      ctx.lineWidth = 1;

      // Tee and golfer. The golfer gets a deliberately tiny 3-frame-ish swing.
      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(WIDTH / 2 - 2, TEE_Y - 4, 4, 4);
      drawPixelGolfer(swingProgress < 0.5 ? swingProgress * 2 : Math.max(0, 2 - swingProgress * 2));

      // Draw predicted aim line before the shot.
      if (!shot) {
        const aimYards = aimRef.current * 26 + currentHole.wind * 1.1;
        const predicted = groundPoint(currentHole.target, aimYards);
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = "#235f31";
        ctx.beginPath();
        ctx.moveTo(WIDTH / 2, TEE_Y - 5);
        ctx.lineTo(predicted.x, predicted.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ball flight in the same perspective space as the course.
      if (shot) {
        const aimComponent = shot.sample.aim * 26;
        const curveComponent = shot.sample.modifier * 10 + currentHole.wind * 1.1;
        const lateralAt = (q: number) => aimComponent * q + curveComponent * q * q;
        const distanceAt = shot.distance * progress;
        const base = groundPoint(distanceAt, lateralAt(progress));
        const arc = Math.sin(progress * Math.PI) * lerp(105, 42, base.depth);
        let bounce = 0;
        if (rawProgress > 0.82) {
          const bp = (rawProgress - 0.82) / 0.18;
          bounce = Math.sin(bp * Math.PI * 2) * (1 - bp) * 9;
        }
        const ballY = base.y - arc - Math.max(0, bounce);
        const radius = lerp(6, 2, base.depth);

        // Traveled trajectory.
        ctx.strokeStyle = "#3aa653";
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        const steps = Math.max(2, Math.ceil(progress * 28));
        for (let i = 0; i <= steps; i += 1) {
          const q = progress * (i / steps);
          const p = groundPoint(shot.distance * q, lateralAt(q));
          const py = p.y - Math.sin(q * Math.PI) * lerp(105, 42, p.depth);
          if (i === 0) ctx.moveTo(p.x, py);
          else ctx.lineTo(p.x, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#7dff9b";
        ctx.beginPath();
        ctx.arc(base.x, ballY, radius, 0, Math.PI * 2);
        ctx.fill();

        if (rawProgress >= 1 && !shot.scored) finishShot(shot);
      }

      // Last landing marker stays visible until the next hole.
      const last = landingRef.current;
      if (last) {
        const p = groundPoint(last.distance, last.lateral);
        ctx.strokeStyle = "#7dff9b";
        ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
      }

      // Top HUD inspired by early 16-bit golf, without copying a specific game.
      ctx.fillStyle = "#010501";
      ctx.fillRect(0, 0, WIDTH, 34);
      ctx.strokeStyle = "#2b7f3e";
      ctx.strokeRect(2, 2, WIDTH - 4, 30);
      ctx.fillStyle = "#7dff9b";
      ctx.font = "700 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`HOLE ${String(currentHole.hole).padStart(2, "0")}`, 12, 20);
      ctx.fillText(`${currentHole.target} YDS`, 106, 20);
      ctx.fillText("PAR 3", 206, 20);
      ctx.fillText(`${club}`, 287, 20);
      ctx.textAlign = "right";
      ctx.fillText(`WIND ${currentHole.wind >= 0 ? ">" : "<"}${Math.abs(currentHole.wind)} // ${currentHole.mood}`, WIDTH - 12, 20);

      // Small real overhead map; now secondary information instead of the entire game.
      const mapX = WIDTH - 122;
      const mapY = 44;
      const mapW = 106;
      const mapH = 80;
      const mapCenter = mapX + mapW / 2;
      const mapBottom = mapY + mapH - 7;
      const mapTop = mapY + 15;
      const mapPoint = (distance: number, lateral: number) => ({
        x: mapCenter + clamp(lateral, -35, 35) * 1.18,
        y: mapBottom - clamp(distance / maxDistance, 0, 1) * (mapBottom - mapTop),
      });
      ctx.fillStyle = "rgba(0,5,1,0.84)";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.strokeStyle = "#235f31";
      ctx.strokeRect(mapX, mapY, mapW, mapH);
      ctx.fillStyle = "#3aa653";
      ctx.font = "700 7px monospace";
      ctx.textAlign = "left";
      ctx.fillText("HOLE MAP", mapX + 5, mapY + 9);
      const mapPin = mapPoint(currentHole.target, currentHole.pinOffset);
      ctx.strokeStyle = "#7dff9b";
      ctx.beginPath();
      ctx.moveTo(mapPin.x, mapPin.y + 4);
      ctx.lineTo(mapPin.x, mapPin.y - 6);
      ctx.stroke();
      if (shot) {
        const aimComponent = shot.sample.aim * 26;
        const curveComponent = shot.sample.modifier * 10 + currentHole.wind * 1.1;
        ctx.strokeStyle = "#7dff9b";
        ctx.beginPath();
        for (let i = 0; i <= 18; i += 1) {
          const q = progress * (i / 18);
          const p = mapPoint(shot.distance * q, aimComponent * q + curveComponent * q * q);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      } else if (last) {
        const lp = mapPoint(last.distance, last.lateral);
        ctx.strokeRect(lp.x - 3, lp.y - 3, 6, 6);
      }

      // Bottom in-canvas helper makes success criteria obvious.
      ctx.fillStyle = "rgba(0,5,1,0.88)";
      ctx.fillRect(0, HEIGHT - 25, WIDTH, 25);
      ctx.fillStyle = "#3aa653";
      ctx.font = "700 9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`TARGET POWER ${Math.round(recommendedPower(currentHole) * 100)}%`, 10, HEIGHT - 9);
      ctx.textAlign = "right";
      ctx.fillText(`PIN ${currentHole.pinOffset < 0 ? "L" : currentHole.pinOffset > 0 ? "R" : "C"}${Math.abs(currentHole.pinOffset)}Y`, WIDTH - 10, HEIGHT - 9);

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    canvas.focus({ preventScroll: true });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, [club, engine.reset]);

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
      : engine.phase === "modifier" ? "LOCK SHAPE"
        : "BALL IN FLIGHT";
  const windArrow = hole.wind === 0 ? "CALM"
    : hole.wind < 0 ? `${"<".repeat(Math.min(3, Math.ceil(Math.abs(hole.wind) / 2)))} ${Math.abs(hole.wind)} MPH`
      : `${">".repeat(Math.min(3, Math.ceil(Math.abs(hole.wind) / 2)))} ${hole.wind} MPH`;

  return (
    <div className="intermission-game timing-sport-game golf-game">
      <header className="intermission-game-instructions">
        <strong>PIXEL LINKS // PAR-3 PIN HUNT</strong>
        <span>SPACE / ENTER / TAP // AIM → POWER → SHAPE // GREEN BANDS ARE FRIENDLY WINDOWS</span>
        <span>HOLE {hole.hole} // {hole.target} YDS // {club} // WIND {windArrow}</span>
      </header>

      <div className="arcade-playfield">
        <canvas
          ref={canvasRef}
          className="arcade-canvas retro-sport-canvas"
          width={WIDTH}
          height={HEIGHT}
          tabIndex={0}
          onKeyDown={keyDown}
          aria-label="Animated 16-bit-style golf hole"
        />
        <ArcadeFeedback feedback={feedback} />
      </div>

      <TimingShotMeters
        phase={engine.phase}
        aim={engine.aim}
        power={engine.power}
        modifier={engine.modifier}
        modifierLabel="SHAPE"
        aimTarget={aimTarget}
        aimTolerance={0.34}
        powerTarget={powerTarget}
        powerTolerance={0.22}
        modifierTarget={0}
        modifierTolerance={0.46}
      />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>{landing ? `${landing.distance}Y // ${landing.error.toFixed(1)}Y FROM PIN` : `${hole.mood} // PAR 3`}</strong>
      </footer>
    </div>
  );
}
