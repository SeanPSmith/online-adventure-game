import type { HeroProgressionUpdate } from "../../services/game";

export function HeroDeathModal({ heroName, update, onContinue }: {
  heroName: string;
  update: HeroProgressionUpdate;
  onContinue: () => void;
}) {
  const cause = typeof update.death_record?.cause === "string"
    ? update.death_record.cause
    : "The final wound proved fatal.";
  const injuries = (update.health_events ?? []).filter(
    (event) => Number(event.health_delta ?? 0) < 0,
  );
  return (
    <div className="hero-death-backdrop" role="dialog" aria-modal="true" aria-labelledby="hero-death-title">
      <section className="hero-death-window">
        <span className="eyebrow">THE CHRONICLE // A HERO HAS FALLEN</span>
        <pre aria-hidden="true">{String.raw`     /\
    /  \
   / RIP\
   |     |
   |_____|
`}</pre>
        <h2 id="hero-death-title">{heroName.toUpperCase()} HAS FALLEN.</h2>
        <p>{cause}</p>
        <strong className="hero-death-health">0 / {update.max_health} HP</strong>
        {injuries.length > 0 ? (
          <div className="hero-death-causes">
            <span>FINAL WOUND</span>
            {injuries.map((injury, index) => (
              <p key={`${String(injury.event_key ?? "wound")}:${index}`}>
                {String(injury.description ?? "Mortal injury")}
                {" // "}{Number(injury.health_delta ?? 0)} HP
              </p>
            ))}
          </div>
        ) : null}
        <p className="muted-copy">Your fate is recorded. The Chronicle will honor it.</p>
        <button type="button" className="button button-primary" onClick={onContinue}>
          ACKNOWLEDGE THE FALL
        </button>
      </section>
    </div>
  );
}
