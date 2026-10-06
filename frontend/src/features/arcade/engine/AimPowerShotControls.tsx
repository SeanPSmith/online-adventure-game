export type AimPowerPhase = "aim" | "power" | "locked" | "resolving";

function pct(value: number) {
  return `${Math.max(0, Math.min(100, value * 100))}%`;
}

function aimLeft(value: number) {
  return pct((Math.max(-1, Math.min(1, value)) + 1) / 2);
}

export function AimPowerShotControls({
  phase,
  aim,
  power,
  aimTarget = 0,
  aimTolerance = 0.22,
  powerTarget = 0.72,
  powerTolerance = 0.18,
  aimLabel = "AIM",
  powerLabel = "POWER",
}: {
  phase: AimPowerPhase;
  aim: number;
  power: number;
  aimTarget?: number;
  aimTolerance?: number;
  powerTarget?: number;
  powerTolerance?: number;
  aimLabel?: string;
  powerLabel?: string;
}) {
  const aimCenter = (aimTarget + 1) / 2;
  const aimStart = Math.max(0, aimCenter - aimTolerance / 2);
  const aimWidth = Math.min(1 - aimStart, aimTolerance);
  const powerStart = Math.max(0, powerTarget - powerTolerance / 2);
  const powerHeight = Math.min(1 - powerStart, powerTolerance);

  return (
    <div className="aim-power-shot-controls" aria-label="Aim and power controls">
      <div className={`aim-power-aim ${phase === "aim" ? "is-active" : ""}`}>
        <div className="aim-power-label"><span>{aimLabel}</span><strong>{Math.round(aim * 100)}</strong></div>
        <div className="aim-power-horizontal-track">
          <span className="aim-power-horizontal-target" style={{ left: pct(aimStart), width: pct(aimWidth) }} />
          <span className="aim-power-center" />
          <span className="aim-power-horizontal-marker" style={{ left: aimLeft(aim) }} />
        </div>
      </div>

      <div className={`aim-power-power ${phase === "power" ? "is-active" : ""}`}>
        <div className="aim-power-label"><span>{powerLabel}</span><strong>{Math.round(power * 100)}%</strong></div>
        <div className="aim-power-vertical-track">
          <span
            className="aim-power-vertical-target"
            style={{ bottom: pct(powerStart), height: pct(powerHeight) }}
          />
          <span className="aim-power-vertical-fill" style={{ height: pct(power) }} />
          <span className="aim-power-vertical-marker" style={{ bottom: pct(power) }} />
        </div>
      </div>
    </div>
  );
}
