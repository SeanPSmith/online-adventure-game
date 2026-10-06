import { useEffect, useMemo, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const CUP_COUNT = 10;
const CUP_POSITIONS = [0.72, 0.77, 0.82, 0.87, 0.745, 0.795, 0.845, 0.77, 0.82, 0.795];

type Flight = {
  landingX: number;
  apex: number;
  hitCup: number | null;
  award: number;
};

export function BeerPongGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [cups, setCups] = useState(() => Array.from({ length: CUP_COUNT }, (_, index) => index));
  const [angle, setAngle] = useState(45);
  const [power, setPower] = useState(88);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [flightT, setFlightT] = useState(0);
  const [message, setMessage] = useState("SET ANGLE + POWER // THROW THE ARC_");
  const [throwNo, setThrowNo] = useState(1);
  const frameRef = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const { feedback, showFeedback } = useArcadeFeedback(1650);

  const ballPosition = useMemo(() => {
    if (!flight) return null;
    const startX = 0.08;
    const x = startX + (flight.landingX - startX) * flightT;
    const baseline = 0.78;
    const y = baseline - Math.sin(Math.PI * flightT) * flight.apex;
    return { x, y };
  }, [flight, flightT]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  function animateThrow(nextFlight: Flight) {
    const started = performance.now();
    const duration = 980;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      setFlightT(t);
      if (t < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      frameRef.current = null;
      if (nextFlight.hitCup !== null) {
        const cup = nextFlight.hitCup;
        setCups((current) => current.filter((id) => id !== cup));
        onScoreChange(Math.min(999, score + nextFlight.award));
        setMessage(`CUP ${cup + 1} SUNK // +${nextFlight.award}_`);
        showFeedback({
          title: nextFlight.award >= 15 ? "DEAD CENTER!" : "SPLASH!",
          detail: `CUP ${cup + 1} // THROW ${throwNo}`,
          delta: nextFlight.award,
          tone: nextFlight.award >= 15 ? "great" : "good",
        }, 1850);
      } else {
        setMessage("MISS // READ THE ARC AND ADJUST_");
        showFeedback({ title: "MISS", detail: nextFlight.landingX < 0.7 ? "SHORT" : nextFlight.landingX > 0.91 ? "LONG" : "RIM / TABLE", tone: "bad" }, 1650);
      }

      resetTimer.current = window.setTimeout(() => {
        setFlight(null);
        setFlightT(0);
        setThrowNo((value) => value + 1);
        if (nextFlight.hitCup !== null && cups.length === 1) {
          setCups(Array.from({ length: CUP_COUNT }, (_, index) => index));
          setMessage("TABLE CLEARED // FRESH RACK_");
        } else {
          setMessage("SET ANGLE + POWER // THROW THE ARC_");
        }
      }, 1850);
    };
    frameRef.current = window.requestAnimationFrame(tick);
  }

  function throwBall() {
    if (storyReady || flight || cups.length === 0) return;

    const radians = (angle * Math.PI) / 180;
    const normalizedRange = Math.pow(power / 100, 2) * Math.sin(2 * radians);
    const landingX = 0.08 + normalizedRange * 0.86;
    const apex = 0.2 + Math.sin(radians) * (0.18 + power / 500);

    let hitCup: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cup of cups) {
      const distance = Math.abs(CUP_POSITIONS[cup] - landingX);
      if (distance < bestDistance) {
        bestDistance = distance;
        hitCup = cup;
      }
    }
    if (bestDistance > 0.024) hitCup = null;

    const award = hitCup !== null && bestDistance < 0.009 ? 15 : 10;
    const nextFlight = { landingX, apex, hitCup, award };
    setFlight(nextFlight);
    setFlightT(0);
    setMessage(`THROW ${throwNo} // ${angle}° @ ${power}%_`);
    animateThrow(nextFlight);
  }

  return (
    <div className="intermission-game beer-pong-game">
      <header className="intermission-game-instructions">
        <strong>BEER PONG // BALLISTICS MODE // {cups.length} CUPS REMAIN</strong>
        <span>GORILLAS-STYLE THROWING // SET ANGLE + POWER // WATCH THE ARC // ADJUST</span>
      </header>

      <div className="beer-pong-ballistics">
        <div className="beer-pong-side-stage" aria-label={`${cups.length} cups remaining`}>
          <div className="beer-pong-thrower" aria-hidden="true">◢█</div>
          <div className="beer-pong-side-rack">
            {Array.from({ length: CUP_COUNT }, (_, index) => (
              <span
                key={index}
                className={cups.includes(index) ? "is-cup" : "is-down"}
                style={{ left: `${CUP_POSITIONS[index] * 100}%`, zIndex: 20 - index }}
              >
                {cups.includes(index) ? "▾" : "·"}
              </span>
            ))}
          </div>
          {ballPosition ? (
            <span
              className="beer-pong-ball"
              style={{ left: `${ballPosition.x * 100}%`, top: `${ballPosition.y * 100}%` }}
              aria-hidden="true"
            >●</span>
          ) : null}
          <div className="beer-pong-table-line" aria-hidden="true" />
        </div>

        <div className="beer-pong-controls">
          <label><span>ANGLE // {angle}°</span><input type="range" min="25" max="70" value={angle} disabled={Boolean(flight) || storyReady} onChange={(event) => setAngle(Number(event.target.value))} /></label>
          <label><span>POWER // {power}%</span><input type="range" min="45" max="100" value={power} disabled={Boolean(flight) || storyReady} onChange={(event) => setPower(Number(event.target.value))} /></label>
          <button type="button" className="button primary" onClick={throwBall} disabled={Boolean(flight) || storyReady}>THROW BALL</button>
        </div>
      </div>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
