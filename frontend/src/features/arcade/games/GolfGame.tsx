import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function newHole() {
  return {
    target: 95 + Math.floor(Math.random() * 71),
    wind: Math.floor(Math.random() * 13) - 6,
  };
}

export function GolfGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({ aimPeriodMs: 2050, powerPeriodMs: 1550, modifierPeriodMs: 1250 });
  const scoreRef = useRef(score);
  const resetTimerRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [hole, setHole] = useState(() => newHole());
  const [landing, setLanding] = useState<{ distance: number; lateral: number } | null>(null);
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SHOT SHAPE_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true });
    return () => { if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current); };
  }, []);

  function resolveShot(sample: TimingShotSample) {
    const distance = Math.round(185 * sample.power);
    const lateral = Math.round(sample.aim * 24 + sample.modifier * 18 + hole.wind * 1.4);
    const radialError = Math.hypot(distance - hole.target, lateral);
    const award = clamp(Math.round(30 - radialError / 2.5), 1, 30);
    const next = clamp(scoreRef.current + award, 0, 999);
    scoreRef.current = next;
    onScoreChange(next);
    setLanding({ distance, lateral });
    setMessage(radialError < 6 ? `PIN SEEKER // ${radialError.toFixed(1)} YD ERROR // +${award}_` : `SHOT LANDED // ${radialError.toFixed(1)} YD ERROR // +${award}_`);

    resetTimerRef.current = window.setTimeout(() => {
      setLanding(null);
      setHole(newHole());
      setMessage(storyReady ? "STORY READY // LAST BALLS COUNT_" : "NEW HOLE // LOCK AIM_");
      engine.reset();
    }, 1100);
  }

  function action() {
    const sample = engine.lock();
    if (sample) resolveShot(sample);
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
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

      <div className="retro-sport-stage" ref={stageRef} tabIndex={0} onKeyDown={keyDown}>
        <pre className="retro-sport-ascii">{`                    |\\\n                    | \\\n                    |  >\n                   _|_\n             ......(_)......\n        .....             .....\n   .....                       .....\nT================================================ H\n${landing ? `LAST: ${landing.distance} YDS // ${Math.abs(landing.lateral)} YDS ${landing.lateral < 0 ? "LEFT" : landing.lateral > 0 ? "RIGHT" : "CENTER"}` : "BALL: ON TEE // THE CROWD IS QUESTIONABLE"}`}</pre>
      </div>

      <TimingShotMeters phase={engine.phase} aim={engine.aim} power={engine.power} modifier={engine.modifier} modifierLabel="SHAPE" />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>PAR IS A SUGGESTION</strong></footer>
    </div>
  );
}
