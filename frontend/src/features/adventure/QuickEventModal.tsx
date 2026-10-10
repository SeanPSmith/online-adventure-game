import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QuickEvent, QuickEventEffect } from "../../services/game";

interface QuickEventModalProps {
  event: QuickEvent | null;
  resolution: QuickEvent | null;
  playerId: string | null;
  requiredResponses: number;
  playMode: "coop" | "solo" | undefined;
  onChoose: (optionId: string) => void;
  onDismissResolution: () => void;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function effectLine(effect: QuickEventEffect | null | undefined) {
  if (!effect) return "NO MECHANICAL EFFECT";
  const target = effect.target
    ? effect.target.replaceAll("_", " ").toUpperCase()
    : "CHECK";
  return `${signed(effect.modifier)} ${target} // NEXT ROUND`;
}

export function QuickEventModal({
  event,
  resolution,
  playerId,
  requiredResponses,
  playMode,
  onChoose,
  onDismissResolution,
}: QuickEventModalProps) {
  const activeEvent = event ?? resolution;
  const [timer, setTimer] = useState({ eventId: "", remainingMs: 0 });
  const [submitting, setSubmitting] = useState(false);
  const timedOutEventRef = useRef<string | null>(null);

  const durationMs = Math.max(
    1000,
    Number(event?.timeout_seconds ?? 12) * 1000,
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
      Number(event.timeout_seconds ?? 12) * 1000,
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

  const outcomes = resolution?.outcomes ?? [];
  const localOutcome = playerId
    ? outcomes.find((item) => item.player_id === playerId) ?? null
    : null;

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
      const third = event.options[2];
      const key = keyboardEvent.key.toLowerCase();

      if ((key === "1" || key === "arrowleft" || key === "a") && first) {
        keyboardEvent.preventDefault();
        choose(first.id);
      }

      if ((key === "2" || key === "arrowright" || key === "d") && second) {
        keyboardEvent.preventDefault();
        choose(second.id);
      }

      if ((key === "3" || key === "arrowdown" || key === "s") && third) {
        keyboardEvent.preventDefault();
        choose(third.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [event, showingResolution, submitting, alreadyAnswered, timedOut]);

  if (!activeEvent) {
    return null;
  }

  const oddsDenominator = Math.max(
    2,
    activeEvent.odds_denominator || activeEvent.options.length || 2,
  );

  return (
    <div
      className="qte-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qte-title"
    >
      <section className="qte-modal">
        <div className="qte-kicker">
          <span>
            {showingResolution
              ? "QUICK EVENT // RESULT"
              : activeEvent.options.length === 3
                ? "QUICK EVENT // BEST · NEUTRAL · DANGEROUS"
                : `QUICK EVENT // 1 RIGHT ANSWER IN ${oddsDenominator}`}
          </span>
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

          {!showingResolution ? (
            <div className="qte-stakes" aria-label="Quick-event stakes">
              <div className="is-buff">
                <span>RIGHT</span>
                <strong>{activeEvent.success_effect?.name ?? "TEMPORARY EDGE"}</strong>
                <small>{effectLine(activeEvent.success_effect)}</small>
              </div>
              <div className="is-nerf">
                <span>BAD / TIMEOUT</span>
                <strong>{activeEvent.failure_effect?.name ?? "TEMPORARY SETBACK"}</strong>
                <small>{effectLine(activeEvent.failure_effect)}</small>
              </div>
              {activeEvent.options.length === 3 ? (
                <div className="qte-neutral-note">NEUTRAL // NO MODIFIER</div>
              ) : null}
            </div>
          ) : null}

          {showingResolution && localOutcome ? (
            <div className={`qte-resolution-callout ${localOutcome.success ? "is-success" : localOutcome.tag === "qte_neutral" ? "is-neutral" : "is-failure"}`}>
              <span>{localOutcome.success ? "GOOD REACTION" : localOutcome.tag === "qte_neutral" ? "NEUTRAL REACTION" : "DANGEROUS REACTION"}</span>
              <strong>{localOutcome.option_label || "NO REACTION"}</strong>
              <p>{localOutcome.result}</p>
              {localOutcome.effect ? (
                <div className="qte-effect-result">
                  <b>{localOutcome.effect.name}</b>
                  <span>{effectLine(localOutcome.effect)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {showingResolution && activeEvent.correct_option_label ? (
            <div className="qte-correct-answer">
              CORRECT RESPONSE // <strong>{activeEvent.correct_option_label}</strong>
            </div>
          ) : null}

          {showingResolution && outcomes.length > 1 ? (
            <div className="qte-resolution-party">
              {outcomes.map((outcome) => (
                <div key={`${outcome.player_id}:${outcome.option_id}`}>
                  <strong>{outcome.player_name}</strong>
                  <span>
                    {outcome.success ? "GOOD" : outcome.tag === "qte_neutral" ? "NEUTRAL" : "BAD"} // {outcome.option_label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {!showingResolution ? (
          <div className={`qte-options has-${activeEvent.options.length}`}>
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
            ? "REACTION RESOLVED // YOUR NEXT CHOICE AWAITS_"
            : timedOut
              ? "TIME // REACTION MISSED // RESOLVING_"
              : alreadyAnswered
                ? playMode === "solo"
                  ? "REACTION LOCKED // RESOLVING_"
                  : `REACTION LOCKED // WAITING FOR PARTNER (${responseCount}/${Math.max(1, requiredResponses)})_`
                : submitting
                  ? "LOCKING REACTION_"
                  : activeEvent.options.length > 2
                    ? "1 / A / ←   2 / D / →   3 / S / ↓   // CLICK OR TAP ALSO WORKS_"
                    : "1 / A / ←   OR   2 / D / →   // CLICK OR TAP ALSO WORKS_"}
        </footer>

        {showingResolution ? (
          <button
            className="button button-primary qte-continue"
            type="button"
            onClick={onDismissResolution}
          >
            CONTINUE THE STORY
          </button>
        ) : null}
      </section>
    </div>
  );
}
