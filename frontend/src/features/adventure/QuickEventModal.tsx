import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { QuickEvent } from "../../services/game";

interface QuickEventModalProps {
  event: QuickEvent | null;
  resolution: QuickEvent | null;
  playerId: string | null;
  requiredResponses: number;
  playMode: "coop" | "solo" | undefined;
  onChoose: (optionId: string) => void;
}

function remainingMilliseconds(event: QuickEvent) {
  return Math.max(
    0,
    Number(event.expires_at_ms || 0) - Date.now(),
  );
}

export function QuickEventModal({
  event,
  resolution,
  playerId,
  requiredResponses,
  playMode,
  onChoose,
}: QuickEventModalProps) {
  const activeEvent = event ?? resolution;
  const [remainingMs, setRemainingMs] = useState(
    activeEvent ? remainingMilliseconds(activeEvent) : 0,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSubmitting(false);

    if (!event) {
      setRemainingMs(0);
      return;
    }

    const update = () => {
      setRemainingMs(
        remainingMilliseconds(event),
      );
    };

    update();

    const intervalId = window.setInterval(
      update,
      50,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [event?.id, event?.expires_at_ms]);

  const responseCount = Object.keys(
    event?.responses ?? {},
  ).length;

  const alreadyAnswered = Boolean(
    event &&
    playerId &&
    Object.prototype.hasOwnProperty.call(
      event.responses ?? {},
      playerId,
    ),
  );

  const timedOut = Boolean(
    event && remainingMs <= 0,
  );

  const durationMs = Math.max(
    1,
    Number(event?.timeout_seconds ?? 4) * 1000,
  );

  const remainingRatio = Math.max(
    0,
    Math.min(
      1,
      remainingMs / durationMs,
    ),
  );

  const secondsText = (
    remainingMs / 1000
  ).toFixed(1);

  const timerState = useMemo(() => {
    if (remainingRatio <= 0.25) return "danger";
    if (remainingRatio <= 0.55) return "warning";
    return "safe";
  }, [remainingRatio]);

  if (!activeEvent) {
    return null;
  }

  const showingResolution = Boolean(
    !event && resolution,
  );

  function choose(optionId: string) {
    if (
      submitting ||
      alreadyAnswered ||
      timedOut ||
      showingResolution
    ) {
      return;
    }

    setSubmitting(true);
    onChoose(optionId);
  }

  return (
    <div
      className="qte-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qte-title"
    >
      <section className="qte-modal">
        <div className="qte-kicker">
          <span>QUICK EVENT // REACT NOW</span>
          {!showingResolution ? (
            <strong className={`qte-clock is-${timerState}`}>
              {timedOut ? "0.0" : secondsText}s
            </strong>
          ) : (
            <strong>RECORDED</strong>
          )}
        </div>

        {!showingResolution ? (
          <div
            className={`qte-timer is-${timerState}`}
            aria-label={`${secondsText} seconds remaining`}
          >
            <span
              style={{
                width: `${remainingRatio * 100}%`,
              }}
            />
          </div>
        ) : null}

        <div className="qte-body">
          <span className="eyebrow">
            {String(activeEvent.kind || "split_second")
              .replaceAll("_", " ")
              .toUpperCase()}
          </span>

          <h2 id="qte-title">
            {activeEvent.title || "QUICK EVENT"}
          </h2>

          <p>
            {showingResolution
              ? activeEvent.resolution
              : activeEvent.prompt}
          </p>
        </div>

        {!showingResolution ? (
          <div className="qte-options">
            {activeEvent.options.map((option) => (
              <button
                className="qte-option"
                type="button"
                key={option.id}
                disabled={
                  submitting ||
                  alreadyAnswered ||
                  timedOut
                }
                onClick={() => choose(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        ) : null}

        <footer className="qte-status">
          {showingResolution
            ? "STORY FACT RECORDED_"
            : timedOut
              ? "TIME // THE MOMENT PASSED_"
              : alreadyAnswered
                ? playMode === "solo"
                  ? "REACTION LOCKED // RESOLVING_"
                  : `REACTION LOCKED // WAITING FOR PARTNER (${responseCount}/${Math.max(1, requiredResponses)})_`
                : submitting
                  ? "LOCKING REACTION_"
                  : "CHOOSE YOUR INSTINCT // THIS DOES NOT USE A FULL TURN_"}
        </footer>
      </section>
    </div>
  );
}
