import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
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

function suitClass(card: Card) {
  return card.suit === "♥" || card.suit === "♦" ? "is-red-suit" : "";
}

function dealStyle(order: number): CSSProperties {
  return { "--deal-order": order } as CSSProperties;
}

export function BlackjackGame({ score, onScoreChange, turnNumber, storyReady }: ArcadeGameProps) {
  const [handNo, setHandNo] = useState(1);
  const [deck, setDeck] = useState(() => buildDeck(turnNumber * 997 + 17));
  const [player, setPlayer] = useState<Card[]>(() => deck.slice(0, 2));
  const [dealer, setDealer] = useState<Card[]>(() => deck.slice(2, 4));
  const [cursor, setCursor] = useState(4);
  const [settled, setSettled] = useState(false);
  const [dealing, setDealing] = useState(true);
  const [message, setMessage] = useState("DEALING // TABLE OPENING_");
  const dealTimer = useRef<number | null>(null);
  const { feedback, showFeedback } = useArcadeFeedback(1900);

  const playerValue = useMemo(() => handValue(player), [player]);
  const dealerValue = useMemo(() => handValue(dealer), [dealer]);

  useEffect(() => {
    setDealing(true);
    setMessage("DEALING // CARDS ON THE FELT_");
    if (dealTimer.current !== null) window.clearTimeout(dealTimer.current);
    dealTimer.current = window.setTimeout(() => {
      setDealing(false);
      setMessage("HIT OR STAND // GET CLOSE TO 21_");
    }, 760);
    return () => {
      if (dealTimer.current !== null) window.clearTimeout(dealTimer.current);
    };
  }, [handNo]);

  function resetHand() {
    const nextHand = handNo + 1;
    const nextDeck = buildDeck(turnNumber * 997 + nextHand * 131);
    setHandNo(nextHand);
    setDeck(nextDeck);
    setPlayer(nextDeck.slice(0, 2));
    setDealer(nextDeck.slice(2, 4));
    setCursor(4);
    setSettled(false);
  }

  function finish(finalPlayer: Card[], startingDealer = dealer, startCursor = cursor) {
    if (settled) return;
    let dealerHand = [...startingDealer];
    let nextCursor = startCursor;
    while (handValue(dealerHand) < 17 && nextCursor < deck.length) {
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

    if (blackjack) {
      setMessage("BLACKJACK // TABLE LIGHTS UP_");
      showFeedback({ title: "BLACKJACK!", detail: "NATURAL 21", delta: 18, tone: "great" }, 2100);
    } else if (win) {
      setMessage(`PLAYER WINS // ${pv} TO ${dv}_`);
      showFeedback({ title: "YOU WIN", detail: `${pv} BEATS ${dv}`, delta: 10, tone: "great" }, 1950);
    } else if (push) {
      setMessage(`PUSH // ${pv} EACH_`);
      showFeedback({ title: "PUSH", detail: `${pv} // STANDOFF`, delta: 3, tone: "neutral" }, 1800);
    } else if (pv > 21) {
      setMessage(`BUST // ${pv}_`);
      showFeedback({ title: "BUST", detail: `${pv} // HOUSE WINS`, tone: "bad" }, 1950);
    } else {
      setMessage(`DEALER WINS // ${dv} TO ${pv}_`);
      showFeedback({ title: "DEALER WINS", detail: `${dv} BEATS ${pv}`, tone: "bad" }, 1950);
    }
  }

  function hit() {
    if (settled || dealing || storyReady || cursor >= deck.length) return;
    const card = deck[cursor];
    const next = [...player, card];
    setPlayer(next);
    setCursor(cursor + 1);
    setMessage(`HIT // ${card.rank}${card.suit} DEALT_`);
    if (handValue(next) >= 21) {
      setDealing(true);
      window.setTimeout(() => finish(next, dealer, cursor + 1), 420);
    }
  }

  return (
    <div className="intermission-game card-cabinet blackjack-game">
      <header className="intermission-game-instructions">
        <strong>BLACKJACK // HAND {handNo}</strong>
        <span>CARDS DEAL FROM THE SHOE // BEAT THE DEALER WITHOUT GOING OVER 21</span>
      </header>

      <div className="blackjack-table card-table">
        <div className="blackjack-shoe" aria-hidden="true"><span>DECK</span><b>▦</b><small>{Math.max(0, deck.length - cursor)}</small></div>
        <div>
          <span className="eyebrow">DEALER // {settled ? dealerValue : "?"}</span>
          <div className="playing-card-row">
            {dealer.map((card, index) => (
              <b
                key={`${handNo}:dealer:${index}:${card.rank}${card.suit}`}
                className={`playing-card is-dealt ${suitClass(card)} ${!settled && index === 1 ? "is-card-back" : ""}`}
                style={dealStyle(index * 2 + 1)}
              >
                {!settled && index === 1 ? "TOT" : `${card.rank}${card.suit}`}
              </b>
            ))}
          </div>
        </div>
        <div>
          <span className="eyebrow">YOU // {playerValue}</span>
          <div className="playing-card-row">
            {player.map((card, index) => (
              <b
                key={`${handNo}:player:${index}:${card.rank}${card.suit}`}
                className={`playing-card is-dealt ${suitClass(card)}`}
                style={dealStyle(index < 2 ? index * 2 : 4 + index)}
              >
                {card.rank}{card.suit}
              </b>
            ))}
          </div>
        </div>
      </div>

      <div className="arcade-choice-row">
        {settled ? (
          <button className="button primary" type="button" onClick={resetHand} disabled={storyReady}>DEAL NEXT HAND</button>
        ) : (
          <>
            <button className="button" type="button" onClick={hit} disabled={dealing || storyReady}>HIT</button>
            <button className="button primary" type="button" onClick={() => finish(player)} disabled={dealing || storyReady}>STAND</button>
          </>
        )}
      </div>

      <footer className="intermission-game-message"><span>{message}</span><strong>SCORE {score}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
