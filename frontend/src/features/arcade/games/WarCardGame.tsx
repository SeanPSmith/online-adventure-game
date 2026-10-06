import { useEffect, useMemo, useRef, useState } from "react";
import type { ArcadeGameProps } from "../arcadeTypes";
import { ArcadeFeedback, useArcadeFeedback } from "../engine/ArcadeFeedback";
import { seededShuffle } from "../engine/seeded";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["♠", "♥", "♦", "♣"];
type Card = { rank: string; suit: string; value: number; id: string };
type BattleResult = {
  mine: Card;
  theirs: Card;
  playerDeck: Card[];
  enemyDeck: Card[];
  pot: Card[];
  warDepth: number;
  winner: "player" | "enemy";
};

function buildDeck(seed: number) {
  return seededShuffle(
    SUITS.flatMap((suit) => RANKS.map((rank, value) => ({ rank, suit, value: value + 2, id: `${rank}${suit}` }))),
    seed,
  );
}

function splitDeck(seed: number) {
  const cards = buildDeck(seed);
  return { player: cards.slice(0, 26), enemy: cards.slice(26) };
}

function suitClass(card: Card | null) {
  if (!card) return "";
  return card.suit === "♥" || card.suit === "♦" ? "is-red-suit" : "";
}

function resolveBattle(playerSource: Card[], enemySource: Card[]): BattleResult | null {
  const player = [...playerSource];
  const enemy = [...enemySource];
  const pot: Card[] = [];
  let warDepth = 0;
  let mine = player.shift();
  let theirs = enemy.shift();
  if (!mine || !theirs) return null;
  pot.push(mine, theirs);

  while (mine.value === theirs.value && player.length && enemy.length) {
    warDepth += 1;
    const downCount = Math.min(3, Math.max(0, Math.min(player.length, enemy.length) - 1));
    for (let index = 0; index < downCount; index += 1) {
      const mineDown = player.shift();
      const theirDown = enemy.shift();
      if (mineDown) pot.push(mineDown);
      if (theirDown) pot.push(theirDown);
    }
    mine = player.shift() ?? mine;
    theirs = enemy.shift() ?? theirs;
    pot.push(mine, theirs);
    if (!player.length && !enemy.length && mine.value === theirs.value) break;
  }

  const winner: "player" | "enemy" = mine.value >= theirs.value ? "player" : "enemy";
  const shuffledPot = seededShuffle(pot, pot.length * 131 + mine.value * 17 + theirs.value * 7);
  if (winner === "player") player.push(...shuffledPot);
  else enemy.push(...shuffledPot);

  return { mine, theirs, playerDeck: player, enemyDeck: enemy, pot, warDepth, winner };
}

