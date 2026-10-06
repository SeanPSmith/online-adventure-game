import { useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { seededShuffle } from "../engine/seeded";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["♠", "♥", "♦", "♣"];
type Card = { rank: string; suit: string; value: number };

function deck(seed: number) {
  return seededShuffle(SUITS.flatMap((suit) => RANKS.map((rank, value) => ({ rank, suit, value: value + 2 }))), seed);
}

export function WarCardGame({ score, onScoreChange, turnNumber }: ArcadeGameProps) {
  const [cards, setCards] = useState(() => deck(turnNumber * 719 + 41));
  const [cursor, setCursor] = useState(0);
  const [player, setPlayer] = useState<Card | null>(null);
  const [enemy, setEnemy] = useState<Card | null>(null);
  const [message, setMessage] = useState("FLIP // HIGH CARD TAKES THE BATTLE_");
  const [wars, setWars] = useState(0);

  function reshuffle() {
    setCards(deck(turnNumber * 719 + cursor * 13 + 97));
    setCursor(0);
  }

  function draw() {
    if (cursor + 1 >= cards.length) { reshuffle(); return; }
    const mine = cards[cursor];
    const theirs = cards[cursor + 1];
    setPlayer(mine); setEnemy(theirs); setCursor(cursor + 2);
    if (mine.value > theirs.value) {
      const award = 4 + wars * 4;
      onScoreChange(Math.min(999, score + award));
      setMessage(`YOU TAKE IT // +${award}_`); setWars(0);
    } else if (mine.value < theirs.value) {
      setMessage("HOUSE TAKES THE BATTLE_"); setWars(0);
    } else {
      setMessage("WAR // NEXT WIN IS WORTH MORE_"); setWars((value) => value + 1);
    }
  }

  return (
    <div className="intermission-game card-cabinet war-card-game">
      <header className="intermission-game-instructions"><strong>WAR // CARDS EDITION</strong><span>NO STRATEGY // PURE TERMINAL VIOLENCE</span></header>
      <div className="war-table"><div><span>YOU</span><b className="playing-card is-large">{player ? `${player.rank}${player.suit}` : "░"}</b></div><strong>VS</strong><div><span>HOUSE</span><b className="playing-card is-large">{enemy ? `${enemy.rank}${enemy.suit}` : "░"}</b></div></div>
      <button className="button primary" type="button" onClick={draw}>FLIP CARDS</button>
      <footer className="intermission-game-message"><span>{message}</span><strong>{wars ? `WAR ×${wars}` : `SCORE ${score}`}</strong></footer>
    </div>
  );
}
