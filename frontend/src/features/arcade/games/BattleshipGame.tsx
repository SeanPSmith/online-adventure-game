import { useMemo, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { seededRandom } from "../engine/seeded";

const SIZE = 6;
const SHIPS = [3, 2, 2];

type Shot = "hit" | "miss";

function makeFleet(seed: number) {
  const random = seededRandom(seed);
  const occupied = new Set<number>();
  for (const length of SHIPS) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const horizontal = random() < 0.5;
      const row = Math.floor(random() * SIZE);
      const col = Math.floor(random() * SIZE);
      const cells = Array.from({ length }, (_, offset) => {
        const r = row + (horizontal ? 0 : offset);
        const c = col + (horizontal ? offset : 0);
        return r < SIZE && c < SIZE ? r * SIZE + c : -1;
      });
      if (cells.every((cell) => cell >= 0 && !occupied.has(cell))) { cells.forEach((cell) => occupied.add(cell)); break; }
    }
  }
  return occupied;
}

export function BattleshipGame({ score, onScoreChange, turnNumber }: ArcadeGameProps) {
  const [boardNo, setBoardNo] = useState(1);
  const fleet = useMemo(() => makeFleet(turnNumber * 1103 + boardNo * 53), [turnNumber, boardNo]);
  const [shots, setShots] = useState<Record<number, Shot>>({});
  const [message, setMessage] = useState("RADAR COLD // PICK A COORDINATE_");
  const hits = Object.values(shots).filter((shot) => shot === "hit").length;

  function fire(index: number) {
    if (shots[index]) return;
    const hit = fleet.has(index);
    const nextShots = { ...shots, [index]: hit ? "hit" as const : "miss" as const };
    setShots(nextShots);
    if (hit) {
      onScoreChange(Math.min(999, score + 7));
      setMessage("HIT // CONTACT CONFIRMED // +7_");
      const totalHits = Object.values(nextShots).filter((shot) => shot === "hit").length;
      if (totalHits === fleet.size) setMessage("FLEET SUNK // BOARD CLEAR_");
    } else setMessage("MISS // WATER AND REGRET_");
  }

  function newBoard() { setBoardNo((value) => value + 1); setShots({}); setMessage("NEW CONTACTS // RADAR COLD_"); }

  return (
    <div className="intermission-game battleship-game">
      <header className="intermission-game-instructions"><strong>RADAR FLEET // {hits}/{fleet.size} HITS</strong><span>FIND AND SINK THREE HIDDEN SHIPS</span></header>
      <div className="battleship-grid">{Array.from({ length: SIZE * SIZE }, (_, index) => <button key={index} type="button" className={shots[index] ? `is-${shots[index]}` : ""} onClick={() => fire(index)} aria-label={`Fire at ${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}`}>{shots[index] === "hit" ? "X" : shots[index] === "miss" ? "·" : `${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}`}</button>)}</div>
      {hits === fleet.size ? <button type="button" className="button primary" onClick={newBoard}>NEW RADAR BOARD</button> : null}
      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
    </div>
  );
}
