import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { swipeDirection, type SwipePoint } from "../arcade/engine/swipe";

const WIDTH = 25;
const HEIGHT = 15;

type Cell = "#" | " ";
interface Point { x: number; y: number; }

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildMaze(): Cell[][] {
  const grid: Cell[][] = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => "#" as Cell),
  );

  function carve(x: number, y: number) {
    grid[y][x] = " ";

    const directions = shuffle([
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ]);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx <= 0 || ny <= 0 || nx >= WIDTH - 1 || ny >= HEIGHT - 1) continue;
      if (grid[ny][nx] !== "#") continue;

      grid[y + (dy / 2)][x + (dx / 2)] = " ";
      carve(nx, ny);
    }
  }

  carve(1, 1);
  grid[HEIGHT - 2][WIDTH - 2] = " ";
  return grid;
}

export function MazeGame({
  score,
  onScoreChange,
}: {
  score: number;
  onScoreChange: (score: number) => void;
  storyReady: boolean;
}) {
  const [maze, setMaze] = useState<Cell[][]>(() => buildMaze());
  const [player, setPlayer] = useState<Point>({ x: 1, y: 1 });
  const [steps, setSteps] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [message, setMessage] = useState("FIND THE EXIT // TRY NOT TO DEVELOP A METAPHOR_");
  const boardRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<SwipePoint | null>(null);

  useEffect(() => {
    boardRef.current?.focus({ preventScroll: true });
  }, []);

  const reset = useCallback(() => {
    setMaze(buildMaze());
    setPlayer({ x: 1, y: 1 });
    setSteps(0);
    setRoundComplete(false);
    setMessage("NEW MAZE // SAME QUESTIONABLE LIFE CHOICES_");
  }, []);

  const move = useCallback((dx: number, dy: number) => {
    if (roundComplete) return;

    setPlayer((current) => {
      const next = { x: current.x + dx, y: current.y + dy };
      if (maze[next.y]?.[next.x] !== " ") {
        setMessage("WALL // VERY SOLID // VERY UNHELPFUL_");
        return current;
      }

      const nextSteps = steps + 1;
      setSteps(nextSteps);

      if (next.x === WIDTH - 2 && next.y === HEIGHT - 2) {
        const bonus = Math.max(5, 35 - Math.floor(nextSteps / 3));
        onScoreChange(Math.min(999, score + bonus));
        setRoundComplete(true);
        setMessage(`EXIT FOUND // +${bonus} // NEXT MAZE IN A MOMENT_`);
        window.setTimeout(reset, 1900);
      }

      return next;
    });
  }, [maze, steps, score, onScoreChange, reset, roundComplete]);

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") move(-1, 0);
    else if (key === "arrowright" || key === "d") move(1, 0);
    else if (key === "arrowup" || key === "w") move(0, -1);
    else if (key === "arrowdown" || key === "s") move(0, 1);
    else return;
    event.preventDefault();
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const direction = swipeDirection(
      swipeStartRef.current,
      { x: event.clientX, y: event.clientY },
    );
    swipeStartRef.current = null;
    if (direction === "left") move(-1, 0);
    else if (direction === "right") move(1, 0);
    else if (direction === "up") move(0, -1);
    else if (direction === "down") move(0, 1);
  }

  const mazeText = useMemo(() => {
    return maze.map((row, y) => row.map((cell, x) => {
      if (x === player.x && y === player.y) return "@";
      if (x === WIDTH - 2 && y === HEIGHT - 2) return "◇";
      return cell === "#" ? "█" : " ";
    }).join("")).join("\n");
  }, [maze, player]);

  return (
    <div className="intermission-game maze-game">
      <header className="intermission-game-instructions">
        <strong>MAZE RUNNER // @ MUST REACH ◇</strong>
        <span>WASD/ARROWS // SWIPE THE MAZE // TOUCH CONTROLS BELOW</span>
        <span>FASTER ROUTES SCORE MORE // COMPLETING A MAZE STARTS ANOTHER</span>
      </header>

      <div
        className="maze-board-wrap"
        ref={boardRef}
        tabIndex={0}
        onKeyDown={keyDown}
        onPointerDown={pointerDown}
        onPointerUp={pointerUp}
        onPointerCancel={() => { swipeStartRef.current = null; }}
      >
        <pre className="maze-board">{mazeText}</pre>
      </div>

      <div className="maze-touch-controls" aria-label="Maze direction controls">
        <button type="button" onClick={() => move(0, -1)}>↑</button>
        <div>
          <button type="button" onClick={() => move(-1, 0)}>←</button>
          <button type="button" onClick={() => move(0, 1)}>↓</button>
          <button type="button" onClick={() => move(1, 0)}>→</button>
        </div>
      </div>

      <footer className="intermission-game-message">
        <span>{message}</span>
        <strong>STEPS {steps}</strong>
      </footer>
    </div>
  );
}
