import { useEffect, useMemo, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

type ShotPhase = "aim" | "power" | "release" | "flight" | "result";

function meterQuality(value: number, target: number, tolerance: number) {
  return Math.max(0, 1 - Math.abs(value - target) / tolerance);
}

export function BasketballGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [phase, setPhase] = useState<ShotPhase>("aim");
  const [meter, setMeter] = useState(0.08);
  const [direction, setDirection] = useState(1);
  const [aim, setAim] = useState(0.5);
  const [power, setPower] = useState(0.5);
  const [release, setRelease] = useState(0.5);
  const [distance, setDistance] = useState<2 | 3>(2);
  const [streak, setStreak] = useState(0);
  const [shotNo, setShotNo] = useState(1);
  const [madeShot, setMadeShot] = useState<boolean | null>(null);
  const [message, setMessage] = useState("AIM THE SHOT // TAP TO LOCK_");
  const resetTimer = useRef<number | null>(null);
  const resultTimer = useRef<number | null>(null);
  const { feedback, showFeedback } = useArcadeFeedback(1750);

  const activeTarget = useMemo(() => {
    if (phase === "power") return distance === 3 ? 0.78 : 0.66;
    return 0.5;
  }, [distance, phase]);

  useEffect(() => {
    if (storyReady || phase === "flight" || phase === "result") return;
    const speed = phase === "power" ? 0.036 : phase === "release" ? 0.052 : 0.031;
    const timer = window.setInterval(() => {
      setMeter((current) => {
        let next = current + direction * speed;
        if (next >= 1) { next = 1; setDirection(-1); }
        if (next <= 0) { next = 0; setDirection(1); }
        return next;
      });
    }, 38);
    return () => window.clearInterval(timer);
  }, [direction, phase, storyReady]);

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
  }, []);

  function nextShot() {
    setPhase("aim");
    setMeter(0.08 + Math.random() * 0.18);
    setDirection(1);
    setMadeShot(null);
    setShotNo((value) => value + 1);
    setDistance(Math.random() < 0.38 ? 3 : 2);
    setMessage("AIM THE SHOT // TAP TO LOCK_");
  }

  function resolveShot(finalRelease: number) {
    const powerTarget = distance === 3 ? 0.78 : 0.66;
    const aimQ = meterQuality(aim, 0.5, 0.42);
    const powerQ = meterQuality(power, powerTarget, 0.38);
    const releaseQ = meterQuality(finalRelease, 0.5, 0.34);
    const quality = aimQ * 0.27 + powerQ * 0.33 + releaseQ * 0.4;
    const made = quality >= (distance === 3 ? 0.66 : 0.57);

    setRelease(finalRelease);
    setMadeShot(made);
    setPhase("flight");
    setMessage("BALL AWAY // TRACKING ARC_");

    resultTimer.current = window.setTimeout(() => {
      setPhase("result");
      if (made) {
        const nextStreak = streak + 1;
        const streakBonus = Math.min(4, Math.floor(nextStreak / 3));
        const award = distance + streakBonus;
        setStreak(nextStreak);
        onScoreChange(Math.min(999, score + award));
        const perfect = quality > 0.9;
        setMessage(`${perfect ? "NOTHING BUT NET" : "BUCKET"} // +${award} // STREAK ${nextStreak}_`);
        showFeedback({
          title: perfect ? "SWISH!" : distance === 3 ? "THREE!" : "BUCKET!",
          detail: `SHOT ${shotNo} // STREAK ${nextStreak}`,
          delta: award,
          tone: perfect ? "great" : "good",
        }, 1900);
      } else {
        setStreak(0);
        const missKind = releaseQ < 0.42 ? "BRICK" : powerQ < 0.45 ? "SHORT" : "RIM OUT";
        setMessage(`${missKind} // RESET YOUR FEET_`);
        showFeedback({ title: missKind, detail: `SHOT ${shotNo} // NO POINTS`, tone: "bad" }, 1900);
      }

      resetTimer.current = window.setTimeout(nextShot, 2150);
    }, 900);
  }

  function lockMeter() {
    if (storyReady || phase === "flight" || phase === "result") return;
    if (phase === "aim") {
      setAim(meter);
      setPhase("power");
      setMeter(0.05);
      setDirection(1);
      setMessage(`AIM LOCKED // SET ${distance === 3 ? "DEEP" : "MID"} POWER_`);
      return;
    }
    if (phase === "power") {
      setPower(meter);
      setPhase("release");
      setMeter(0.08);
      setDirection(1);
      setMessage("POWER LOCKED // HIT THE RELEASE WINDOW_");
      return;
    }
    resolveShot(meter);
  }

  const phaseLabel = phase === "flight" || phase === "result" ? "SHOT" : phase.toUpperCase();

  return (
    <div className="intermission-game basketball-game">
      <header className="intermission-game-instructions">
        <strong>PIXEL HOOPS // SHOT {shotNo} // {distance}-POINTER</strong>
        <span>THREE-TAP SHOT // AIM → POWER → RELEASE // EACH ATTEMPT GETS ROOM TO BREATHE</span>
      </header>

      <div className={`basketball-court is-${phase} ${madeShot === true ? "is-made" : madeShot === false ? "is-miss" : ""}`}>
        <div className="basketball-scoreboard"><span>STREAK</span><strong>{streak}</strong><span>DIST</span><strong>{distance}PT</strong></div>
        <div className="pixel-hoop" aria-hidden="true"><span>┌────┐</span><b>╲____╱</b></div>
        <div className="pixel-shooter" aria-hidden="true">▟█</div>
        {phase === "flight" || phase === "result" ? <span className="basketball-ball" aria-hidden="true">●</span> : null}

        <div className="basketball-meter-stack">
          <span className="eyebrow">{phaseLabel} // {phase === "aim" ? "CENTER THE LINE" : phase === "power" ? "MATCH THE POWER BAND" : phase === "release" ? "CENTER THE RELEASE" : "WATCH IT FLY"}</span>
          <div className="arcade-aim-track">
            <i style={{ left: `${meter * 100}%` }} />
            <b style={{ left: `${activeTarget * 100}%` }} />
            <span className="basketball-target-window" style={{ left: `${activeTarget * 100}%` }} />
          </div>
          <div className="basketball-locks"><span>AIM {Math.round(aim * 100)}</span><span>POWER {Math.round(power * 100)}</span><span>RELEASE {Math.round(release * 100)}</span></div>
        </div>

        <button type="button" className="button primary basketball-shoot-button" onClick={lockMeter} disabled={storyReady || phase === "flight" || phase === "result"}>
          {phase === "aim" ? "LOCK AIM" : phase === "power" ? "LOCK POWER" : phase === "release" ? "SHOOT" : "BALL IN PLAY"}
        </button>
      </div>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
