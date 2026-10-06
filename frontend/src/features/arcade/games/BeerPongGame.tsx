import { useEffect, useMemo, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const CUP_COUNT = 10;

export function BeerPongGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [cups, setCups] = useState(() => Array.from({ length: CUP_COUNT }, (_, index) => index));
  const [aim, setAim] = useState(0.5);
  const [direction, setDirection] = useState(1);
  const [message, setMessage] = useState("LOCK THE LINE // TAP THROW_");
  const { feedback, showFeedback } = useArcadeFeedback(850);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    if (storyReady) return;
    const timer = window.setInterval(() => {
      setAim((current) => {
        let next = current + direction * 0.035;
        if (next >= 1) { next = 1; setDirection(-1); }
        if (next <= 0) { next = 0; setDirection(1); }
        return next;
      });
    }, 42);
    return () => window.clearInterval(timer);
  }, [direction, storyReady]);

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  const targetCup = useMemo(() => cups[Math.floor(aim * Math.max(0, cups.length - 1))] ?? 0, [aim, cups]);

  function throwBall() {
    if (cups.length === 0 || storyReady) return;
    const accuracy = 1 - Math.abs(aim - 0.5) * 2;
    const hit = Math.random() < 0.22 + accuracy * 0.73;
    if (!hit) {
      setMessage("RIMMED OUT // THE TABLE REMAINS SMUG_");
      showFeedback({ title: "MISS", detail: "RESET YOUR LINE", tone: "bad" });
      return;
    }

    const award = accuracy > 0.86 ? 15 : 10;
    const nextScore = Math.min(999, score + award);
    onScoreChange(nextScore);
    setCups((current) => current.filter((cup) => cup !== targetCup));
    setMessage(`CUP ${targetCup + 1} DOWN // +${award}_`);
    showFeedback({ title: "SPLASH", detail: accuracy > 0.86 ? "CENTER CUP" : "CLEAN ENOUGH", delta: award, tone: "great" });

    if (cups.length === 1) {
      setMessage("TABLE CLEARED // RERACKING_");
      resetTimer.current = window.setTimeout(() => {
        setCups(Array.from({ length: CUP_COUNT }, (_, index) => index));
        setMessage("FRESH RACK // LOCK THE LINE_");
      }, 1500);
    }
  }

  return (
    <div className="intermission-game beer-pong-game">
      <header className="intermission-game-instructions">
        <strong>BEER PONG // {cups.length} CUPS REMAIN</strong>
        <span>TAP / SPACE WHEN THE AIM MARKER CROSSES CENTER</span>
      </header>
      <div className="beer-pong-table">
        <div className="beer-pong-rack" aria-label={`${cups.length} cups remaining`}>
          {Array.from({ length: CUP_COUNT }, (_, index) => (
            <span key={index} className={cups.includes(index) ? "is-cup" : "is-down"}>{cups.includes(index) ? "U" : "·"}</span>
          ))}
        </div>
        <div className="arcade-aim-track"><i style={{ left: `${aim * 100}%` }} /><b /></div>
        <button type="button" className="button primary" onClick={throwBall} disabled={storyReady}>THROW</button>
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>{score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
