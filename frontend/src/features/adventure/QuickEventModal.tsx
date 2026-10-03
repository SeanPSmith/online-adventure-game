import {
  useEffect,
  useMemo,
  useRef,
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

export function QuickEventModal({
  event,
  resolution,
  playerId,
  requiredResponses,
  playMode,
  onChoose,
}: QuickEventModalProps) {
  const activeEvent = event ?? resolution;
  const [timer, setTimer] = useState({ eventId: "", remainingMs: 0 });
  const [submitting, setSubmitting] = useState(false);
  const timedOutEventRef = useRef<string | null>(null);

  const durationMs = Math.max(
    1000,
    Number(event?.timeout_seconds ?? 9) * 1000,
  );

  const remainingMs = event
    ? timer.eventId === event.id
      ? timer.remainingMs
      : durationMs
    : 0;

  useEffect(() => {
    setSubmitting(false);
    timedOutEventRef.current = null;

    if (!event) {
      setTimer({ eventId: "", remainingMs: 0 });
      return;
    }

    // IMPORTANT: the server schedules this event while the previous turn's
    // resolution theater may still be on screen. The playable clock therefore
    // starts HERE, when the QTE is actually rendered, not at server creation.
    const startedAt = Date.now();
    const duration = Math.max(
      1000,
      Number(event.timeout_seconds ?? 9) * 1000,
    );

    const update = () => {
      setTimer({
        eventId: event.id,
        remainingMs: Math.max(0, duration - (Date.now() - startedAt)),
      });
    };

    setTimer({ eventId: event.id, remainingMs: duration });
    const intervalId = window.setInterval(update, 50);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [event?.id, event?.timeout_seconds]);

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

  useEffect(() => {
    if (
      !event ||
      showingResolution ||
      submitting ||
      alreadyAnswered ||
      remainingMs > 0 ||
      timedOutEventRef.current === event.id
    ) {
      return;
    }

    // Timeout is a real response, not a dead-end UI state. Sending it lets the
    // server resolve the micro-event and guarantees normal story choices return.
    timedOutEventRef.current = event.id;
    setSubmitting(true);
    onChoose("__timeout__");
  }, [
    event,
    showingResolution,
    submitting,
    alreadyAnswered,
    remainingMs,
    onChoose,
  ]);

  useEffect(() => {
    if (
      !event ||
      showingResolution ||
      submitting ||
      alreadyAnswered ||
      timedOut
    ) {
      return;
    }

    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      const first = event.options[0];
      const second = event.options[1];
      const key = keyboardEvent.key.toLowerCase();

      if ((key === "1" || key === "arrowleft" || key === "a") && first) {
        keyboardEvent.preventDefault();
        choose(first.id);
      }

      if ((key === "2" || key === "arrowright" || key === "d") && second) {
        keyboardEvent.preventDefault();
        choose(second.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [event, showingResolution, submitting, alreadyAnswered, timedOut]);

  if (!activeEvent) {
    return null;
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
          <>
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
            <div className="qte-reaction-track" aria-hidden="true">
              <span />
            </div>
          </>
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

          {(activeEvent.scene_title || activeEvent.story_context) ? (
            <div className="qte-story-context">
              {activeEvent.scene_title ? (
                <strong>{activeEvent.scene_title}</strong>
              ) : null}
              {activeEvent.story_context ? (
                <span>{activeEvent.story_context}</span>
              ) : null}
            </div>
          ) : null}

          <p>
            {showingResolution
              ? activeEvent.resolution
              : activeEvent.prompt}
          </p>
        </div>

        {!showingResolution ? (
          <div className="qte-options">
            {activeEvent.options.map((option, index) => (
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
                <span className="qte-option-key">
                  {index + 1}
                </span>
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
              ? "TIME // REACTION MISSED // RESOLVING_"
              : alreadyAnswered
                ? playMode === "solo"
                  ? "REACTION LOCKED // RESOLVING_"
                  : `REACTION LOCKED // WAITING FOR PARTNER (${responseCount}/${Math.max(1, requiredResponses)})_`
                : submitting
                  ? "LOCKING REACTION_"
                  : "1 / A / ←   OR   2 / D / →   // CLICK OR TAP ALSO WORKS_"}
        </footer>
      </section>
    </div>
  );
}
