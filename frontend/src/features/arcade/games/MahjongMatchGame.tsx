import { useEffect, useMemo, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { seededShuffle } from "../engine/seeded";

const TILES = ["東", "南", "西", "北", "中", "發", "萬", "筒"];

export function MahjongMatchGame({ score, onScoreChange, turnNumber }: ArcadeGameProps) {
  const [boardNo, setBoardNo] = useState(1);
  const tiles = useMemo(() => seededShuffle([...TILES, ...TILES], turnNumber * 887 + boardNo * 67), [turnNumber, boardNo]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("MATCH THE TILES // MEMORY PAYS_");

  useEffect(() => {
    setOpen([]); setMatched([]); setStreak(0); setLocked(false); setMessage("MATCH THE TILES // MEMORY PAYS_");
  }, [boardNo]);

  function choose(index: number) {
    if (locked || open.includes(index) || matched.includes(index)) return;
    const nextOpen = [...open, index];
    setOpen(nextOpen);
    if (nextOpen.length < 2) return;
    const [a, b] = nextOpen;
    if (tiles[a] === tiles[b]) {
      const nextStreak = streak + 1;
      const award = 5 + Math.min(5, nextStreak);
      setMatched((current) => [...current, a, b]);
      setOpen([]); setStreak(nextStreak); onScoreChange(Math.min(999, score + award));
      setMessage(`PAIR LOCKED // STREAK ${nextStreak} // +${award}_`);
    } else {
      setLocked(true); setStreak(0); setMessage("NO MATCH // COMMIT THEM TO MEMORY_");
      window.setTimeout(() => { setOpen([]); setLocked(false); }, 700);
    }
  }

  const complete = matched.length === tiles.length;
  return (
    <div className="intermission-game mahjong-match-game">
      <header className="intermission-game-instructions"><strong>MAHJONG MATCH // {matched.length / 2}/8 PAIRS</strong><span>FLIP TWO TILES // BUILD A MATCH STREAK</span></header>
      <div className="mahjong-grid">{tiles.map((tile, index) => { const visible = open.includes(index) || matched.includes(index); return <button type="button" key={`${boardNo}:${index}`} className={matched.includes(index) ? "is-matched" : visible ? "is-open" : ""} onClick={() => choose(index)}>{visible ? tile : "▧"}</button>; })}</div>
      {complete ? <button className="button primary" type="button" onClick={() => setBoardNo((value) => value + 1)}>NEW TILE WALL</button> : null}
      <footer className="intermission-game-message"><span>{complete ? "WALL CLEARED // PERFECT MEMORY_" : message}</span><strong>STREAK {streak}</strong></footer>
    </div>
  );
}
