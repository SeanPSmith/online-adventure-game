import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  IntermissionResult,
  StoryAdvancingPayload,
} from "../../services/game";
import {
  liveArcadeGameForServerSlot,
} from "../arcade/ArcadeGameRegistry";
import { IntermissionGameBoundary } from "./IntermissionGameBoundary";

function matchingResult(
  result: IntermissionResult | null,
  payload: StoryAdvancingPayload,
) {
  return Boolean(
    result &&
    result.turn_number === payload.turn_number &&
    result.game_id === payload.game_id
  );
}

export function IntermissionRuntime({
  payload,
  playerId,
  result,
  storyReady,
  storyReadySeconds,
  onSubmitScore,
  onStoryReadyComplete,
}: {
  payload: StoryAdvancingPayload;
  playerId: string | null;
  result: IntermissionResult | null;
  storyReady: boolean;
  storyReadySeconds: number;
  onSubmitScore: (turnNumber: number, gameId: string, score: number) => void;
  onStoryReadyComplete: () => void;
}) {
  const identity = `${payload.room_code}:${payload.turn_number}:${payload.game_id}`;
  const serverSubmitted = Boolean(
    playerId &&
    payload.submitted_player_ids?.includes(playerId),
  );

  const [score, setScore] = useState(0);
  const [mode, setMode] = useState<"play" | "waiting">(
    serverSubmitted ? "waiting" : "play",
  );
  const [submitted, setSubmitted] = useState(serverSubmitted);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalized, setFinalized] = useState(false);

  const scoreRef = useRef(0);
  const startedAtRef = useRef(performance.now());

  useEffect(() => {
    setScore(0);
    scoreRef.current = 0;
    setMode(serverSubmitted ? "waiting" : "play");
    setSubmitted(serverSubmitted);
    setElapsedSeconds(0);
    setFinalized(false);
    startedAtRef.current = performance.now();
  }, [identity]);

  useEffect(() => {
    if (!serverSubmitted) return;
    setSubmitted(true);
    setMode("waiting");
  }, [serverSubmitted]);

  useEffect(() => {
    if (storyReady) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds(
        Math.max(0, (performance.now() - startedAtRef.current) / 1000),
      );
    }, 100);

    return () => window.clearInterval(interval);
  }, [identity, storyReady]);

  const updateScore = useCallback((nextScore: number) => {
    const normalized = Math.max(0, Math.min(999, Math.round(nextScore)));
    scoreRef.current = normalized;
    setScore(normalized);
  }, []);

  const submitFinalScore = useCallback(() => {
    if (submitted) return;

    setSubmitted(true);
    onSubmitScore(
      payload.turn_number,
      payload.game_id,
      scoreRef.current,
    );
  }, [submitted, payload.turn_number, payload.game_id, onSubmitScore]);

  function skipGame() {
    submitFinalScore();
    setMode("waiting");
  }

  useEffect(() => {
    if (!storyReady || storyReadySeconds > 0 || finalized) return;

    submitFinalScore();
    setFinalized(true);

    const timer = window.setTimeout(
      onStoryReadyComplete,
      120,
    );

    return () => window.clearTimeout(timer);
  }, [
    storyReady,
    storyReadySeconds,
    finalized,
    submitFinalScore,
    onStoryReadyComplete,
  ]);

  const resultIsOurs = useMemo(
    () => matchingResult(result, payload),
    [result, payload],
  );

  const localResult = resultIsOurs
    ? result?.scores.find((entry) => entry.player_id === playerId)
    : null;

  const arcadeGame = liveArcadeGameForServerSlot(payload.game_id);
  const ArcadeGame = arcadeGame.component;
  const gameName = arcadeGame.title;

  const compactActionHud = ["action", "racing", "movement"].includes(arcadeGame.category);

  return (
    <div className={`intermission-runtime ${compactActionHud ? "is-action-game" : ""}`}>
      <header className="intermission-runtime-header">
        <div>
          <span className="eyebrow">
            {storyReady
              ? "STORY READY // FINAL SECONDS"
              : payload.play_mode === "solo"
                ? "DIRECTOR WORKING // SOLO INTERMISSION"
                : "DIRECTOR WORKING // INTERMISSION"}
          </span>
          <h2>{gameName}</h2>
        </div>

        <div className="intermission-runtime-readout">
          <strong>
            {storyReady
              ? `${Math.max(0, storyReadySeconds)}s`
              : `WRITING // ${elapsedSeconds.toFixed(1)}s`}
          </strong>
          <span>SCORE {String(score).padStart(3, "0")}</span>
        </div>
      </header>

      {storyReady ? (
        <div className="intermission-story-ready-bar">
          <span
            style={{
              width: `${Math.max(0, Math.min(100, (storyReadySeconds / 3) * 100))}%`,
            }}
          />
        </div>
      ) : null}

      <div className="intermission-party-strip">
        {payload.intermission_stats.map((entry) => (
          <div key={entry.player_id} className={entry.player_id === playerId ? "is-you" : ""}>
            <strong>{entry.name}</strong>
            <span>{entry.wins} INTERMISSION WINS</span>
          </div>
        ))}
      </div>

      {mode === "play" ? (
        <>
          <IntermissionGameBoundary
            key={identity}
            score={score}
            onScoreChange={updateScore}
          >
            <ArcadeGame
              score={score}
              onScoreChange={updateScore}
              storyReady={storyReady}
              turnNumber={payload.turn_number}
              playMode={payload.play_mode}
            />
          </IntermissionGameBoundary>

          {!storyReady ? (
            <button
              className="intermission-skip"
              type="button"
              onClick={skipGame}
            >
              SKIP GAME // WATCH THE STORY MACHINE INSTEAD
            </button>
          ) : null}
        </>
      ) : (
        <div className="intermission-waiting">
          <div className="ascii-hourglass is-large" aria-hidden="true">
            <span>[\\]</span><span>[|]</span><span>[/]</span><span>[-]</span>
          </div>
          <h3>
            {storyReady
              ? "THE NEXT STORY BEAT HAS LANDED_"
              : submitted
                ? "SCORE RECEIVED // THE DIRECTOR IS STILL WRITING_"
                : "THE DIRECTOR IS STILL WRITING_"}
          </h3>
          <p>
            You can stare meaningfully at the hourglass. It has been trained for this.
          </p>
        </div>
      )}

      <footer className="intermission-runtime-footer">
        <span>
          {storyReady
            ? "FINISH WHAT YOU'RE DOING // CONSEQUENCES INCOMING_"
            : "PLAY AS LONG AS THE DIRECTOR NEEDS // THE GAME DOES NOT DELAY GENERATION_"}
        </span>

        {resultIsOurs ? (
          <strong className="intermission-result-inline">
            {result?.solo
              ? `RUN RECORDED // ${localResult?.score ?? score}`
              : result?.tie
                ? "INTERMISSION TIE"
                : `${String(result?.winner_name ?? "SOMEONE").toUpperCase()} TAKES IT`}
          </strong>
        ) : null}
      </footer>
    </div>
  );
}