export function WarCardGame({ score, onScoreChange, turnNumber, storyReady }: ArcadeGameProps) {
  const initial = useMemo(() => splitDeck(turnNumber * 719 + 41), [turnNumber]);
  const [playerDeck, setPlayerDeck] = useState<Card[]>(initial.player);
  const [enemyDeck, setEnemyDeck] = useState<Card[]>(initial.enemy);
  const [playerCard, setPlayerCard] = useState<Card | null>(null);
  const [enemyCard, setEnemyCard] = useState<Card | null>(null);
  const [message, setMessage] = useState("DRAW // HIGH CARD TAKES THE BATTLE_");
  const [warDepth, setWarDepth] = useState(0);
  const [potSize, setPotSize] = useState(0);
  const [battleNo, setBattleNo] = useState(1);
  const [locked, setLocked] = useState(false);
  const [dealPulse, setDealPulse] = useState(0);
  const resolveTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const { feedback, showFeedback } = useArcadeFeedback(1750);

  useEffect(() => () => {
    if (resolveTimer.current !== null) window.clearTimeout(resolveTimer.current);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  function resetGame() {
    const next = splitDeck(turnNumber * 719 + battleNo * 193 + 97);
    setPlayerDeck(next.player);
    setEnemyDeck(next.enemy);
    setPlayerCard(null);
    setEnemyCard(null);
    setWarDepth(0);
    setPotSize(0);
    setLocked(false);
    setBattleNo(1);
    setMessage("NEW DECKS // DRAW WHEN READY_");
  }

  function draw() {
    if (locked || storyReady) return;
    if (!playerDeck.length || !enemyDeck.length) {
      resetGame();
      return;
    }

    const result = resolveBattle(playerDeck, enemyDeck);
    if (!result) return;

    setLocked(true);
    setPlayerCard(null);
    setEnemyCard(null);
    setWarDepth(result.warDepth);
    setPotSize(result.pot.length);
    setDealPulse((value) => value + 1);
    setMessage(result.warDepth ? `WAR! // ${result.pot.length} CARDS IN THE POT_` : "CARDS FLYING TO CENTER_");

    resolveTimer.current = window.setTimeout(() => {
      setPlayerCard(result.mine);
      setEnemyCard(result.theirs);
      setPlayerDeck(result.playerDeck);
      setEnemyDeck(result.enemyDeck);

      const playerOut = result.playerDeck.length === 0;
      const enemyOut = result.enemyDeck.length === 0;
      const wonGame = enemyOut && !playerOut;
      const lostGame = playerOut && !enemyOut;

      if (result.winner === "player") {
        const battleAward = 4 + result.warDepth * 8;
        const award = battleAward + (wonGame ? 30 : 0);
        onScoreChange(Math.min(999, score + award));
        setMessage(wonGame ? "DECK CONQUERED // YOU WIN THE GAME_" : `${result.warDepth ? "WAR WON" : "BATTLE WON"} // TAKE ${result.pot.length} CARDS // +${battleAward}_`);
        showFeedback({
          title: wonGame ? "GAME WON!" : result.warDepth ? "YOU WIN THE WAR!" : "YOU WIN",
          detail: wonGame ? "THE HOUSE HAS NO CARDS LEFT" : `${result.mine.rank}${result.mine.suit} BEATS ${result.theirs.rank}${result.theirs.suit} // +${result.pot.length} CARDS`,
          delta: award,
          tone: result.warDepth || wonGame ? "great" : "good",
        }, wonGame ? 2600 : result.warDepth ? 2200 : 1650);
      } else {
        setMessage(lostGame ? "YOUR DECK IS GONE // HOUSE WINS THE GAME_" : `${result.warDepth ? "WAR LOST" : "BATTLE LOST"} // HOUSE TAKES ${result.pot.length}_`);
        showFeedback({
          title: lostGame ? "GAME LOST" : result.warDepth ? "WAR LOST" : "HOUSE WINS",
          detail: lostGame ? "YOUR DECK HAS BEEN CAPTURED" : `${result.theirs.rank}${result.theirs.suit} BEATS ${result.mine.rank}${result.mine.suit} // -${result.pot.length} CARDS`,
          tone: "bad",
        }, lostGame ? 2600 : result.warDepth ? 2200 : 1650);
      }

      if (playerOut || enemyOut) {
        resetTimer.current = window.setTimeout(resetGame, 3000);
      } else {
        resetTimer.current = window.setTimeout(() => {
          setLocked(false);
          setBattleNo((value) => value + 1);
          setMessage("DRAW THE NEXT CARD_");
        }, result.warDepth ? 2300 : 1750);
      }
    }, result.warDepth ? 720 : 420);
  }

  return (
    <div className="intermission-game card-cabinet war-card-game">
      <header className="intermission-game-instructions">
        <strong>WAR // BATTLE {battleNo}</strong>
        <span>YOUR FACE-DOWN DECK IS REAL // DRAW THE TOP CARD // TIES ESCALATE INTO WAR</span>
      </header>

      <div className={`war-table-v2 ${warDepth ? "is-war" : ""}`}>
        <div className="war-player-zone">
          <span className="eyebrow">YOU // {playerDeck.length} CARDS</span>
          <div className="war-deck-stack" aria-label={`${playerDeck.length} cards remaining`}><i /><i /><b>TOT</b><small>x{playerDeck.length}</small></div>
          <b key={`p:${dealPulse}:${playerCard?.id ?? "back"}`} className={`playing-card is-large war-battle-card ${playerCard ? "is-revealed" : "is-card-back"} ${suitClass(playerCard)}`}>{playerCard ? `${playerCard.rank}${playerCard.suit}` : "TOT"}</b>
        </div>

        <div className="war-center-pile">
          <strong>{warDepth ? "WAR!" : "VS"}</strong>
          {warDepth ? <div className="war-face-down-row" aria-label={`${potSize} cards in war pot`}><span>▥</span><span>▥</span><span>▥</span><b>{potSize} CARD POT</b></div> : <span>HIGH CARD WINS</span>}
        </div>

        <div className="war-player-zone">
          <span className="eyebrow">HOUSE // {enemyDeck.length} CARDS</span>
          <div className="war-deck-stack" aria-label={`${enemyDeck.length} cards remaining`}><i /><i /><b>TOT</b><small>x{enemyDeck.length}</small></div>
          <b key={`e:${dealPulse}:${enemyCard?.id ?? "back"}`} className={`playing-card is-large war-battle-card is-enemy ${enemyCard ? "is-revealed" : "is-card-back"} ${suitClass(enemyCard)}`}>{enemyCard ? `${enemyCard.rank}${enemyCard.suit}` : "TOT"}</b>
        </div>
      </div>

      <button className="button primary" type="button" onClick={draw} disabled={locked || storyReady}>{locked ? (warDepth ? "WAR IN PROGRESS..." : "RESOLVING...") : "DRAW TOP CARDS"}</button>
      <footer className="intermission-game-message"><span>{message}</span><strong>{warDepth ? `WAR ×${warDepth}` : `SCORE ${score}`}</strong></footer>
      <ArcadeFeedback feedback={feedback} />
    </div>
  );
}
