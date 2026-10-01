import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type TimingShotPhase = "aim" | "power" | "modifier" | "resolving";

export interface TimingShotSample {
  aim: number;
  power: number;
  modifier: number;
}

interface TimingShotEngineOptions {
  aimPeriodMs?: number;
  powerPeriodMs?: number;
  modifierPeriodMs?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pingPong(elapsedMs: number, periodMs: number) {
  const normalized = ((elapsedMs % periodMs) + periodMs) % periodMs / periodMs;
  return normalized <= 0.5
    ? normalized * 2
    : (1 - normalized) * 2;
}

export function useTimingShotEngine({
  aimPeriodMs = 1850,
  powerPeriodMs = 1450,
  modifierPeriodMs = 1325,
}: TimingShotEngineOptions = {}) {
  const [phase, setPhase] = useState<TimingShotPhase>("aim");
  const [aim, setAim] = useState(0);
  const [power, setPower] = useState(0.5);
  const [modifier, setModifier] = useState(0);

  const phaseRef = useRef<TimingShotPhase>("aim");
  const valuesRef = useRef<TimingShotSample>({
    aim: 0,
    power: 0.5,
    modifier: 0,
  });
  const phaseStartedAtRef = useRef(performance.now());
  const frameRef = useRef<number | null>(null);

  const beginPhase = useCallback((nextPhase: TimingShotPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
    phaseStartedAtRef.current = performance.now();
  }, []);

  const reset = useCallback(() => {
    valuesRef.current = {
      aim: 0,
      power: 0.5,
      modifier: 0,
    };
    setAim(0);
    setPower(0.5);
    setModifier(0);
    beginPhase("aim");
  }, [beginPhase]);

  useEffect(() => {
    const tick = (now: number) => {
      const elapsed = now - phaseStartedAtRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === "aim") {
        const nextAim = (pingPong(elapsed, aimPeriodMs) * 2) - 1;
        valuesRef.current.aim = nextAim;
        setAim(nextAim);
      } else if (currentPhase === "power") {
        const nextPower = pingPong(elapsed, powerPeriodMs);
        valuesRef.current.power = nextPower;
        setPower(nextPower);
      } else if (currentPhase === "modifier") {
        const nextModifier = (pingPong(elapsed, modifierPeriodMs) * 2) - 1;
        valuesRef.current.modifier = nextModifier;
        setModifier(nextModifier);
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [aimPeriodMs, powerPeriodMs, modifierPeriodMs]);

  const lock = useCallback((): TimingShotSample | null => {
    const currentPhase = phaseRef.current;

    if (currentPhase === "aim") {
      beginPhase("power");
      return null;
    }

    if (currentPhase === "power") {
      beginPhase("modifier");
      return null;
    }

    if (currentPhase === "modifier") {
      const sample = {
        aim: clamp(valuesRef.current.aim, -1, 1),
        power: clamp(valuesRef.current.power, 0, 1),
        modifier: clamp(valuesRef.current.modifier, -1, 1),
      };
      beginPhase("resolving");
      return sample;
    }

    return null;
  }, [beginPhase]);

  return {
    phase,
    aim,
    power,
    modifier,
    lock,
    reset,
  };
}
