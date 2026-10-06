import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORD_BANK = [
  ["ADVENTURE", "THE WHOLE POINT OF THIS MACHINE"],
  ["CONSEQUENCE", "WHAT FOLLOWS A BRILLIANT IDEA"],
  ["IMAGINATION", "THE PRIMARY FUEL SOURCE"],
  ["INTERMISSION", "A SMALL GAME WHILE THE STORY BREATHES"],
  ["DIRECTOR", "THE MACHINE WRITING YOUR TROUBLE"],
  ["MISCHIEF", "A RECURRING DESIGN PRINCIPLE"],
  ["CHRONICLE", "WHERE FINISHED ADVENTURES GO TO BRAG"],
  ["DUNGEON", "A TERRIBLE PLACE TO FORGET A TORCH"],
  ["ARTIFACT", "AN OBJECT THAT DEFINITELY ISN'T CURSED"],
  ["MYSTERY", "SOMETHING THAT SHOULD BE STRANGE, NOT CONFUSING"],
] as const;

function pickRound(previous?: string) {
  const choices = WORD_BANK.filter(([word]) => word !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? WORD_BANK[0];
}

export function HangmanGame({ score, onScoreChange, storyReady }: ArcadeGameProps) {
  const [round, setRound] = useState(() => pickRound());
  const [guessed, setGuessed] = useState<Set<string>>(() => new Set());
  const [misses, setMisses] = useState(0);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("GUESS A LETTER // SIX MISSES ENDS THE ROUND_");
  const resetTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { feedback, showFeedback } = useArcadeFeedback(1450);

  const [word, hint] = round;
  const solved = [...word].every((letter) => guessed.has(letter));

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function resetRound() {
    setRound((current) => pickRound(current[0]));
    setGuessed(new Set());
    setMisses(0);
    setLocked(false);
    setMessage("NEW WORD // THE ALPHABET DENIES EVERYTHING_");
    rootRef.current?.focus({ preventScroll: true });
  }

  function scheduleReset(delay = 2450) {
    setLocked(true);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(resetRound, delay);
  }

  function guess(letter: string) {
    if (storyReady || locked || guessed.has(letter) || solved || misses >= 6) return;

    const next = new Set(guessed);
    next.add(letter);
    setGuessed(next);

    if (word.includes(letter)) {
      const count = [...word].filter((candidate) => candidate === letter).length;
      const letterAward = count * 2;
      const nowSolved = [...word].every((candidate) => next.has(candidate));
      const solveBonus = nowSolved ? 20 : 0;
      const delta = letterAward + solveBonus;
      onScoreChange(Math.min(999, score + delta));

      if (nowSolved) {
        setMessage(`SOLVED // ${word} // +${delta}_`);
        showFeedback({
          title: "WORD SOLVED",
          detail: word,
          delta,
          tone: "great",
        }, 1800);
        scheduleReset(2600);
      } else {
        setMessage(`CORRECT // ${letter} // +${letterAward}_`);
        showFeedback({ title: `LETTER ${letter}`, detail: "CORRECT", delta: letterAward, tone: "good" }, 900);
      }
      return;
    }

    const nextMisses = misses + 1;
    setMisses(nextMisses);
    if (nextMisses >= 6) {
      setMessage(`HANGED // IT WAS ${word}_`);
      showFeedback({ title: "ROUND LOST", detail: `THE WORD WAS ${word}`, tone: "bad" }, 1800);
      scheduleReset(2700);
    } else {
      setMessage(`NO ${letter} // ${6 - nextMisses} BAD IDEAS REMAIN_`);
      showFeedback({ title: "MISS", detail: `${6 - nextMisses} GUESSES LEFT`, tone: "bad" }, 850);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const letter = event.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      event.preventDefault();
      guess(letter);
    }
  }

  const body = [
    misses >= 1 ? " O " : "   ",
    misses >= 4 ? "/|\\" : misses >= 3 ? "/| " : misses >= 2 ? " | " : "   ",
    misses >= 6 ? "/ \\" : misses >= 5 ? "/  " : "   ",
  ];

  return (
    <div className="intermission-game hangman-cabinet" ref={rootRef} tabIndex={0} onKeyDown={keyDown}>
      <header className="intermission-game-instructions">
        <strong>HANGMAN // VGA WORD TERMINAL</strong>
        <span>CLICK LETTERS OR TYPE THEM // SIX MISSES ENDS THE ROUND</span>
      </header>

      <div className="hangman-cabinet-stage">
        <div className="hangman-cabinet-drawing" aria-label={`${misses} of 6 misses`}>
          <pre>{`+---+\n|   |\n|  ${body[0]}\n|  ${body[1]}\n|  ${body[2]}\n+======`}</pre>
          <span>MISSES {misses}/6</span>
        </div>

        <div className="hangman-cabinet-word">
          <span className="eyebrow">HINT // {hint}</span>
          <strong>{[...word].map((letter) => guessed.has(letter) ? letter : "_").join(" ")}</strong>
          <div className="hangman-letters">
            {[...LETTERS].map((letter) => (
              <button
                type="button"
                key={letter}
                disabled={storyReady || locked || guessed.has(letter)}
                onClick={() => guess(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
