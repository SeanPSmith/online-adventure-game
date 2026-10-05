import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORD_BANK = [
  "THREAD",
  "STORY",
  "CHAOS",
  "HERO",
  "SIGNAL",
  "CHOICE",
  "CLOCK",
  "SPARK",
  "RIDDLE",
  "LUCK",
  "PATH",
  "QUEST",
  "GLITCH",
  "DANGER",
];

const HANGMAN_BANK = [
  ["ADVENTURE", "THE WHOLE POINT OF THIS MACHINE"],
  ["CONSEQUENCE", "WHAT HAPPENS AFTER A BRILLIANT IDEA"],
  ["IMAGINATION", "THE PRIMARY FUEL SOURCE"],
  ["INTERMISSION", "YOU ARE CURRENTLY IN ONE"],
  ["DIRECTOR", "THE MACHINE WRITING WHILE YOU WAIT"],
  ["MISCHIEF", "A RECURRING DESIGN PRINCIPLE"],
] as const;

interface WordPuzzle {
  grid: string[][];
  words: string[];
  placements: Record<string, number[]>;
}

function sample<T>(items: T[], count: number) {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count);
}

function createWordSearch(): WordPuzzle {
  const size = 10;
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const candidates = sample(WORD_BANK.filter((word) => word.length <= size), 6);
  const placedWords: string[] = [];
  const placements: Record<string, number[]> = {};
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 1],
  ];

  for (const word of candidates) {
    if (placedWords.length >= 4) break;
    let placed = false;

    for (let attempt = 0; attempt < 250 && !placed; attempt += 1) {
      const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
      const reverse = Math.random() < 0.5;
      const letters = reverse ? [...word].reverse().join("") : word;
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const endX = x + dx * (letters.length - 1);
      const endY = y + dy * (letters.length - 1);
      if (endX < 0 || endY < 0 || endX >= size || endY >= size) continue;

      const indices: number[] = [];
      let valid = true;

      for (let i = 0; i < letters.length; i += 1) {
        const cx = x + dx * i;
        const cy = y + dy * i;
        const existing = grid[cy][cx];
        if (existing && existing !== letters[i]) {
          valid = false;
          break;
        }
        indices.push(cy * size + cx);
      }

      if (!valid) continue;

      indices.forEach((index, i) => {
        const cy = Math.floor(index / size);
        const cx = index % size;
        grid[cy][cx] = letters[i];
      });
      placements[word] = indices;
      placedWords.push(word);
      placed = true;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!grid[y][x]) {
        grid[y][x] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      }
    }
  }

  return {
    grid,
    words: placedWords,
    placements,
  };
}

