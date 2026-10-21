import { useEffect, useRef } from "react";
import type { InkPaper } from "../appearance/inkboundPaper";
import type { HeroProgressionUpdate } from "../../services/game";
import "./inkboundLevelUpPass664.css";

interface LevelUpModalProps {
  heroName: string;
  update: HeroProgressionUpdate;
  onContinue: () => void;
  inkPaper?: InkPaper;
}

/**
 * The server owns leveling, HP, XP, and effects. The folio only reads its
 * progression receipt. Attribute/perk rewards are never inferred from a level.
 */
export function LevelUpModal({ heroName, update, onContinue, inkPaper }: LevelUpModalProps) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    continueRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onContinueRef.current();
      }
      // The modal is blocking: keep keyboard focus inside it.
      if (event.key === "Tab") {
        const buttons = [continueRef.current].filter((item): item is HTMLButtonElement => Boolean(item));
        if (buttons.length) {
          event.preventDefault();
          buttons[0].focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, []);

  // The original terminal celebration must remain available in Classic View.
  if (!inkPaper) {
    return (
      <div className="level-up-backdrop" role="dialog" aria-modal="true" aria-labelledby="level-up-title">
        <section className="level-up-modal">
          <span className="level-up-kicker">HERO ADVANCEMENT // CONGRATULATIONS</span>
          <pre className="level-up-ascii" aria-hidden="true">{String.raw`  /\_/\
 ( o.o )   LEVEL UP!
  > ^ <`}</pre>
          <h2 id="level-up-title">{heroName.toUpperCase()} REACHED LEVEL {update.level_after}</h2>
          <div className="level-up-jump"><span>LEVEL {update.level_before}</span><strong>→</strong><span>LEVEL {update.level_after}</span></div>
          <p>+{update.xp_gained} XP pushed your Hero across the threshold. The new level is already active for checks, scaling, and maximum-health progression.</p>
          <div className="level-up-stats">
            <div><span>CURRENT XP</span><strong>{update.experience}</strong></div>
            <div><span>MAX HP</span><strong>{update.max_health}</strong></div>
            <div><span>NEXT LEVEL</span><strong>{update.xp_needed_for_next_level} XP</strong></div>
          </div>
          <p className="level-up-note">Advancement points earned during the journey are banked when the Chronicle closes.</p>
          <button className="button button-primary level-up-continue" type="button" onClick={onContinue}>HELL YES // CONTINUE</button>
        </section>
      </div>
    );
  }

  const progress = Math.max(0, Math.min(100, Number(update.xp_progress_percent) || 0));
  const newEffects = (update.new_effects ?? []).filter((effect) => effect.active !== false);
  const levelCount = Math.max(1, update.levels_gained || update.level_after - update.level_before);
  return (
    <div className="level-up-backdrop ilu-backdrop" data-ink-paper={inkPaper} role="dialog" aria-modal="true" aria-labelledby="ilu-title" aria-describedby="ilu-description">
      <section className="level-up-modal ilu-sheet">
        <header className="ilu-heading">
          <span className="ilu-eyebrow">A NEW CHAPTER</span>
          <h2 id="ilu-title">Level Up</h2>
          <span className="ilu-star" aria-hidden="true">✧</span>
        </header>
        <div className="ilu-main">
          <div className="ilu-art">
            <img src="/art/inkbound/north-road-editorial.png" alt="" draggable={false} />
            <p className="ilu-art-caption">The journey leaves its mark.</p>
          </div>
          <div className="ilu-details">
            <h3>{heroName} <span>· Level {update.level_after}</span></h3>
            <p id="ilu-description" className="ilu-subline">
              {levelCount > 1 ? `${levelCount} levels earned in this chapter.` : "Another chapter written in your legend."}
            </p>
            <dl className="ilu-ledger">
              <div><dt>Level</dt><dd>{update.level_before} <span aria-hidden="true">→</span> {update.level_after}</dd></div>
              <div><dt>Experience gained</dt><dd>+{update.xp_gained} XP</dd></div>
              <div><dt>Total experience</dt><dd>{update.experience.toLocaleString()}</dd></div>
              <div><dt>Maximum health</dt><dd>{update.max_health} HP</dd></div>
              {update.health_change !== 0 ? (
                <div><dt>Health this turn</dt><dd>{update.health_change > 0 ? "+" : ""}{update.health_change} HP</dd></div>
              ) : null}
            </dl>
            {newEffects.length > 0 ? (
              <div className="ilu-effects">
                <h4>New effects</h4>
                {newEffects.map((effect, index) => (
                  <div className="ilu-effect" key={`${effect.effect_id ?? effect.name ?? "effect"}:${index}`}>
                    <strong>{effect.name || "New effect"}</strong>
                    {effect.description ? <p>{effect.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="ilu-progress">
              <div className="ilu-progress-label"><span>LEVEL {update.level_after}</span><span>{update.xp_into_level} / {update.xp_level_span} XP</span></div>
              <div className="ilu-track" role="progressbar" aria-label="Progress to next level" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>{update.xp_needed_for_next_level} XP until Level {update.level_after + 1}</p>
            </div>
          </div>
        </div>
        <footer className="ilu-footer">
          <p>There are still many roads ahead.</p>
          <button className="ilu-action" ref={continueRef} type="button" onClick={onContinue}>Continue the Journey <span aria-hidden="true">→</span></button>
        </footer>
      </section>
    </div>
  );
}
