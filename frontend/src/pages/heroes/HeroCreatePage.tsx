import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  createCharacter,
  getCreationRules,
  type CreationRules,
} from "../../services/characters";

function initialValues(
  definitions: Array<{ id: string }>,
  minimum: number,
) {
  return Object.fromEntries(
    definitions.map((definition) => [definition.id, minimum]),
  );
}

export function HeroCreatePage() {
  const navigate = useNavigate();

  const [rules, setRules] = useState<CreationRules | null>(null);
  const [name, setName] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({});
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    getCreationRules()
      .then((value) => {
        setRules(value);
        setStats(initialValues(value.stats, value.stat_min));
        setSkills(initialValues(value.skills, value.skill_min));
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Character creation rules are unavailable.",
        );
      });
  }, []);

  const statUsed = useMemo(
    () => Object.values(stats).reduce((total, value) => total + value, 0),
    [stats],
  );

  const skillUsed = useMemo(
    () => Object.values(skills).reduce((total, value) => total + value, 0),
    [skills],
  );

  function nudge(
    kind: "stat" | "skill",
    id: string,
    amount: number,
  ) {
    if (!rules) return;

    const values = kind === "stat" ? stats : skills;
    const setValues = kind === "stat" ? setStats : setSkills;

    const minimum = kind === "stat" ? rules.stat_min : rules.skill_min;
    const maximum = kind === "stat" ? rules.stat_max : rules.skill_max;
    const budget = kind === "stat"
      ? rules.stat_point_budget
      : rules.skill_point_budget;
    const used = kind === "stat" ? statUsed : skillUsed;

    const current = values[id] ?? minimum;
    const next = current + amount;

    if (next < minimum || next > maximum) return;
    if (amount > 0 && used >= budget) return;

    setValues({
      ...values,
      [id]: next,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!rules) return;

    if (statUsed !== rules.stat_point_budget) {
      setError(`Spend exactly ${rules.stat_point_budget} stat points.`);
      return;
    }

    if (skillUsed !== rules.skill_point_budget) {
      setError(`Spend exactly ${rules.skill_point_budget} skill points.`);
      return;
    }

    setWorking(true);
    setError("");

    try {
      const hero = await createCharacter(name.trim(), stats, skills);
      navigate(`/game/heroes/${encodeURIComponent(hero.character_id)}`, {
        replace: true,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Hero creation failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="CHARACTER CREATION"
        title="WHO IS MAKING THESE DECISIONS?"
      />

      <form className="hero-create-layout" onSubmit={submit}>
        <Panel title="IDENTITY">
          <label className="field-label">
            <span>HERO NAME</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={40}
              placeholder="Someone with questionable judgment"
            />
          </label>

          <p className="muted-copy">
            This Hero can walk into fantasy, horror, office politics, alien ruins,
            a grocery store at 2 AM, or whatever else the story machine produces.
          </p>
        </Panel>

        <Panel title={`CORE STATS // ${statUsed}/${rules?.stat_point_budget ?? "—"}`}>
          <div className="allocation-grid">
            {rules?.stats.map((stat) => (
              <div className="allocation-row" key={stat.id}>
                <span>{stat.label}</span>
                <div>
                  <button
                    type="button"
                    onClick={() => nudge("stat", stat.id, -1)}
                  >
                    −
                  </button>
                  <strong>{stats[stat.id] ?? rules.stat_min}</strong>
                  <button
                    type="button"
                    onClick={() => nudge("stat", stat.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={`SKILLS // ${skillUsed}/${rules?.skill_point_budget ?? "—"}`}>
          <div className="allocation-grid allocation-grid-wide">
            {rules?.skills.map((skill) => (
              <div className="allocation-row" key={skill.id}>
                <span>
                  {skill.label}
                  <small>{skill.stat.toUpperCase()}</small>
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => nudge("skill", skill.id, -1)}
                  >
                    −
                  </button>
                  <strong>{skills[skill.id] ?? rules.skill_min}</strong>
                  <button
                    type="button"
                    onClick={() => nudge("skill", skill.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="hero-create-submit">
          {error ? <div className="form-error">{error}</div> : null}
          <button
            className="button button-primary"
            type="submit"
            disabled={
              working ||
              !rules ||
              name.trim().length < 2 ||
              statUsed !== rules.stat_point_budget ||
              skillUsed !== rules.skill_point_budget
            }
          >
            {working ? "ADDING THEM TO THE RECORD_" : "COMMIT THIS PERSON TO HISTORY"}
          </button>
        </div>
      </form>
    </>
  );
}
