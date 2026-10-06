import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

const ROUND_MS = 10_000;
const BOARD_SIZES = [5, 6, 7, 8] as const;
const SYMBOL_PAIRS = [
  ["0", "O"],
  ["1", "I"],
  ["5", "S"],
  ["2", "Z"],
  ["8", "B"],
  ["C", "G"],
  ["M", "N"],
  ["V", "Y"],
  ["<", "{"],
  ["[", "("],
  ["/", "\\"],
  ["+", "*"],
] as const;

interface RoundState {
  id: number;
  targetIndex: number;
  target: string;
  filler: string;
  columns: number;
  rows: number;
  symbolPairIndex: number;
}

function pickDifferentIndex(length: number, previous?: number): number {
  if (length <= 1) return 0;
  if (previous == null || previous < 0 || previous >= length) {
    return Math.floor(Math.random() * length);
  }

  const candidate = Math.floor(Math.random() * (length - 1));
  return candidate >= previous ? candidate + 1 : candidate;
}

function makeRound(id: number, previous?: RoundState): RoundState {
  const boardSizeIndex = pickDifferentIndex(
    BOARD_SIZES.length,
    previous ? BOARD_SIZES.indexOf(previous.columns as (typeof BOARD_SIZES)[number]) : undefined,
  );
  const columns = BOARD_SIZES[boardSizeIndex];
  const rows = columns;
  const cellCount = rows * columns;

  const symbolPairIndex = pickDifferentIndex(
    SYMBOL_PAIRS.length,
    previous?.symbolPairIndex,
  );
  const pair = SYMBOL_PAIRS[symbolPairIndex];
  const targetFirst = Math.random() < 0.5;
  const target = targetFirst ? pair[0] : pair[1];
  const filler = targetFirst ? pair[1] : pair[0];

  return {
    id,
    targetIndex: Math.floor(Math.random() * cellCount),
    target,
    filler,
    columns,
    rows,
    symbolPairIndex,
  };
}

export function FindOutlierGame({
  score,
  onScoreChange,
  storyReady,
}: {
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
}) {
  const [round, setRound] = useState(() => makeRound(1));
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const [cursor, setCursor] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [message, setMessage] = useState("FIND THE ONE CHARACTER THAT DOESN'T BELONG_");

  const roundStartedRef = useRef(performance.now());
  const nextRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const beginNextRound = useCallback(() => {
    setRound((current) => makeRound(current.id + 1, current));
    setRemainingMs(ROUND_MS);
    setCursor(0);
    setRoundComplete(false);
    setMessage("FIND THE ONE CHARACTER THAT DOESN'T BELONG_");
    roundStartedRef.current = performance.now();
  }, []);

  useEffect(() => {
    boardRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (roundComplete) return;

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - roundStartedRef.current;
      const remaining = Math.max(0, ROUND_MS - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0) {
        window.clearInterval(interval);
        setRoundComplete(true);
        setMessage("TIME // THE OUTLIER GOT AWAY_");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [round.id, roundComplete]);

  useEffect(() => {
    if (!roundComplete || storyReady) return;

    nextRoundTimerRef.current = setTimeout(
      beginNextRound,
      1850,
    );

    return () => {
      if (nextRoundTimerRef.current !== null) {
        clearTimeout(nextRoundTimerRef.current);
        nextRoundTimerRef.current = null;
      }
    };
  }, [roundComplete, storyReady, beginNextRound]);

  const choose = useCallback((index: number) => {
    if (roundComplete) return;

    setCursor(index);

    if (index !== round.targetIndex) {
      onScoreChange(Math.max(0, score - 1));
      setMessage("NOPE // THAT ONE WAS PERFECTLY ORDINARY // -1_");
      return;
    }

    const award = Math.max(1, Math.ceil(remainingMs / 1000));
    onScoreChange(Math.min(999, score + award));
    setRoundComplete(true);
    setMessage(`FOUND IT // +${award} // ${Math.ceil(remainingMs / 100) / 10}s LEFT_`);
  }, [roundComplete, round.targetIndex, remainingMs, score, onScoreChange]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (roundComplete) return;

    const row = Math.floor(cursor / round.columns);
    const column = cursor % round.columns;
    let next = cursor;

    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      next = row * round.columns + Math.max(0, column - 1);
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      next = row * round.columns + Math.min(round.columns - 1, column + 1);
    } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      next = Math.max(0, row - 1) * round.columns + column;
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      next = Math.min(round.rows - 1, row + 1) * round.columns + column;
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(cursor);
      return;
    } else {
      return;
    }

    event.preventDefault();
    setCursor(next);
  }

  const cellCount = round.rows * round.columns;
  const cells = useMemo(
    () => Array.from({ length: cellCount }, (_, index) => (
      index === round.targetIndex ? round.target : round.filler
    )),
    [cellCount, round],
  );

  const ratio = Math.max(0, Math.min(1, remainingMs / ROUND_MS));

  return (
    <div className="intermission-game outlier-game">
      <header className="intermission-game-instructions">
        <strong>FIND THE OUTLIER // {round.target} HIDES AMONG {round.filler}</strong>
        <span>GRID // {round.columns}×{round.rows} // NEW SYMBOLS EACH ROUND</span>
        <span>CLICK/TAP // OR MOVE WITH WASD/ARROWS + ENTER</span>
        <span>POINTS = WHOLE SECONDS LEFT // WRONG PICK -1</span>
      </header>

      <div className="outlier-round-bar">
        <span style={{ width: `${ratio * 100}%` }} />
      </div>

      <div
        className="outlier-grid"
        ref={boardRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Find the ${round.target} among ${round.filler} characters on a ${round.columns} by ${round.rows} grid`}
        style={{
          gridTemplateColumns: `repeat(${round.columns}, minmax(0, 1fr))`,
          maxWidth: `${Math.min(620, round.columns * 78)}px`,
        }}
      >
        {cells.map((value, index) => (
          <button
            type="button"
            className={`${cursor === index ? "is-cursor" : ""} ${roundComplete && index === round.targetIndex ? "is-revealed" : ""}`}
            key={`${round.id}:${index}`}
            disabled={roundComplete}
            onMouseEnter={() => setCursor(index)}
            onClick={() => choose(index)}
          >
            {value}
          </button>
        ))}
      </div>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>{(remainingMs / 1000).toFixed(1)}s</strong>
      </footer>
    </div>
  );
}
