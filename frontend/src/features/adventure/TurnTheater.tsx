import { useEffect, useState } from "react";
import type { IntermissionResult } from "../../services/game";
import type { InkPaper } from "../appearance/inkboundPaper";
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
  inkPaper,
  theater,
  playerId,
  intermissionResult,
  onSubmitIntermissionScore,
  onRetry,
  onSync,
}: {
  inkPaper?: InkPaper;
  theater: TurnTheaterState;
  playerId: string | null;
  intermissionResult: IntermissionResult | null;
  onSubmitIntermissionScore: (turnNumber: number, gameId: string, score: number) => void;
  onRetry: () => void;
  onSync: () => void;
}) {
  const [showResync, setShowResync] = useState(false);
  const readyWithoutExit = theater.phase === "story-ready" && theater.countdownValue === 0;
  useEffect(() => {
    setShowResync(false);
    if (theater.phase !== "intermission" && !readyWithoutExit) return;
    // Resync requests a saved room snapshot; it does not regenerate text or
    // reroll dice. Keep normal 3-second transitions completely uninterrupted.
    const timer = window.setTimeout(() => setShowResync(true), readyWithoutExit ? 10000 : 90000);
    return () => window.clearTimeout(timer);
  }, [theater.phase, readyWithoutExit]);

  if (theater.phase === "none") return null;

  if (theater.phase === "resolution" && theater.activeReceipt) {
    return (
      <div className={`turn-theater-overlay is-resolution ${inkPaper ? "inkbound-turn-theater" : ""}`} data-ink-paper={inkPaper} role="dialog" aria-modal="true">
        <TurnResolutionTheater
          receipt={theater.activeReceipt}
          inkbound={Boolean(inkPaper)}
          onContinue={theater.acknowledgeResolution}
        />
      </div>
    );
  }

  const intermissionVisible = Boolean(
    theater.activeIntermission && theater.arcadeAvailable &&
    (theater.phase === "intermission" || theater.phase === "story-ready"),
  );

  if (intermissionVisible && theater.activeIntermission) {
    return (
      <div className={`turn-theater-overlay is-${theater.phase} is-intermission-runtime ${inkPaper ? "inkbound-turn-theater" : ""}`} data-ink-paper={inkPaper} role="dialog" aria-modal="true">
        <IntermissionRuntime
          payload={theater.activeIntermission}
          playerId={playerId}
          result={intermissionResult}
          storyReady={theater.phase === "story-ready"}
          storyReadySeconds={theater.countdownValue}
          onSubmitScore={onSubmitIntermissionScore}
          onStoryReadyComplete={theater.finishIntermissionStoryReady}
        />
        {showResync ? (
          <div className="system-notice" role="status">
            <p>THE STORY IS TAKING LONGER THAN EXPECTED. YOU CAN RESTORE THE ROOM STATE WITHOUT RELOADING OR REROLLING.</p>
            <button className="button" type="button" onClick={onSync}>RE-SYNC STORY</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`turn-theater-overlay is-${theater.phase} ${inkPaper ? "inkbound-turn-theater" : ""}`} data-ink-paper={inkPaper} role="status" aria-live="polite">
      <div className="turn-theater-stage">
        {theater.phase === "intermission" ? (
          <>
            <span className="eyebrow">{inkPaper ? "BETWEEN THE PAGES" : "THE STORY TURNS"}</span>
            <div className="ascii-hourglass" aria-hidden="true">
              <span>[\\]</span><span>[|]</span><span>[/]</span><span>[-]</span>
            </div>
            <h2>{inkPaper ? "A page is being written" : "THE NEXT CHAPTER IS TAKING SHAPE_"}</h2>
            <p>{inkPaper ? "Your choices are settled. The next chapter is on its way." : "THE STORY DIRECTOR IS WRITING WHAT HAPPENS NEXT_"}</p>
          </>
        ) : null}

        {theater.phase === "story-ready" ? (
          <>
            <span className="eyebrow">{inkPaper ? "THE NEXT PAGE" : "STORY READY"}</span>
            <pre className="turn-theater-countdown">{asciiCountdown(theater.countdownValue)}</pre>
            <strong>{inkPaper ? "The chronicle continues shortly" : "THE CONSEQUENCES HAVE ARRIVED_"}</strong>
          </>
        ) : null}

        {showResync && theater.phase !== "retry" ? (
          <div className="system-notice" role="status">
            <p>STILL WAITING FOR THE STORY. CHECK THE SERVER STATE WITHOUT RESTARTING THE ADVENTURE.</p>
            <button className="button" type="button" onClick={onSync}>RE-SYNC STORY</button>
          </div>
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
