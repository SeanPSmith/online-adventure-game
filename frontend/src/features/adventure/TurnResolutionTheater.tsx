import { useCallback, useEffect, useState } from "react";
import { receiptKey } from "./turnFlow";
import { cosmeticD20Face } from "./diceAnimation";
import { playSound } from "../../services/audioDirector";
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

/** An ink drawing, not a bitmap or a reroll: the displayed face is cosmetic until the authoritative result settles. */
function InkboundDiceFace({ number, rolling }: { number: number | string; rolling: boolean }) {
  return (
    <svg className={`inkbound-dice-illustration ${rolling ? "is-rolling" : ""}`}
      viewBox="0 0 260 258" xmlns="http://www.w3.org/2000/svg"
      role="img" aria-label={rolling ? "Dice rolling" : `D20 rolled ${number}`}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="2.15" d="M129 17 230 79 231 178 130 239 27 179 28 79Z" />
        <path strokeWidth="1.3" d="M129 17 131 57 28 79 78 130 27 179 130 239 181 131 231 178 230 79 131 57 181 131 78 130 131 57" />
        <path strokeWidth="1.15" d="M129 17 78 130 130 239 181 131 129 17 M28 79 230 79 M27 179 231 178" opacity=".54" />
        <path strokeWidth=".65" opacity=".30" d="M34 81 79 126 126 59 M180 137 224 175 133 234 M132 24 225 81 M33 177 80 133" />
        <path strokeWidth=".75" opacity=".45" d="M20 58 17 48 M237 59 244 50 M241 195 249 204 M24 200 15 212 M129 3v8 M128 246v10" />
      </g>
      <text x="130" y="150" textAnchor="middle" fill="currentColor" className="inkbound-dice-number">{number}</text>
    </svg>
  );
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
  soundId,
  inkbound,
}: {
  result: TurnResult;
  active: boolean;
  complete: boolean;
  onDone: () => void;
  soundId: string;
  inkbound: boolean;
}) {
  const [rolling, setRolling] = useState(active && Boolean(result.check));
  const [displayRoll, setDisplayRoll] = useState<number | string>(active && !complete ? "—" : result.check ? result.check.roll : "—");
  const [settled, setSettled] = useState(complete);

  useEffect(() => {
    setSettled(complete);
    setRolling(active && Boolean(result.check));
    setDisplayRoll(result.check ? result.check.roll : "—");
  }, [result.check?.roll, result.check?.total, complete, active]);

  useEffect(() => {
    if (!active || complete) return;
    // Capture the check once: it is nullable on TurnResult, and React's
    // delayed callbacks must use the same committed check that began the roll.
    const check = result.check;
    if (check) playSound("dice-roll", `${soundId}:rolling`);

    if (!check) {
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
        setDisplayRoll(check.roll);
        setRolling(false);
        setSettled(true);
        const outcome = check.outcome ?? "";
        const cue = outcome.includes("critical_failure") ? "critical-fail"
          : outcome.includes("critical_success") ? "critical"
          : outcome.includes("failure") ? "failure" : "success";
        playSound(cue, `${soundId}:settled`);
        finishTimer = setTimeout(onDone, check.critical ? 900 : 600);
        return;
      }

      // The intermediate faces are purely visual. The ONLY outcome used for
      // gameplay is the server-committed check, revealed on the final frame.
      // Uniform 1-20 animation, never another server roll or a '?' placeholder.
      setDisplayRoll(cosmeticD20Face());
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
  }, [active, complete, result.check?.roll, result.check?.total, result.check?.critical, result.check?.outcome, soundId, onDone]);

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
          {inkbound ? (
            <InkboundDiceFace number={displayRoll} rolling={rolling} />
          ) : (
            <pre className={`theater-d20 ${rolling ? "is-rolling" : ""}`}>
              {buildAsciiD20(displayRoll)}
            </pre>
          )}
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
        <span>XP EARNED</span>
        <strong>+{update.xp_gained}</strong>
      </div>
      {update.xp_breakdown && Object.keys(update.xp_breakdown).length > 0 ? (
        <div className="theater-reward-ledger">
          <span>RISK: {String(update.xp_breakdown.risk_level ?? "STANDARD").toUpperCase()}</span>
          <span>BASE: {String(update.xp_breakdown.base_xp ?? "—")} XP</span>
          <span>LEVEL ×{String(update.xp_breakdown.level_multiplier ?? 1)}</span>
          <span>RESULT ×{String(update.xp_breakdown.outcome_multiplier ?? 1)}</span>
          <small>Risk, Hero level and roll outcome determine the final award.</small>
        </div>
      ) : null}

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

      {(update.health_events ?? []).filter((event) => Number(event.health_delta ?? 0) !== 0).map((event, index) => (
        <div className="theater-health-reason" key={`${String(event.event_key ?? "hp")}:${index}`}>
          <strong>{Number(event.health_delta ?? 0) < 0 ? "WOUND" : "RECOVERY"}: {signed(Number(event.health_delta ?? 0))} HP</strong>
          <span>{String(event.description ?? "Story consequence")}</span>
        </div>
      ))}
      {update.died_this_turn ? (
        <div className="theater-fallen" role="alert">
          <h2>THE HERO HAS FALLEN.</h2>
          <p>Your last HP is gone. {String(update.death_record?.cause ?? "Your wounds proved mortal.")}</p>
          <strong>0 / {update.max_health} HP — YOUR JOURNEY HAS ENDED.</strong>
        </div>
      ) : null}
    </article>
  );
}

export function TurnResolutionTheater({
  receipt,
  onContinue,
  inkbound = false,
}: {
  receipt: TurnResolvedPayload;
  onContinue: () => void;
  inkbound?: boolean;
}) {
  const results = receipt.results ?? [];
  const turnIdentity = receiptKey(receipt);
  const [activeIndex, setActiveIndex] = useState(0);
  const [finished, setFinished] = useState(results.length === 0);

  useEffect(() => {
    setActiveIndex(0);
    setFinished(results.length === 0);
  }, [turnIdentity, results.length]);

  useEffect(() => {
    if (!finished) return;
    const updates = Object.values(receipt.hero_progression ?? {});
    const id = receiptKey(receipt);
    if (updates.some((update) => update.xp_gained > 0)) playSound("xp", `${id}:xp`);
    if (updates.some((update) => update.health_change < 0 && !update.died_this_turn)) {
      playSound("injury", `${id}:injury`);
    }
  }, [finished, receipt]);

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
    <div className={`turn-resolution-theater ${criticalNow ? "is-critical-pulse" : ""} ${inkbound ? "is-inkbound-manuscript" : ""}`}>
      <header className="theater-heading">
        <div>
          <span className="eyebrow">AUTHORITATIVE TURN RECEIPT</span>
          <h2>{inkbound ? "The Dice Have Spoken" : "LET'S SEE HOW THAT WENT."}</h2>
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
              soundId={`${turnIdentity}:${result.player_id}:${result.choice_id}`}
              inkbound={inkbound}
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
