import { useMemo, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { seededShuffle } from "../engine/seeded";

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
type Card = { rank: string; suit: string };

function buildDeck(seed: number) {
  return seededShuffle(
    SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))),
    seed,
  );
}

function handValue(hand: Card[]) {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "A") { value += 11; aces += 1; }
    else if (["J", "Q", "K"].includes(card.rank)) value += 10;
    else value += Number(card.rank);
  }
  while (value > 21 && aces > 0) { value -= 10; aces -= 1; }
  return value;
}

export function BlackjackGame({ score, onScoreChange, turnNumber }: ArcadeGameProps) {
  const [handNo, setHandNo] = useState(1);
  const [deck, setDeck] = useState(() => buildDeck(turnNumber * 997 + 17));
  const [player, setPlayer] = useState<Card[]>(() => deck.slice(0, 2));
  const [dealer, setDealer] = useState<Card[]>(() => deck.slice(2, 4));
  const [cursor, setCursor] = useState(4);
  const [settled, setSettled] = useState(false);
  const [message, setMessage] = useState("HIT OR STAND // GET CLOSE TO 21_");

  const playerValue = useMemo(() => handValue(player), [player]);
  const dealerValue = useMemo(() => handValue(dealer), [dealer]);

  function resetHand() {
    const nextHand = handNo + 1;
    const nextDeck = buildDeck(turnNumber * 997 + nextHand * 131);
    setHandNo(nextHand);
    setDeck(nextDeck);
    setPlayer(nextDeck.slice(0, 2));
    setDealer(nextDeck.slice(2, 4));
    setCursor(4);
    setSettled(false);
    setMessage("NEW HAND // HIT OR STAND_");
  }

  function finish(finalPlayer: Card[], startingDealer = dealer, startCursor = cursor) {
    let dealerHand = [...startingDealer];
    let nextCursor = startCursor;
    while (handValue(dealerHand) < 17) {
      dealerHand.push(deck[nextCursor]);
      nextCursor += 1;
    }
    setDealer(dealerHand);
    setCursor(nextCursor);
    setSettled(true);

    const pv = handValue(finalPlayer);
    const dv = handValue(dealerHand);
    const blackjack = finalPlayer.length === 2 && pv === 21;
    const win = pv <= 21 && (dv > 21 || pv > dv);
    const push = pv <= 21 && pv === dv;
    const award = blackjack ? 18 : win ? 10 : push ? 3 : 0;
    if (award) onScoreChange(Math.min(999, score + award));
    setMessage(blackjack ? "BLACKJACK // +18_" : win ? `HOUSE BEAT // ${pv} TO ${dv} // +10_` : push ? `PUSH // ${pv} // +3_` : pv > 21 ? `BUST // ${pv}_` : `DEALER TAKES IT // ${dv} TO ${pv}_`);
  }

  function hit() {
    if (settled) return;
    const card = deck[cursor];
    const next = [...player, card];
    setPlayer(next);
    setCursor(cursor + 1);
    if (handValue(next) >= 21) finish(next, dealer, cursor + 1);
  }

  return (
    <div className="intermission-game card-cabinet blackjack-game">
      <header className="intermission-game-instructions"><strong>BLACKJACK // HAND {handNo}</strong><span>BEAT THE DEALER WITHOUT GOING OVER 21</span></header>
      <div className="card-table">
        <div><span className="eyebrow">DEALER // {settled ? dealerValue : "?"}</span><div className="playing-card-row">{dealer.map((card, index) => <b key={`${card.rank}${card.suit}${index}`} className="playing-card">{!settled && index === 1 ? "░" : `${card.rank}${card.suit}`}</b>)}</div></div>
        <div><span className="eyebrow">YOU // {playerValue}</span><div className="playing-card-row">{player.map((card, index) => <b key={`${card.rank}${card.suit}${index}`} className="playing-card">{card.rank}{card.suit}</b>)}</div></div>
      </div>
      <div className="arcade-choice-row">{settled ? <button className="button primary" type="button" onClick={resetHand}>NEW HAND</button> : <><button className="button" type="button" onClick={hit}>HIT</button><button className="button primary" type="button" onClick={() => finish(player)}>STAND</button></>}</div>
      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
    </div>
  );
}
