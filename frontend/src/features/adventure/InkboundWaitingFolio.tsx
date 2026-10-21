/** Pass 66.3 — a real manuscript waiting state, never a fabricated countdown. */
import type { InkPaper } from "../appearance/inkboundPaper";

export interface WaitingHero {
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  xpPercent: number;
}

function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function InkboundWaitingFolio({
  paper, elapsedSeconds, storyReady, readySeconds, choiceLabel, hero,
  partyCount, onSync, onRetry, retryMessage,
}: {
  paper: InkPaper;
  elapsedSeconds: number;
  storyReady: boolean;
  readySeconds: number;
  choiceLabel?: string | null;
  hero?: WaitingHero | null;
  partyCount?: number;
  onSync?: () => void;
  onRetry?: () => void;
  retryMessage?: string;
}) {
  const retry = Boolean(retryMessage);
  const ready = storyReady && !retry;
  return (
    <section className="ibw-stage" data-ink-paper={paper} aria-label="Adventure intermission" role="region">
      <div className="ibw-page">
        <header className="ibw-masthead">
          <span className="ibw-wordmark">QUILLAIRO</span>
          <span className="ibw-mast-rule" aria-hidden="true" />
          <span className="ibw-mast-label">The living chronicle</span>
        </header>
        <img className="ibw-side-art ibw-side-art-left" src="/art/inkbound/signpost.png" alt="" aria-hidden="true" />
        <img className="ibw-side-art ibw-side-art-right" src="/art/inkbound/lantern-books.png" alt="" aria-hidden="true" />
        <main className="ibw-main">
          <p className="ibw-kicker"><span aria-hidden="true" />INTERMISSION<span aria-hidden="true" /></p>
          <h1>{retry ? "A pause in the telling" : ready ? "The next page awaits" : "The story continues"}</h1>
          <div className="ibw-ornament" aria-hidden="true"><span />✧<span /></div>
          <div className="ibw-clock" role="timer" aria-live="off" aria-label={ready ? `${Math.max(0, readySeconds)} seconds until the result` : `${clock(elapsedSeconds)} elapsed while writing`}>
            {ready ? clock(Math.max(0, readySeconds)) : clock(elapsedSeconds)}
          </div>
          <div className="ibw-time-caption">{ready ? "STORY READY · COUNTING DOWN" : "TIME WRITING · NOT AN ESTIMATED ARRIVAL"}</div>
          <p className="ibw-explanation" role="status" aria-live="polite">{retry
            ? retryMessage
            : ready
              ? "The next passage is written. Your result is about to be revealed."
              : "The Director is writing the next passage…"}</p>
          {!retry && <p className="ibw-subtext">{ready ? "The Arcade will close before the consequences are shown." : "Your decision is sealed. The chapter will appear when it is ready."}</p>}
          <ol className="ibw-progress" aria-label="Adventure progress">
            <li className="is-done"><i aria-hidden="true" />Choice locked</li>
            <li className={ready ? "is-done" : "is-current"}><i aria-hidden="true" />Writing the passage</li>
            <li className={ready ? "is-current" : ""}><i aria-hidden="true" />Revealing the result</li>
          </ol>
          {choiceLabel ? (
            <section className="ibw-choice" aria-label="Your recent choice">
              <div className="ibw-choice-caption"><span />YOUR RECENT CHOICE<span /></div>
              <div className="ibw-choice-line">
                <img src="/art/inkbound/signpost.png" alt="" aria-hidden="true" />
                <div><strong>{choiceLabel}</strong><p>{ready ? "The chapter is ready. Your result follows the countdown." : "Recorded for this turn. The consequences are being written."}</p></div>
              </div>
            </section>
          ) : null}
          {(onRetry || onSync) && <div className="ibw-actions">
            {onRetry ? <button type="button" onClick={onRetry}>Retry story generation →</button> : null}
            {onSync ? <button type="button" onClick={onSync}>Re-sync the room →</button> : null}
          </div>}
        </main>
        <footer className="ibw-status-footer">
          {hero ? <div className="ibw-hero"><span aria-hidden="true">✧</span><div><strong>{hero.name}</strong><small>Level {hero.level}</small></div></div> : <span className="ibw-footer-caption">The chronicle continues</span>}
          {hero ? <div className="ibw-resource"><span>HP</span><div className="ibw-meter"><span style={{ width: `${Math.min(100, Math.max(0, 100 * hero.health / Math.max(1, hero.maxHealth)))}%` }}/></div><strong>{hero.health} / {hero.maxHealth}</strong></div> : null}
          {hero ? <div className="ibw-resource"><span>XP</span><div className="ibw-meter"><span style={{ width: `${Math.min(100, Math.max(0, hero.xpPercent))}%` }}/></div></div> : null}
          {partyCount ? <span className="ibw-party">Party · {partyCount}</span> : null}
        </footer>
      </div>
    </section>
  );
}
