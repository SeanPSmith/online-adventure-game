import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

const WIDTH = 640;
const HEIGHT = 360;
const HORIZON_Y = 108;
const PIN_DECK_Y = 136;
const FOUL_Y = 318;

type LaneOil = "DRY" | "HOUSE" | "OILY";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface PinDefinition {
  laneX: number;
  row: number;
}

interface BowlingShot {
  sample: TimingShotSample;
  knocked: number;
  award: number;
  impactLine: number;
  knockedPins: number[];
  startedAt: number;
  scored: boolean;
}

const PIN_LAYOUT: PinDefinition[] = [
  { laneX: 0, row: 0 },
  { laneX: -0.26, row: 1 }, { laneX: 0.26, row: 1 },
  { laneX: -0.5, row: 2 }, { laneX: 0, row: 2 }, { laneX: 0.5, row: 2 },
  { laneX: -0.72, row: 3 }, { laneX: -0.24, row: 3 }, { laneX: 0.24, row: 3 }, { laneX: 0.72, row: 3 },
];

function randomOil(): LaneOil {
  const roll = Math.random();
  return roll < 0.3 ? "DRY" : roll < 0.78 ? "HOUSE" : "OILY";
}

function spinFactor(oil: LaneOil) {
  return oil === "DRY" ? 0.42 : oil === "OILY" ? 0.22 : 0.32;
}

