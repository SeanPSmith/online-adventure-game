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

function TargetBand({ center, width, centered = false }: { center: number; width: number; centered?: boolean }) {
  const normalizedCenter = centered ? (center + 1) / 2 : center;
  const half = width / 2;
  const left = Math.max(0, normalizedCenter - half);
  const right = Math.min(1, normalizedCenter + half);
  return (
    <span
      className="timing-shot-target"
      style={{ left: percent(left), width: percent(Math.max(0.02, right - left)) }}
      aria-hidden="true"
    />
  );
}

export function TimingShotMeters({
  phase,
  aim,
  power,
  modifier,
  modifierLabel,
  aimTarget = 0,
  aimTolerance = 0.26,
  powerTarget,
  powerTolerance = 0.16,
  modifierTarget = 0,
  modifierTolerance = 0.28,
}: {
  phase: TimingShotPhase;
  aim: number;
  power: number;
  modifier: number;
  modifierLabel: string;
  aimTarget?: number;
  aimTolerance?: number;
  powerTarget?: number;
  powerTolerance?: number;
  modifierTarget?: number;
  modifierTolerance?: number;
}) {
  return (
    <div className="timing-shot-meters" aria-label="Shot timing meters">
      <div className={`timing-shot-meter ${phase === "aim" ? "is-active" : ""}`}>
        <div className="timing-shot-meter-label">
          <span>AIM</span>
          <strong>{signedPercent(aim)}</strong>
        </div>
        <div className="timing-shot-track is-centered">
          <TargetBand center={aimTarget} width={aimTolerance} centered />
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
          {typeof powerTarget === "number" ? <TargetBand center={powerTarget} width={powerTolerance} /> : null}
          <span className="timing-shot-fill" style={{ width: percent(power) }} />
        </div>
      </div>

      <div className={`timing-shot-meter ${phase === "modifier" ? "is-active" : ""}`}>
        <div className="timing-shot-meter-label">
          <span>{modifierLabel}</span>
          <strong>{signedPercent(modifier)}</strong>
        </div>
        <div className="timing-shot-track is-centered">
          <TargetBand center={modifierTarget} width={modifierTolerance} centered />
          <span className="timing-shot-center" />
          <span className="timing-shot-marker" style={{ left: markerLeft(modifier) }} />
        </div>
      </div>
    </div>
  );
}
