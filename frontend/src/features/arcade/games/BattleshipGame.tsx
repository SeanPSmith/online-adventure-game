import { useMemo, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { seededRandom } from "../engine/seeded";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const SIZE = 6;

const SHIP_SPECS = [
  { id: "destroyer", name: "DESTROYER", length: 3 },
  { id: "patrol", name: "PATROL BOAT", length: 2 },
  { id: "scout", name: "SCOUT", length: 2 },
] as const;

type Shot = "hit" | "miss";

type FleetShip = {
  id: string;
  name: string;
  length: number;
  cells: number[];
};

function makeFleet(seed: number): FleetShip[] {
  const random = seededRandom(seed);
  const occupied = new Set<number>();
  const ships: FleetShip[] = [];

  for (const spec of SHIP_SPECS) {
    let placed: number[] | null = null;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const horizontal = random() < 0.5;
      const row = Math.floor(random() * SIZE);
      const col = Math.floor(random() * SIZE);
      const cells = Array.from({ length: spec.length }, (_, offset) => {
        const r = row + (horizontal ? 0 : offset);
        const c = col + (horizontal ? offset : 0);
        return r < SIZE && c < SIZE ? r * SIZE + c : -1;
      });
      if (cells.every((cell) => cell >= 0 && !occupied.has(cell))) {
        placed = cells;
        cells.forEach((cell) => occupied.add(cell));
        break;
      }
    }
    if (!placed) throw new Error(`Unable to place ${spec.name}`);
    ships.push({ ...spec, cells: placed });
  }

  return ships;
}

function cellLabel(index: number) {
  return `${String.fromCharCode(65 + (index % SIZE))}${Math.floor(index / SIZE) + 1}`;
}

export function BattleshipGame({ score, onScoreChange, turnNumber }: ArcadeGameProps) {
  const [boardNo, setBoardNo] = useState(1);
  const fleet = useMemo(() => makeFleet(turnNumber * 1103 + boardNo * 53), [turnNumber, boardNo]);
  const [shots, setShots] = useState<Record<number, Shot>>({});
  const [message, setMessage] = useState("RADAR COLD // THREE SHIPS ARE SOMEWHERE IN THE GRID_");
  const { feedback, showFeedback } = useArcadeFeedback(1800);

  const occupied = useMemo(() => new Set(fleet.flatMap((ship) => ship.cells)), [fleet]);
  const hitCells = useMemo(() => new Set(Object.entries(shots).filter(([, shot]) => shot === "hit").map(([index]) => Number(index))), [shots]);
  const shipState = fleet.map((ship) => {
    const hits = ship.cells.filter((cell) => hitCells.has(cell)).length;
    return { ...ship, hits, sunk: hits === ship.length };
  });
  const totalHits = hitCells.size;
  const totalShipCells = fleet.reduce((sum, ship) => sum + ship.length, 0);
  const sunkCount = shipState.filter((ship) => ship.sunk).length;
  const afloatCount = fleet.length - sunkCount;
  const shotsFired = Object.keys(shots).length;

  function fire(index: number) {
    if (shots[index] || sunkCount === fleet.length) return;
    const hit = occupied.has(index);
    const nextShots = { ...shots, [index]: hit ? "hit" as const : "miss" as const };
    setShots(nextShots);

    if (!hit) {
      setMessage(`${cellLabel(index)} // MISS // SEARCH THE ADJACENT LANES_`);
      return;
    }

    const struckShip = fleet.find((ship) => ship.cells.includes(index));
    const newlySunk = struckShip && struckShip.cells.every((cell) => nextShots[cell] === "hit");
    const award = newlySunk ? 14 : 7;
    onScoreChange(Math.min(999, score + award));

    if (newlySunk && struckShip) {
      const remaining = shipState.filter((ship) => !ship.sunk && ship.id !== struckShip.id).length;
      setMessage(`${cellLabel(index)} // ${struckShip.name} SUNK // ${remaining} CONTACT${remaining === 1 ? "" : "S"} REMAIN_`);
      showFeedback({ title: `${struckShip.name} SUNK!`, detail: `${struckShip.length} CELLS // +${award}`, delta: award, tone: "great" }, 2050);
    } else {
      setMessage(`${cellLabel(index)} // HIT // KEEP PRESSURE ON THAT CONTACT_`);
      showFeedback({ title: "HIT!", detail: `${totalHits + 1}/${totalShipCells} HULL SECTIONS`, delta: award, tone: "good" }, 1500);
    }

    const allSunk = fleet.every((ship) => ship.cells.every((cell) => nextShots[cell] === "hit"));
    if (allSunk) {
      setMessage(`FLEET DESTROYED // ${shotsFired + 1} SHOTS FIRED_`);
      showFeedback({ title: "FLEET DESTROYED!", detail: `${shotsFired + 1} SHOTS // RADAR CLEAR`, tone: "great" }, 2300);
    }
  }

  function newBoard() {
    setBoardNo((value) => value + 1);
    setShots({});
    setMessage("NEW FLEET GENERATED // THREE CONTACTS HIDDEN_");
  }

  return (
    <div className="intermission-game battleship-game battleship-game-v2">
      <header className="intermission-game-instructions">
        <strong>RADAR FLEET // {afloatCount} AFLOAT // {sunkCount}/{fleet.length} SUNK</strong>
        <span>FLEET MANIFEST: DESTROYER ×3 // PATROL ×2 // SCOUT ×2 // FIRE UNTIL EVERY SEGMENT IS HIT</span>
      </header>

      <div className="battleship-command-layout">
        <section className="battleship-radar-panel">
          <div className="battleship-radar-status">
            <span>SHOTS <strong>{shotsFired}</strong></span>
            <span>HITS <strong>{totalHits}/{totalShipCells}</strong></span>
            <span>AFLOAT <strong>{afloatCount}</strong></span>
          </div>
          <div className="battleship-grid" aria-label="Enemy radar grid">
            {Array.from({ length: SIZE * SIZE }, (_, index) => (
              <button
                key={index}
                type="button"
                className={shots[index] ? `is-${shots[index]}` : ""}
                onClick={() => fire(index)}
                aria-label={`Fire at ${cellLabel(index)}`}
                disabled={Boolean(shots[index]) || sunkCount === fleet.length}
              >
                {shots[index] === "hit" ? "X" : shots[index] === "miss" ? "·" : cellLabel(index)}
              </button>
            ))}
          </div>
          <div className="battleship-legend"><span><b className="is-hit" /> HIT</span><span><b className="is-miss" /> MISS</span><span><b /> UNKNOWN</span></div>
        </section>

        <aside className="battleship-fleet-manifest" aria-label="Enemy fleet manifest">
          <span className="eyebrow">ENEMY FLEET // KNOWN COMPOSITION</span>
          {shipState.map((ship) => (
            <div key={ship.id} className={`battleship-ship-card ${ship.sunk ? "is-sunk" : ""}`}>
              <div><strong>{ship.name}</strong><span>{ship.sunk ? "SUNK" : `${ship.hits}/${ship.length} HIT`}</span></div>
              <div className="battleship-ship-segments">
                {Array.from({ length: ship.length }, (_, index) => <i key={index} className={index < ship.hits ? "is-hit" : ""} />)}
              </div>
            </div>
          ))}
          <p>Ship positions stay hidden until you hit them. When every segment of one ship is hit, command confirms the sink.</p>
        </aside>
      </div>

      {sunkCount === fleet.length ? <button type="button" className="button primary" onClick={newBoard}>GENERATE NEW FLEET</button> : null}
      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
