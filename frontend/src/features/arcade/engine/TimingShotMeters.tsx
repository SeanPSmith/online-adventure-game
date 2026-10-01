import type { TimingShotPhase } from "./useTimingShotEngine";

function percent(value: number) {
  return `${Math.max(0, Math.min(100, value * 100))}%`;
}

function signedPercent(value: number) {
  return `${Math.round(value * 100)}`;
}

function markerLeft(value: number) {
  return percent((value + 1) / 2);
}

export function TimingShotMeters({
  phase,
  aim,
  power,
  modifier,
  modifierLabel,
}: {
  phase: TimingShotPhase;
  aim: number;
  power: number;
  modifier: number;
  modifierLabel: string;
}) {
  return (
    <div className="timing-shot-meters" aria-label="Shot timing meters">
      <div className={`timing-shot-meter ${phase === "aim" ? "is-active" : ""}`}>
        <div className="timing-shot-meter-label">
          <span>AIM</span>
          <strong>{signedPercent(aim)}</strong>
        </div>
        <div className="timing-shot-track is-centered">
          <span className="timing-shot-center" />
          <span className="timing-shot-marker" style={{ left: markerLeft(aim) }} />
        </div>
      </div>

      <div className={`timing-shot-meter ${phase === "power" ? "is-active" : ""}`}>
        <div className="timing-shot-meter-label">
          <span>POWER</span>
          <strong>{Math.round(power * 100)}%</strong>
        </div>
        <div className="timing-shot-track">
          <span className="timing-shot-fill" style={{ width: percent(power) }} />
        </div>
      </div>

      <div className={`timing-shot-meter ${phase === "modifier" ? "is-active" : ""}`}>
        <div className="timing-shot-meter-label">
          <span>{modifierLabel}</span>
          <strong>{signedPercent(modifier)}</strong>
        </div>
        <div className="timing-shot-track is-centered">
          <span className="timing-shot-center" />
          <span className="timing-shot-marker" style={{ left: markerLeft(modifier) }} />
        </div>
      </div>
    </div>
  );
}