function chooseKnockedPins(knocked: number, impactLine: number) {
  if (knocked <= 0) return [];
  return PIN_LAYOUT
    .map((pin, index) => ({
      index,
      score: Math.abs(pin.laneX - impactLine * 0.76) + pin.row * 0.055 + ((index * 17) % 7) * 0.006,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, knocked)
    .map((entry) => entry.index);
}

function lanePoint(depth: number, lateral: number) {
  const t = clamp(depth, 0, 1);
  const y = lerp(FOUL_Y, PIN_DECK_Y, t);
  const halfWidth = lerp(214, 55, Math.pow(t, 0.82));
  return {
    x: WIDTH / 2 + clamp(lateral, -1.25, 1.25) * halfWidth,
    y,
    halfWidth,
  };
}

function pinPoint(pin: PinDefinition) {
  const rowDepth = pin.row / 3;
  const y = PIN_DECK_Y - pin.row * 7.5;
  const halfWidth = lerp(48, 37, rowDepth);
  return {
    x: WIDTH / 2 + pin.laneX * halfWidth,
    y,
    scale: lerp(1, 0.82, rowDepth),
  };
}

export function BowlingGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({
    aimPeriodMs: 3250,
    powerPeriodMs: 2700,
    modifierPeriodMs: 3050,
  });
  const { feedback, showFeedback } = useArcadeFeedback(1400);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scoreRef = useRef(score);
  const onScoreChangeRef = useRef(onScoreChange);
  const storyReadyRef = useRef(storyReady);
  const shotRef = useRef<BowlingShot | null>(null);
  const aimRef = useRef(engine.aim);
  const resetTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const [pinsDown, setPinsDown] = useState(0);
  const [oil, setOil] = useState<LaneOil>(() => randomOil());
  const oilRef = useRef(oil);
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SPIN_");

  const spinHelp = useMemo(
    () => oil === "DRY" ? "HOOKS EARLY" : oil === "OILY" ? "SLIDES LONG" : "NORMAL HOUSE SHOT",
    [oil],
  );

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onScoreChangeRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { storyReadyRef.current = storyReady; }, [storyReady]);
  useEffect(() => { aimRef.current = engine.aim; }, [engine.aim]);
  useEffect(() => { oilRef.current = oil; }, [oil]);

  function finishShot(shot: BowlingShot) {
    if (shot.scored) return;
    shot.scored = true;

    const next = clamp(scoreRef.current + shot.award, 0, 999);
    scoreRef.current = next;
    onScoreChangeRef.current(next);
    setPinsDown(shot.knocked);

    if (shot.knocked === 10) {
      setMessage("STRIKE // PERFECT POCKET // +25_");
      showFeedback({ title: "STRIKE!", detail: "ALL TEN // CLEAN POCKET", delta: 25, tone: "great" }, 1650);
    } else if (shot.knocked >= 8) {
      setMessage(`${shot.knocked} PINS // SOLID HIT // +${shot.award}_`);
      showFeedback({ title: `${shot.knocked} PINS`, detail: "SOLID POCKET HIT", delta: shot.award, tone: "good" }, 1450);
    } else if (shot.knocked >= 4) {
      setMessage(`${shot.knocked} PINS // WORKABLE // +${shot.award}_`);
      showFeedback({ title: `${shot.knocked} PINS`, detail: "CONTACT // KEEP THE LINE", delta: shot.award, tone: "neutral" }, 1400);
    } else {
      setMessage(`${shot.knocked} PINS // FIND THE POCKET // +${shot.award}_`);
      showFeedback({
        title: shot.knocked === 0 ? "GUTTER BALL" : `${shot.knocked} PINS`,
        detail: shot.knocked === 0 ? "THE PINS NEVER FELT A THING" : "THE LANE REMAINS UNIMPRESSED",
        delta: shot.award,
        tone: "bad",
      }, 1450);
    }

    resetTimerRef.current = window.setTimeout(() => {
      shotRef.current = null;
      setPinsDown(0);
      setOil(randomOil());
      setMessage(storyReadyRef.current ? "STORY READY // ONE MORE FRAME IF YOU HAVE IT_" : "NEXT FRAME // LOCK AIM_");
      engine.reset();
    }, 2150);
  }

  function startShot(sample: TimingShotSample) {
    const oilFactor = spinFactor(oilRef.current);
    const impactLine = clamp(sample.aim * 0.62 + sample.modifier * oilFactor, -1.05, 1.05);
    const centerQuality = clamp(1 - Math.abs(impactLine), 0, 1);
    const powerQuality = clamp(1 - Math.abs(sample.power - 0.78) / 0.72, 0, 1);
    const impact = clamp(centerQuality * 0.72 + powerQuality * 0.28, 0, 1);

    let knocked = Math.round(impact * 10 + (Math.random() * 1.15 - 0.18));
    if (centerQuality > 0.84 && sample.power > 0.58) knocked = 10;
    knocked = clamp(knocked, 0, 10);
    const award = knocked === 10 ? 25 : knocked * 2;

    shotRef.current = {
      sample,
      knocked,
      award,
      impactLine,
      knockedPins: chooseKnockedPins(knocked, impactLine),
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

    const drawPixelBowler = (swing: number, released: boolean) => {
      const x = 126;
      const y = 308;
      const lean = swing * 5;

      ctx.fillStyle = "#164d23";
      ctx.fillRect(x - 13, y - 61 + lean, 17, 15); // head
      ctx.fillStyle = "#3aa653";
      ctx.fillRect(x - 18, y - 44 + lean, 30, 37); // shirt
      ctx.fillStyle = "#123b1b";
      ctx.fillRect(x - 17, y - 7, 10, 28); // leg
      ctx.fillRect(x + 2, y - 7, 10, 28);
      ctx.fillStyle = "#235f31";
      ctx.fillRect(x - 21, y + 18, 17, 5);
      ctx.fillRect(x + 2, y + 18, 17, 5);

      const armX = x + 8 + swing * 20;
      const armY = y - 35 + swing * 25;
      ctx.strokeStyle = "#7dff9b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 36 + lean);
      ctx.lineTo(armX, armY);
      ctx.stroke();
      ctx.lineWidth = 1;

      if (!released) {
        ctx.fillStyle = "#7dff9b";
        ctx.beginPath();
        ctx.arc(armX + 5, armY + 5, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#020702";
        ctx.fillRect(armX + 2, armY + 1, 2, 2);
      }
    };

    const drawPin = (index: number, impactProgress: number, knockedPins: Set<number>, impactLine: number) => {
      const pin = PIN_LAYOUT[index];
      const base = pinPoint(pin);
      const knocked = knockedPins.has(index);

      let x = base.x;
      let y = base.y;
      let fall = 0;
      if (knocked && impactProgress > 0) {
        const side = Math.sign(pin.laneX - impactLine * 0.5) || (index % 2 === 0 ? 1 : -1);
        const energy = 1 + ((index * 13) % 5) * 0.14;
        x += side * impactProgress * 23 * energy;
        y += impactProgress * (7 + pin.row * 2);
        fall = impactProgress;
      }

      const pinHeight = 18 * base.scale;
      const pinWidth = 7 * base.scale;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(knocked ? fall * (index % 2 === 0 ? 1.15 : -1.15) : 0);
      ctx.strokeStyle = knocked ? "#3aa653" : "#d9ffe2";
      ctx.fillStyle = knocked ? "#164d23" : "#a8ffba";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -pinHeight * 0.52);
      ctx.lineTo(-pinWidth * 0.45, -pinHeight * 0.15);
      ctx.lineTo(-pinWidth, pinHeight * 0.48);
      ctx.lineTo(pinWidth, pinHeight * 0.48);
      ctx.lineTo(pinWidth * 0.45, -pinHeight * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#235f31";
      ctx.beginPath();
      ctx.moveTo(-pinWidth * 0.45, -pinHeight * 0.05);
      ctx.lineTo(pinWidth * 0.45, -pinHeight * 0.05);
      ctx.stroke();
      ctx.restore();
    };

    const draw = (now: number) => {
      const shot = shotRef.current;
      const rawProgress = shot ? clamp((now - shot.startedAt) / 1700, 0, 1) : 0;
      const rollProgress = clamp(rawProgress / 0.72, 0, 1);
      const impactProgress = clamp((rawProgress - 0.72) / 0.28, 0, 1);
      const swingProgress = shot ? clamp((now - shot.startedAt) / 360, 0, 1) : 0;
      const impactFlash = shot ? clamp(1 - Math.abs(rawProgress - 0.74) / 0.06, 0, 1) : 0;
      const shake = impactFlash > 0 ? Math.sin(now * 0.14) * 3.5 * impactFlash : 0;

      ctx.save();
      ctx.translate(shake, 0);

      // Back wall / scoreboard.
      ctx.fillStyle = "#020702";
      ctx.fillRect(-8, 0, WIDTH + 16, HEIGHT);
      ctx.fillStyle = "#07170c";
      ctx.fillRect(0, 0, WIDTH, HORIZON_Y);
      ctx.fillStyle = "#0b2413";
      ctx.fillRect(24, 18, WIDTH - 48, 58);
      ctx.strokeStyle = "#235f31";
      ctx.strokeRect(24, 18, WIDTH - 48, 58);
      ctx.fillStyle = "#7dff9b";
      ctx.font = "700 18px monospace";
      ctx.textAlign = "left";
      ctx.fillText("BOWL-O-MATIC // KINGPIN LANES", 42, 43);
      ctx.font = "700 11px monospace";
      ctx.fillStyle = "#3aa653";
      ctx.fillText(`OIL ${oilRef.current} // ${oilRef.current === "DRY" ? "EARLY HOOK" : oilRef.current === "OILY" ? "LATE BREAK" : "HOUSE SHOT"}`, 42, 62);
      ctx.textAlign = "right";
      ctx.fillText(`PINS ${shot ? shot.knocked : pinsDown}/10`, WIDTH - 42, 62);

      // Back masking / pinsetter.
      ctx.fillStyle = "#041004";
      ctx.fillRect(220, 84, 200, 47);
      ctx.strokeStyle = "#164d23";
      ctx.strokeRect(220, 84, 200, 47);
      ctx.fillStyle = "#235f31";
      ctx.fillRect(235, 95, 170, 6);

      // Approach floor.
      ctx.fillStyle = "#061306";
      ctx.fillRect(0, HORIZON_Y, WIDTH, HEIGHT - HORIZON_Y);

      // Gutters and perspective lane.
      const farLeft = WIDTH / 2 - 63;
      const farRight = WIDTH / 2 + 63;
      const nearLeft = WIDTH / 2 - 228;
      const nearRight = WIDTH / 2 + 228;

      ctx.fillStyle = "#041004";
      ctx.beginPath();
      ctx.moveTo(farLeft - 15, PIN_DECK_Y - 8);
      ctx.lineTo(farLeft, PIN_DECK_Y - 8);
      ctx.lineTo(nearLeft, FOUL_Y + 15);
      ctx.lineTo(nearLeft - 24, FOUL_Y + 15);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(farRight, PIN_DECK_Y - 8);
      ctx.lineTo(farRight + 15, PIN_DECK_Y - 8);
      ctx.lineTo(nearRight + 24, FOUL_Y + 15);
      ctx.lineTo(nearRight, FOUL_Y + 15);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0b2b14";
      ctx.beginPath();
      ctx.moveTo(farLeft, PIN_DECK_Y - 8);
      ctx.lineTo(farRight, PIN_DECK_Y - 8);
      ctx.lineTo(nearRight, FOUL_Y + 15);
      ctx.lineTo(nearLeft, FOUL_Y + 15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#3aa653";
      ctx.stroke();

      // Lane boards and distance strips.
      for (let i = -8; i <= 8; i += 1) {
        const nearX = WIDTH / 2 + (i / 8) * 212;
        const farX = WIDTH / 2 + (i / 8) * 57;
        ctx.strokeStyle = i === 0 ? "#235f31" : "#123b1b";
        ctx.beginPath();
        ctx.moveTo(nearX, FOUL_Y + 12);
        ctx.lineTo(farX, PIN_DECK_Y - 5);
        ctx.stroke();
      }
      for (let i = 1; i <= 7; i += 1) {
        const t = i / 8;
        const point = lanePoint(t, 0);
        ctx.strokeStyle = i === 7 ? "#235f31" : "#0f3618";
        ctx.beginPath();
        ctx.moveTo(point.x - point.halfWidth, point.y);
        ctx.lineTo(point.x + point.halfWidth, point.y);
        ctx.stroke();
      }

      // Bowling arrows / target marks.
      for (const arrow of [-0.58, -0.28, 0, 0.28, 0.58]) {
        const p = lanePoint(0.36, arrow);
        ctx.fillStyle = arrow === 0 ? "#3aa653" : "#164d23";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x - 4, p.y + 3);
        ctx.lineTo(p.x + 4, p.y + 3);
        ctx.closePath();
        ctx.fill();
      }

      // Learnable aim guide before release.
      if (!shot) {
        const guideStart = lanePoint(0.02, aimRef.current * 0.72);
        const guideEnd = lanePoint(0.94, aimRef.current * 0.42);
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = "#3aa653";
        ctx.beginPath();
        ctx.moveTo(guideStart.x, guideStart.y);
        ctx.lineTo(guideEnd.x, guideEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pins live in the lane perspective, then scatter after impact.
      const knockedSet = new Set(shot?.knockedPins ?? []);
      for (let index = PIN_LAYOUT.length - 1; index >= 0; index -= 1) {
        drawPin(index, impactProgress, knockedSet, shot?.impactLine ?? 0);
      }

      // Bowler has a tiny VGA delivery animation rather than being a static diagram.
      const released = Boolean(shot && swingProgress > 0.62);
      const swing = shot
        ? swingProgress < 0.55
          ? swingProgress / 0.55
          : Math.max(0, 1 - (swingProgress - 0.55) / 0.45)
        : 0;
      drawPixelBowler(swing, released);

      // Ball uses the same impact line as scoring so what you see matches what happened.
      if (shot && rollProgress > 0.04) {
        const t = clamp((rollProgress - 0.04) / 0.96, 0, 1);
        const eased = 1 - Math.pow(1 - t, 1.55);
        const oilFactor = spinFactor(oilRef.current);
        const startLateral = shot.sample.aim * 0.64;
        const endLateral = shot.impactLine * 0.82;
        const hook = Math.sin(Math.pow(eased, 1.35) * Math.PI) * shot.sample.modifier * oilFactor * 0.36;
        const lateral = lerp(startLateral, endLateral, eased) + hook;
        const ball = lanePoint(eased, lateral);
        const radius = lerp(10.5, 3.1, eased);

        // Motion trail makes speed / hook visible.
        ctx.strokeStyle = "#164d23";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let sampleIndex = 0; sampleIndex <= 16; sampleIndex += 1) {
          const q = eased * (sampleIndex / 16);
          const qHook = Math.sin(Math.pow(q, 1.35) * Math.PI) * shot.sample.modifier * oilFactor * 0.36;
          const qLat = lerp(startLateral, endLateral, q) + qHook;
          const qPoint = lanePoint(q, qLat);
          if (sampleIndex === 0) ctx.moveTo(qPoint.x, qPoint.y);
          else ctx.lineTo(qPoint.x, qPoint.y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;

        ctx.fillStyle = "#7dff9b";
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#020702";
        ctx.beginPath();
        ctx.arc(ball.x - radius * 0.22, ball.y - radius * 0.18, Math.max(1, radius * 0.13), 0, Math.PI * 2);
        ctx.fill();
      }

      if (impactFlash > 0) {
        ctx.strokeStyle = `rgba(125,255,155,${impactFlash})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(WIDTH / 2 + (shot?.impactLine ?? 0) * 42, PIN_DECK_Y - 3, 18 + (1 - impactFlash) * 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Lane status cue during the roll.
      if (shot && rawProgress < 0.72) {
        ctx.fillStyle = "#7dff9b";
        ctx.font = "700 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(Math.abs(shot.sample.modifier) < 0.18 ? "STRAIGHT BALL" : shot.sample.modifier < 0 ? "HOOKING LEFT" : "HOOKING RIGHT", WIDTH / 2, 95);
      }

      ctx.restore();

      if (shot && rawProgress >= 1 && !shot.scored) finishShot(shot);
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
        <strong>BOWL-O-MATIC // VGA KINGPIN LANES</strong>
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
          aria-label="Behind-the-bowler animated VGA bowling lane"
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
        aimTolerance={0.4}
        powerTarget={0.78}
        powerTolerance={0.32}
        modifierTarget={0}
        modifierTolerance={0.55}
      />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>{pinsDown > 0 ? `${pinsDown}/10 DOWN` : `${oil} OIL`}</strong>
      </footer>
    </div>
  );
}
