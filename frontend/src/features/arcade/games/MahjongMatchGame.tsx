import { useEffect, useMemo, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { seededShuffle } from "../engine/seeded";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";

const TILE_FAMILIES = [
  { symbol: "東", name: "EAST" },
  { symbol: "南", name: "SOUTH" },
  { symbol: "西", name: "WEST" },
  { symbol: "北", name: "NORTH" },
  { symbol: "中", name: "RED DRAGON" },
  { symbol: "發", name: "GREEN DRAGON" },
  { symbol: "萬", name: "CHARACTERS" },
  { symbol: "筒", name: "CIRCLES" },
] as const;

const TILES = TILE_FAMILIES.map((tile) => tile.symbol);

export function MahjongMatchGame({ score, onScoreChange, turnNumber }: ArcadeGameProps) {
  const [boardNo, setBoardNo] = useState(1);
  const tiles = useMemo(() => seededShuffle([...TILES, ...TILES], turnNumber * 887 + boardNo * 67), [turnNumber, boardNo]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const [moves, setMoves] = useState(0);
  const [misses, setMisses] = useState(0);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("FLIP ONE TILE // THEN FIND ITS MATCH_");
  const { feedback, showFeedback } = useArcadeFeedback(1550);

  useEffect(() => {
    setOpen([]);
    setMatched([]);
    setStreak(0);
    setMoves(0);
    setMisses(0);
    setLocked(false);
    setMessage("FLIP ONE TILE // THEN FIND ITS MATCH_");
  }, [boardNo]);

  const matchedSymbols = useMemo(() => new Set(matched.map((index) => tiles[index])), [matched, tiles]);
  const pairsMatched = matched.length / 2;
  const tilesRemaining = tiles.length - matched.length;
  const complete = matched.length === tiles.length;
  const accuracy = moves === 0 ? 100 : Math.round((pairsMatched / moves) * 100);

  function choose(index: number) {
    if (locked || open.includes(index) || matched.includes(index) || complete) return;
    const nextOpen = [...open, index];
    setOpen(nextOpen);

    if (nextOpen.length < 2) {
      const family = TILE_FAMILIES.find((tile) => tile.symbol === tiles[index]);
      setMessage(`${family?.name ?? "TILE"} REVEALED // FIND THE SECOND ${tiles[index]}_`);
      return;
    }

    setMoves((value) => value + 1);
    const [a, b] = nextOpen;
    if (tiles[a] === tiles[b]) {
      const nextStreak = streak + 1;
      const award = 5 + Math.min(5, nextStreak);
      const nextMatched = [...matched, a, b];
      setMatched(nextMatched);
      setOpen([]);
      setStreak(nextStreak);
      onScoreChange(Math.min(999, score + award));
      const family = TILE_FAMILIES.find((tile) => tile.symbol === tiles[a]);
      setMessage(`${family?.name ?? tiles[a]} PAIR LOCKED // STREAK ${nextStreak} // +${award}_`);
      showFeedback({ title: `${tiles[a]} MATCH!`, detail: `${family?.name ?? "PAIR"} // STREAK ${nextStreak}`, delta: award, tone: nextStreak >= 3 ? "great" : "good" }, 1500);
      if (nextMatched.length === tiles.length) {
        showFeedback({ title: "WALL CLEARED!", detail: `${moves + 1} MOVES // ${misses} MISSES`, tone: "great" }, 2200);
      }
    } else {
      setLocked(true);
      setStreak(0);
      setMisses((value) => value + 1);
      setMessage(`${tiles[a]} ≠ ${tiles[b]} // REMEMBER BOTH LOCATIONS_`);
      window.setTimeout(() => {
        setOpen([]);
        setLocked(false);
        setMessage("BOARD READY // FLIP ONE TILE_");
      }, 950);
    }
  }

  return (
    <div className="intermission-game mahjong-match-game mahjong-match-game-v2">
      <header className="intermission-game-instructions">
        <strong>MAHJONG MATCH // {pairsMatched}/{TILE_FAMILIES.length} PAIRS // {tilesRemaining} TILES LEFT</strong>
        <span>MATCH THE TILES // FLIP TWO // MATCH IDENTICAL SYMBOLS // MATCHED PAIRS STAY CLEARED // BUILD A STREAK</span>
      </header>

      <div className="mahjong-command-layout">
        <section className="mahjong-board-panel">
          <div className="mahjong-status-strip">
            <span>PAIRS <strong>{pairsMatched}/{TILE_FAMILIES.length}</strong></span>
            <span>MOVES <strong>{moves}</strong></span>
            <span>MISSES <strong>{misses}</strong></span>
            <span>STREAK <strong>{streak}</strong></span>
            <span>ACCURACY <strong>{accuracy}%</strong></span>
          </div>
          <div className="mahjong-grid" aria-label="Mahjong memory matching board">
            {tiles.map((tile, index) => {
              const visible = open.includes(index) || matched.includes(index);
              const isMatched = matched.includes(index);
              return (
                <button
                  type="button"
                  key={`${boardNo}:${index}`}
                  className={isMatched ? "is-matched" : visible ? "is-open" : ""}
                  onClick={() => choose(index)}
                  disabled={locked || isMatched}
                  aria-label={visible ? `${tile} ${isMatched ? "matched" : "revealed"}` : `Hidden tile ${index + 1}`}
                >
                  <span>{visible ? tile : "▧"}</span>
                  {isMatched ? <small>MATCH</small> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="mahjong-pair-manifest" aria-label="Pair progress">
          <span className="eyebrow">PAIR MANIFEST // FIND TWO OF EACH</span>
          {TILE_FAMILIES.map((family) => {
            const done = matchedSymbols.has(family.symbol);
            return (
              <div key={family.symbol} className={done ? "is-cleared" : ""}>
                <b>{family.symbol}</b>
                <span>{family.name}</span>
                <i>{done ? "CLEARED" : "HIDDEN"}</i>
              </div>
            );
          })}
          <p>{open.length === 0 ? "No tile held. Reveal one tile to begin a pair." : open.length === 1 ? `One tile held: ${tiles[open[0]]}. Find its twin.` : "Checking pair…"}</p>
        </aside>
      </div>

      {complete ? <button className="button primary" type="button" onClick={() => setBoardNo((value) => value + 1)}>BUILD NEW TILE WALL</button> : null}
      <footer className="intermission-game-message"><span>{complete ? `WALL CLEARED // ${moves} MOVES // ${accuracy}% ACCURACY_` : message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
