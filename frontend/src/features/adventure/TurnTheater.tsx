import type { IntermissionResult } from "../../services/game";
import { IntermissionRuntime } from "./IntermissionRuntime";
import type { TurnTheaterState } from "./useTurnTheater";
import { TurnResolutionTheater } from "./TurnResolutionTheater";

function asciiCountdown(value: number) {
  const glyphs: Record<number, string[]> = {
    3: ["33333", "    3", " 3333", "    3", "33333"],
    2: ["22222", "    2", "22222", "2    ", "22222"],
    1: ["  11 ", " 111 ", "  11 ", "  11 ", "11111"],
    0: ["00000", "0   0", "0   0", "0   0", "00000"],
  };

  const normalized = Math.max(0, Math.min(3, Math.ceil(value)));
  return glyphs[normalized].join("\n");
}

export function TurnTheater({
  theater,
  playerId,
  intermissionResult,
  onSubmitIntermissionScore,
  onRetry,
}: {
  theater: TurnTheaterState;
  playerId: string | null;
  intermissionResult: IntermissionResult | null;
  onSubmitIntermissionScore: (turnNumber: number, gameId: string, score: number) => void;
  onRetry: () => void;
}) {
  if (theater.phase === "none") return null;

  if (theater.phase === "resolution" && theater.activeReceipt) {
    return (
      <div className="turn-theater-overlay is-resolution" role="dialog" aria-modal="true">
        <TurnResolutionTheater
          receipt={theater.activeReceipt}
          onContinue={theater.acknowledgeResolution}
        />
      </div>
    );
  }

  const intermissionVisible = Boolean(
    theater.activeIntermission &&
    (theater.phase === "intermission" || theater.phase === "story-ready"),
  );

  if (intermissionVisible && theater.activeIntermission) {
    return (
      <div className={`turn-theater-overlay is-${theater.phase} is-intermission-runtime`} role="dialog" aria-modal="true">
        <IntermissionRuntime
          payload={theater.activeIntermission}
          playerId={playerId}
          result={intermissionResult}
          storyReady={theater.phase === "story-ready"}
          storyReadySeconds={theater.countdownValue}
          onSubmitScore={onSubmitIntermissionScore}
          onStoryReadyComplete={theater.finishIntermissionStoryReady}
        />
      </div>
    );
  }

  return (
    <div className={`turn-theater-overlay is-${theater.phase}`} role="status" aria-live="polite">
      <div className="turn-theater-stage">
        {theater.phase === "lock-countdown" ? (
          <>
            <span className="eyebrow">CHOICES LOCKED</span>
            <pre className="turn-theater-countdown">{asciiCountdown(theater.countdownValue)}</pre>
            <strong>THE STORY IS ABOUT TO MOVE_</strong>
          </>
        ) : null}

        {theater.phase === "intermission" ? (
          <>
            <span className="eyebrow">THE STORY TURNS</span>
            <div className="ascii-hourglass" aria-hidden="true">
              <span>[\\]</span><span>[|]</span><span>[/]</span><span>[-]</span>
            </div>
            <h2>THE NEXT CHAPTER IS TAKING SHAPE_</h2>
            <p>THE STORY DIRECTOR IS WRITING WHAT HAPPENS NEXT_</p>
          </>
        ) : null}

        {theater.phase === "story-ready" ? (
          <>
            <span className="eyebrow">STORY READY</span>
            <pre className="turn-theater-countdown">{asciiCountdown(theater.countdownValue)}</pre>
            <strong>THE CONSEQUENCES HAVE ARRIVED_</strong>
          </>
        ) : null}

        {theater.phase === "retry" ? (
          <>
            <span className="eyebrow">STORY DIRECTOR DELAYED</span>
            <h2>THE MACHINE KEPT YOUR RECEIPT.</h2>
            <p>{theater.retryMessage}</p>
            <p className="muted-copy">
              Your locked choices and authoritative dice results are preserved. Retrying continues from those exact facts; there is no reroll.
            </p>
            <button className="button button-primary" type="button" onClick={onRetry}>
              RETRY STORY GENERATION
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
