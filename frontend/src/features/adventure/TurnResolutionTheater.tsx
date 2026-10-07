import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  HeroProgressionUpdate,
  TurnResolvedPayload,
  TurnResult,
} from "../../services/game";

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export function buildAsciiD20(number: number | string) {
  const padded = String(number).padStart(2, " ");

  return String.raw`          /\
         /  \
        / /\ \
       / /  \ \
      / / ${padded} \ \
     / /      \ \
    /__________\
     \        /
      \______/
`;
}

function CheckBreakdown({ result, rolling }: { result: TurnResult; rolling: boolean }) {
  const check = result.check;
  if (!check) return null;

  const rows: Array<[string, string]> = [
    ["D20", rolling ? "..." : String(check.roll)],
    [titleCase(check.stat), signed(check.stat_value)],
  ];

  if (check.skill) rows.push([titleCase(check.skill), signed(check.skill_value)]);
  if (check.equipment_modifier) rows.push(["Equipment", signed(check.equipment_modifier)]);
  if (check.situation_modifier) rows.push(["Situation", signed(check.situation_modifier)]);
  if (check.performance_modifier) rows.push(["Performance", signed(check.performance_modifier)]);
  if (check.effect_modifier) {
    const effectName = check.effect_details.length === 1
      ? String(check.effect_details[0]?.name ?? "Status FX")
      : "Status FX";
    rows.push([effectName, signed(check.effect_modifier)]);
  }
  if (check.talent_modifier) {
    const talentName = check.talent_details.length === 1
      ? String(check.talent_details[0]?.label ?? "Talent")
      : "Talents";
    rows.push([talentName, signed(check.talent_modifier)]);
  }

  rows.push(["TOTAL", rolling ? "..." : String(check.total)]);

  return (
    <div className="theater-breakdown">
      {rows.map(([label, value], index) => (
        <div className={index === rows.length - 1 ? "is-total" : ""} key={`${label}:${index}`}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function AnimatedResultCard({
  result,
  active,
  complete,
  onDone,
}: {
  result: TurnResult;
  active: boolean;
  complete: boolean;
  onDone: () => void;
}) {
  const [rolling, setRolling] = useState(active && Boolean(result.check));
  const [displayRoll, setDisplayRoll] = useState<number | string>(result.check ? "?" : "—");
  const [settled, setSettled] = useState(complete);

  useEffect(() => {
    setSettled(complete);
    setRolling(active && Boolean(result.check));
    setDisplayRoll(result.check ? (complete ? result.check.roll : "?") : "—");
  }, [result, complete, active]);

  useEffect(() => {
    if (!active || complete) return;

    if (!result.check) {
      setSettled(true);
      const timer = setTimeout(onDone, 450);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    let frame = 0;
    let frameTimer: ReturnType<typeof setTimeout> | null = null;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;

    const nextFrame = () => {
      if (cancelled) return;

      if (frame >= 14) {
        setDisplayRoll(result.check?.roll ?? "?");
        setRolling(false);
        setSettled(true);
        finishTimer = setTimeout(onDone, result.check?.critical ? 900 : 600);
        return;
      }

      setDisplayRoll(Math.floor(Math.random() * 20) + 1);
      const delay = 45 + frame * 8;
      frame += 1;
      frameTimer = setTimeout(nextFrame, delay);
    };

    nextFrame();

    return () => {
      cancelled = true;
      if (frameTimer) clearTimeout(frameTimer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [active, complete, result, onDone]);

  const outcomeClass = result.check?.outcome.replaceAll("_", "-") ?? "no-check";

  return (
    <article className={`theater-result-card ${active ? "is-active" : ""} ${settled ? "is-settled" : ""}`}>
      <header>
        <div>
          <span className="eyebrow">{result.player_name}</span>
          <strong>{result.choice_label}</strong>
        </div>
        <span>{result.check ? `${result.check.challenge_tier ? `${titleCase(result.check.challenge_tier).toUpperCase()} // ` : ""}DC ${result.check.difficulty}` : "NO CHECK"}</span>
      </header>

      {result.check ? (
        <div className="theater-dice-stage">
          <pre className={`theater-d20 ${rolling ? "is-rolling" : ""}`}>
            {buildAsciiD20(displayRoll)}
          </pre>
          <CheckBreakdown result={result} rolling={!settled} />
        </div>
      ) : (
        <div className="theater-no-check">
          NO CHECK REQUIRED // SOMETIMES YOU JUST DO THE THING.
        </div>
      )}

      {settled ? (
        <div className={`theater-outcome ${outcomeClass}`}>
          {result.check ? titleCase(result.check.outcome).toUpperCase() : "ACTION COMMITTED"}
        </div>
      ) : null}
    </article>
  );
}

function ProgressionSummary({ update }: { update: HeroProgressionUpdate }) {
  return (
    <article className="theater-progression-card">
      <div className="eyebrow">HERO CONSEQUENCES</div>
      <div className="theater-progression-line">
        <span>XP</span>
        <strong>+{update.xp_gained}</strong>
      </div>

      {update.health_change !== 0 ? (
        <div className={`theater-progression-line ${update.health_change < 0 ? "is-damage" : "is-heal"}`}>
          <span>HP</span>
          <strong>{signed(update.health_change)} // {update.health_after}/{update.max_health}</strong>
        </div>
      ) : null}

      {update.leveled_up ? (
        <div className="theater-progression-line is-level">
          <span>LEVEL</span>
          <strong>{update.level_before} → {update.level_after}</strong>
        </div>
      ) : null}

      {update.new_effects.map((effect, index) => (
        <div className="theater-effect-gained" key={String(effect.effect_id ?? effect.source_key ?? index)}>
          <strong>+ {String(effect.name ?? "NEW EFFECT").toUpperCase()}</strong>
          <span>{String(effect.description ?? "")}</span>
        </div>
      ))}

      {update.expired_effects.map((effect, index) => (
        <div className="theater-effect-expired" key={String(effect.effect_id ?? effect.source_key ?? index)}>
          <strong>EXPIRED // {String(effect.name ?? "EFFECT").toUpperCase()}</strong>
        </div>
      ))}

      {update.died_this_turn ? (
        <div className="theater-fallen">
          THE HERO HAS FALLEN.
        </div>
      ) : null}
    </article>
  );
}

export function TurnResolutionTheater({
  receipt,
  onContinue,
}: {
  receipt: TurnResolvedPayload;
  onContinue: () => void;
}) {
  const results = useMemo(() => receipt.results ?? [], [receipt]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [finished, setFinished] = useState(results.length === 0);

  useEffect(() => {
    setActiveIndex(0);
    setFinished(results.length === 0);
  }, [receipt, results.length]);

  const currentResult = results[activeIndex] ?? null;
  const criticalNow = Boolean(currentResult?.check?.critical && !finished);

  const finishCurrent = useCallback(() => {
    setActiveIndex((current) => {
      if (current >= results.length - 1) {
        setFinished(true);
        return current;
      }

      return current + 1;
    });
  }, [results.length]);

  const progression = receipt.hero_progression
    ? Object.values(receipt.hero_progression)
    : [];

  return (
    <div className={`turn-resolution-theater ${criticalNow ? "is-critical-pulse" : ""}`}>
      <header className="theater-heading">
        <div>
          <span className="eyebrow">AUTHORITATIVE TURN RECEIPT</span>
          <h2>LET'S SEE HOW THAT WENT.</h2>
        </div>
        <span>{receipt.preliminary ? "RESULTS READY // STORY WRITING" : "SERVER RESOLVED"}</span>
      </header>

      <div className="theater-results">
        {results.map((result, index) => {
          if (index > activeIndex) return null;

          return (
            <AnimatedResultCard
              result={result}
              active={index === activeIndex && !finished}
              complete={index < activeIndex || finished}
              onDone={finishCurrent}
              key={`${result.player_id}:${result.choice_id}`}
            />
          );
        })}
      </div>

      {finished ? (
        <div className="theater-finale-stage">
          {receipt.resolution ? (
            <section className="theater-resolution-copy">
              <span className="eyebrow">WHAT ACTUALLY HAPPENED</span>
              <p>{receipt.resolution}</p>
            </section>
          ) : null}

          {progression.length > 0 ? (
            <section className="theater-progression-grid">
              {progression.map((update) => (
                <ProgressionSummary update={update} key={update.character_id} />
              ))}
            </section>
          ) : null}

          <button className="button button-primary theater-continue" type="button" onClick={onContinue}>
            {receipt.completed ? "SEE HOW THIS ENDS" : "CONTINUE THE CHRONICLE"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
