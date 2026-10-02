import type { SceneChoice } from "../../services/game";

function listOrFallback(items: string[], fallback: string) {
  if (!items.length) {
    return <span className="choice-inspector-empty">{fallback}</span>;
  }

  return (
    <ul>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export function ChoiceInspector({ choice }: { choice: SceneChoice }) {
  const checkLabel = choice.check
    ? `${(choice.check.skill ?? choice.check.stat ?? "CHECK").replaceAll("_", " ").toUpperCase()} // ${choice.check.challenge_tier ? `${choice.check.challenge_tier.toUpperCase()} // ` : ""}DC ${choice.check.difficulty}`
    : "NONE";

  return (
    <div className="choice-inspector">
      <p className="choice-inspector-summary">
        {choice.description || choice.label}
      </p>

      <div className="choice-inspector-grid">
        <div><span>RISK</span><strong>{choice.risk_level.toUpperCase()}</strong></div>
        <div><span>REWARD</span><strong>{choice.reward_level.toUpperCase()}</strong></div>
        <div><span>APPROACH</span><strong>{choice.archetype.toUpperCase()}</strong></div>
        <div><span>IMPACT</span><strong>{choice.impact_level.replaceAll("_", " ").toUpperCase()}</strong></div>
        <div><span>CHECK</span><strong>{checkLabel}</strong></div>
        <div><span>XP</span><strong>+{choice.xp_reward}</strong></div>
        <div><span>TONE</span><strong>{choice.tone.toUpperCase()}</strong></div>
        <div><span>ODDS</span><strong>SERVER RESOLVED</strong></div>
      </div>

      <div className="choice-inspector-columns">
        <section>
          <h4>POSSIBLE GAINS</h4>
          {listOrFallback(choice.possible_gains, "Unknown until chosen.")}
        </section>

        <section>
          <h4>POSSIBLE COSTS</h4>
          {listOrFallback(choice.possible_costs, "Unknown until chosen.")}
        </section>
      </div>

      <p className="choice-inspector-note">
        OUTCOMES ARE POSSIBILITIES, NOT PROMISES. THE SERVER STILL ANSWERS TO THE DICE.
      </p>
    </div>
  );
}
