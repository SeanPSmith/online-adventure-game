import type { HeroProgressionUpdate } from "../../services/game";

interface LevelUpModalProps {
  heroName: string;
  update: HeroProgressionUpdate;
  onContinue: () => void;
}

export function LevelUpModal({
  heroName,
  update,
  onContinue,
}: LevelUpModalProps) {
  return (
    <div
      className="level-up-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
    >
      <section className="level-up-modal">
        <span className="level-up-kicker">HERO ADVANCEMENT // CONGRATULATIONS</span>
        <pre className="level-up-ascii" aria-hidden="true">{`  /\\_/\\
 ( o.o )   LEVEL UP!
  > ^ <`}</pre>
        <h2 id="level-up-title">{heroName.toUpperCase()} REACHED LEVEL {update.level_after}</h2>
        <div className="level-up-jump">
          <span>LEVEL {update.level_before}</span>
          <strong>→</strong>
          <span>LEVEL {update.level_after}</span>
        </div>
        <p>
          +{update.xp_gained} XP pushed your Hero across the threshold. The new level is
          already active for checks, scaling, and maximum-health progression.
        </p>
        <div className="level-up-stats">
          <div>
            <span>CURRENT XP</span>
            <strong>{update.experience}</strong>
          </div>
          <div>
            <span>MAX HP</span>
            <strong>{update.max_health}</strong>
          </div>
          <div>
            <span>NEXT LEVEL</span>
            <strong>{update.xp_needed_for_next_level} XP</strong>
          </div>
        </div>
        <p className="level-up-note">
          Advancement points earned during the journey are banked when the Chronicle closes.
        </p>
        <button className="button button-primary level-up-continue" type="button" onClick={onContinue}>
          HELL YES // CONTINUE
        </button>
      </section>
    </div>
  );
}
