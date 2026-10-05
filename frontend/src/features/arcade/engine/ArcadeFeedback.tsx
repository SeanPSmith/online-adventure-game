import { useCallback, useEffect, useRef, useState } from "react";

export type ArcadeFeedbackTone = "good" | "bad" | "neutral" | "great";
export type ArcadeFeedbackMode = "overlay" | "compact";

export interface ArcadeFeedbackState {
  id: number;
  title: string;
  detail?: string;
  delta?: number;
  tone: ArcadeFeedbackTone;
}

export function useArcadeFeedback(durationMs = 1050) {
  const [feedback, setFeedback] = useState<ArcadeFeedbackState | null>(null);
  const sequenceRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearFeedback = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFeedback(null);
  }, []);

  const showFeedback = useCallback((next: Omit<ArcadeFeedbackState, "id">, customDurationMs = durationMs) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    sequenceRef.current += 1;
    setFeedback({ ...next, id: sequenceRef.current });
    timerRef.current = window.setTimeout(() => {
      setFeedback(null);
      timerRef.current = null;
    }, customDurationMs);
  }, [durationMs]);

  useEffect(() => clearFeedback, [clearFeedback]);

  return { feedback, showFeedback, clearFeedback };
}

export function ArcadeFeedback({
  feedback,
  mode = "overlay",
}: {
  feedback: ArcadeFeedbackState | null;
  mode?: ArcadeFeedbackMode;
}) {
  if (!feedback) return null;

  return (
    <div
      key={feedback.id}
      className={`arcade-feedback is-${feedback.tone} ${mode === "compact" ? "is-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <strong>{feedback.title}</strong>
      {feedback.detail ? <span>{feedback.detail}</span> : null}
      {typeof feedback.delta === "number" && feedback.delta !== 0 ? (
        <b>{feedback.delta > 0 ? `+${feedback.delta}` : feedback.delta}</b>
      ) : null}
    </div>
  );
}