function WordSearch({
  score,
  onScoreChange,
}: {
  score: number;
  onScoreChange: (score: number) => void;
}) {
  const [puzzle, setPuzzle] = useState<WordPuzzle>(() => createWordSearch());
  const [start, setStart] = useState<number | null>(null);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("SELECT THE FIRST AND LAST LETTER OF A WORD_");

  const foundCells = useMemo(() => {
    const cells = new Set<number>();
    for (const word of found) {
      for (const index of puzzle.placements[word] ?? []) cells.add(index);
    }
    return cells;
  }, [found, puzzle]);

  function pathBetween(a: number, b: number) {
    const ax = a % 10;
    const ay = Math.floor(a / 10);
    const bx = b % 10;
    const by = Math.floor(b / 10);
    const dxRaw = bx - ax;
    const dyRaw = by - ay;

    if (!(dxRaw === 0 || dyRaw === 0 || Math.abs(dxRaw) === Math.abs(dyRaw))) return [];

    const steps = Math.max(Math.abs(dxRaw), Math.abs(dyRaw));
    const dx = steps === 0 ? 0 : dxRaw / steps;
    const dy = steps === 0 ? 0 : dyRaw / steps;

    return Array.from({ length: steps + 1 }, (_, i) => (ay + dy * i) * 10 + (ax + dx * i));
  }

  function choose(index: number) {
    if (start === null) {
      setStart(index);
      setMessage("NOW SELECT THE OTHER END_");
      return;
    }

    const path = pathBetween(start, index);
    const forward = path.map((cell) => puzzle.grid[Math.floor(cell / 10)][cell % 10]).join("");
    const backward = [...forward].reverse().join("");
    const match = puzzle.words.find(
      (word) => !found.has(word) && (word === forward || word === backward),
    );

    setStart(null);

    if (!match) {
      setMessage("NO WORD THERE // THE LETTERS ARE JUST HANGING OUT_");
      return;
    }

    const nextFound = new Set(found);
    nextFound.add(match);
    setFound(nextFound);

    const wordAward = 10 + match.length;
    const clearBonus = nextFound.size === puzzle.words.length ? 30 : 0;
    onScoreChange(Math.min(999, score + wordAward + clearBonus));
    setMessage(
      clearBonus > 0
        ? `FOUND ${match} // +${wordAward} // GRID CLEARED +30_`
        : `FOUND ${match} // +${wordAward}_`,
    );

    if (clearBonus > 0) {
      window.setTimeout(() => {
        setPuzzle(createWordSearch());
        setFound(new Set());
        setStart(null);
      }, 2200);
    }
  }

  return (
    <div className="word-search-layout">
      <div className="word-search-list">
        {puzzle.words.map((word) => (
          <span key={word} className={found.has(word) ? "is-found" : ""}>{word}</span>
        ))}
      </div>

      <div className="word-search-grid">
        {puzzle.grid.flat().map((letter, index) => (
          <button
            type="button"
            key={index}
            className={`${start === index ? "is-start" : ""} ${foundCells.has(index) ? "is-found" : ""}`}
            onClick={() => choose(index)}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="word-puzzle-message">{message}</div>
    </div>
  );
}

function Hangman({
  score,
  onScoreChange,
}: {
  score: number;
  onScoreChange: (score: number) => void;
}) {
  const [round, setRound] = useState(() => HANGMAN_BANK[Math.floor(Math.random() * HANGMAN_BANK.length)]);
  const [guessed, setGuessed] = useState<Set<string>>(() => new Set());
  const [misses, setMisses] = useState(0);
  const [message, setMessage] = useState("GUESS A LETTER // PHYSICAL KEYBOARD WORKS TOO_");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [word, hint] = round;
  const solved = [...word].every((letter) => guessed.has(letter));

  function reset() {
    setRound(HANGMAN_BANK[Math.floor(Math.random() * HANGMAN_BANK.length)]);
    setGuessed(new Set());
    setMisses(0);
    setMessage("NEW WORD // THE ALPHABET DENIES EVERYTHING_");
  }

  function guess(letter: string) {
    if (guessed.has(letter) || solved || misses >= 6) return;

    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);

    if (word.includes(letter)) {
      const count = [...word].filter((candidate) => candidate === letter).length;
      const delta = count * 2;
      const nowSolved = [...word].every((candidate) => next.has(candidate));
      const solveBonus = nowSolved ? 20 : 0;
      onScoreChange(Math.min(999, score + delta + solveBonus));
      setMessage(
        nowSolved
          ? `CORRECT // ${letter} // +${delta} // WORD SOLVED +20_`
          : `CORRECT // ${letter} // +${delta}_`,
      );

      if (nowSolved) {
        window.setTimeout(reset, 2200);
      }
      return;
    }

    const nextMisses = misses + 1;
    setMisses(nextMisses);
    setMessage(`NO ${letter} // ${6 - nextMisses} BAD IDEAS REMAIN_`);

    if (nextMisses >= 6) {
      setMessage(`OUT OF GUESSES // IT WAS ${word} // MOVING ON_`);
      window.setTimeout(reset, 2500);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const letter = event.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      event.preventDefault();
      guess(letter);
    }
  }

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const body = [
    misses >= 1 ? " O " : "   ",
    misses >= 4 ? "/|\\" : misses >= 3 ? "/| " : misses >= 2 ? " | " : "   ",
    misses >= 6 ? "/ \\" : misses >= 5 ? "/  " : "   ",
  ];

  return (
    <div className="hangman-layout" ref={rootRef} tabIndex={0} onKeyDown={keyDown}>
      <div className="hangman-drawing">
        <pre>{`+---+\n|   |\n|  ${body[0]}\n|  ${body[1]}\n|  ${body[2]}\n+======`}</pre>
      </div>

      <div className="hangman-word-area">
        <span className="eyebrow">HINT // {hint}</span>
        <strong className="hangman-word">
          {[...word].map((letter) => guessed.has(letter) ? letter : "_").join(" ")}
        </strong>
        <div className="hangman-letters">
          {[...LETTERS].map((letter) => (
            <button
              type="button"
              key={letter}
              disabled={guessed.has(letter)}
              onClick={() => guess(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <span className="word-puzzle-message">{message}</span>
      </div>
    </div>
  );
}

export function WordPuzzleGame({
  turnNumber,
  score,
  onScoreChange,
  storyReady,
}: {
  turnNumber: number;
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
}) {
  const cycle = Math.floor(Math.max(0, turnNumber - 1) / 6);
  const mode = cycle % 2 === 0 ? "word_search" : "hangman";

  return (
    <div className="intermission-game word-puzzle-game">
      <header className="intermission-game-instructions">
        <strong>{mode === "word_search" ? "WORD SEARCH // FIND WHAT THE GRID IS HIDING" : "HANGMAN // ARGUE WITH THE ALPHABET"}</strong>
        <span>{mode === "word_search" ? "SELECT FIRST LETTER + LAST LETTER // WORDS MAY RUN BACKWARD" : "CLICK LETTERS OR TYPE THEM // SIX MISSES ENDS THE ROUND"}</span>
        <span>{storyReady ? "STORY READY // FINAL GUESSES STILL COUNT" : "THE DIRECTOR IS STILL WRITING // KEEP GOING"}</span>
      </header>

      {mode === "word_search" ? (
        <WordSearch score={score} onScoreChange={onScoreChange} />
      ) : (
        <Hangman score={score} onScoreChange={onScoreChange} />
      )}
    </div>
  );
}
