import { useEffect, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

export function BasketballGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [meter, setMeter] = useState(0);
  const [direction, setDirection] = useState(1);
  const [streak, setStreak] = useState(0);
  const [distance, setDistance] = useState<2 | 3>(2);
  const [message, setMessage] = useState("TIME THE RELEASE // GREEN WINDOW WINS_");
  const { feedback, showFeedback } = useArcadeFeedback(850);
  const lockRef = useRef(false);

  useEffect(() => {
    if (storyReady) return;
    const timer = window.setInterval(() => {
      if (lockRef.current) return;
      setMeter((current) => {
        let next = current + direction * (distance === 3 ? 0.052 : 0.043);
        if (next >= 1) { next = 1; setDirection(-1); }
        if (next <= 0) { next = 0; setDirection(1); }
        return next;
      });
    }, 38);
    return () => window.clearInterval(timer);
  }, [direction, storyReady, distance]);

  function shoot() {
    if (storyReady || lockRef.current) return;
    lockRef.current = true;
    const quality = 1 - Math.abs(meter - 0.5) * 2;
    const made = quality >= (distance === 3 ? 0.68 : 0.52) || Math.random() < quality * 0.35;
    if (made) {
      const nextStreak = streak + 1;
      const award = distance + Math.min(4, Math.floor(nextStreak / 3));
      setStreak(nextStreak);
      onScoreChange(Math.min(999, score + award));
      setMessage(`${distance === 3 ? "THREE" : "BUCKET"} // STREAK ${nextStreak} // +${award}_`);
      showFeedback({ title: distance === 3 ? "FROM DEEP" : "BUCKET", detail: `STREAK ${nextStreak}`, delta: award, tone: quality > 0.9 ? "great" : "good" });
    } else {
      setStreak(0);
      setMessage("BRICK // STREAK RESET_");
      showFeedback({ title: "BRICK", detail: "RELEASE WAS OFF", tone: "bad" });
    }
    window.setTimeout(() => {
      lockRef.current = false;
      setDistance((current) => current === 2 && Math.random() < 0.35 ? 3 : 2);
    }, 650);
  }

  return (
    <div className="intermission-game basketball-game">
      <header className="intermission-game-instructions"><strong>PIXEL HOOPS // {distance}-POINT SHOT</strong><span>TAP / SHOOT WHEN THE MARKER HITS CENTER</span></header>
      <div className="basketball-court">
        <div className="pixel-hoop"><span>┌────┐</span><b>╲____╱</b></div>
        <div className="arcade-aim-track"><i style={{ left: `${meter * 100}%` }} /><b /></div>
        <button type="button" className="button primary" onClick={shoot} disabled={storyReady}>SHOOT</button>
      </div>
      <footer className="intermission-game-message"><span>{message}</span><strong>STREAK {streak}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
