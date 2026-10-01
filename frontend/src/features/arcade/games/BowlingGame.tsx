import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TimingShotMeters } from "../engine/TimingShotMeters";
import { useTimingShotEngine, type TimingShotSample } from "../engine/useTimingShotEngine";
import type { ArcadeGameProps } from "../arcadeTypes";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function renderPins(pinsDown: number) {
  const standing = Math.max(0, 10 - pinsDown);
  const marks = Array.from({ length: 10 }, (_, index) => index < standing ? "▲" : "·");
  return [
    `        ${marks[6]} ${marks[7]} ${marks[8]} ${marks[9]}`,
    `         ${marks[3]} ${marks[4]} ${marks[5]}`,
    `          ${marks[1]} ${marks[2]}`,
    `           ${marks[0]}`,
  ].join("\n");
}

export function BowlingGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const engine = useTimingShotEngine({ aimPeriodMs: 1900, powerPeriodMs: 1350, modifierPeriodMs: 1550 });
  const scoreRef = useRef(score);
  const resetTimerRef = useRef<number | null>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [pinsDown, setPinsDown] = useState(0);
  const [message, setMessage] = useState("LOCK AIM // THEN POWER // THEN SPIN_");

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => {
    laneRef.current?.focus({ preventScroll: true });
    return () => { if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current); };
  }, []);

  function resolveShot(sample: TimingShotSample) {
    const line = sample.aim * 0.78 + sample.modifier * 0.34;
    const centerQuality = clamp(1 - Math.abs(line), 0, 1);
    const powerQuality = clamp(1 - Math.abs(sample.power - 0.82) / 0.82, 0, 1);
    const impact = clamp(centerQuality * 0.72 + powerQuality * 0.28, 0, 1);
    let knocked = Math.round(impact * 10 + (Math.random() * 1.4 - 0.4));
    if (centerQuality > 0.93 && sample.power > 0.72) knocked = 10;
    knocked = clamp(knocked, 0, 10);
    setPinsDown(knocked);

    const award = knocked === 10 ? 25 : knocked * 2;
    const next = clamp(scoreRef.current + award, 0, 999);
    scoreRef.current = next;
    onScoreChange(next);
    setMessage(knocked === 10 ? "STRIKE // +25_" : `${knocked} PINS // +${award}_`);

    resetTimerRef.current = window.setTimeout(() => {
      setPinsDown(0);
      setMessage(storyReady ? "STORY READY // ONE MORE FRAME IF YOU HAVE IT_" : "NEXT FRAME // LOCK AIM_");
      engine.reset();
    }, 900);
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

  const buttonLabel = engine.phase === "aim" ? "LOCK AIM" : engine.phase === "power" ? "LOCK POWER" : engine.phase === "modifier" ? "LOCK SPIN" : "BALL IN MOTION";

  return (
    <div className="intermission-game timing-sport-game bowling-game">
      <header className="intermission-game-instructions">
        <strong>BOWL-O-MATIC // THREE-TAP DELIVERY</strong>
        <span>SPACE / ENTER / TAP // AIM → POWER → SPIN</span>
        <span>STRIKE +25 // OTHERWISE +2 PER PIN</span>
      </header>

      <div className="retro-sport-stage" ref={laneRef} tabIndex={0} onKeyDown={keyDown}>
        <pre className="retro-sport-ascii">{`+------------------------+\n|      KINGPIN LANES     |\n|                        |\n${renderPins(pinsDown).split("\n").map((line) => `|${line.padEnd(24)}|`).join("\n")}\n|                        |\n|           O            |\n|          /|\\           |\n|          / \\           |\n+------------------------+`}</pre>
      </div>

      <TimingShotMeters phase={engine.phase} aim={engine.aim} power={engine.power} modifier={engine.modifier} modifierLabel="SPIN" />

      <button className="button button-primary timing-shot-action" type="button" disabled={engine.phase === "resolving"} onClick={action}>
        {buttonLabel}
      </button>

      <footer className="intermission-game-message"><span>{message}</span><strong>VGA LEAGUE</strong></footer>
    </div>
  );
}
