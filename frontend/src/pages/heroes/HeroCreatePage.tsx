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
  const [bio, setBio] = useState("");
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

  const groupedSkills = useMemo(() => {
    if (!rules) return [];
    return rules.stats.map((stat) => ({
      stat,
      skills: rules.skills.filter((skill) => skill.stat === stat.id),
    })).filter((group) => group.skills.length > 0);
  }, [rules]);

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
      setError(`Spend exactly ${rules.stat_point_budget} attribute points.`);
      return;
    }

    if (skillUsed !== rules.skill_point_budget) {
      setError(`Spend exactly ${rules.skill_point_budget} skill points.`);
      return;
    }

    setWorking(true);
    setError("");

    try {
      const hero = await createCharacter(name.trim(), bio.trim(), stats, skills);
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
        <Panel title="IDENTITY // DIRECTOR CANON">
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

          <label className="field-label hero-bio-field">
            <span>BIO // BACKGROUND, TEMPERAMENT, QUIRKS</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={800}
              rows={5}
              placeholder="A former night-shift paramedic who hates confined spaces, talks too much when nervous, and never leaves anyone behind."
            />
            <small>{bio.length}/800 // AUTHOR CANON — THE DIRECTOR MAY USE THIS IN PLAY</small>
          </label>

          <p className="muted-copy">
            Keep it useful rather than exhaustive. A few strong facts give the Director
            enough material to make choices, callbacks, NPC reactions, and story beats feel
            like they belong to this Hero.
          </p>
        </Panel>

        <Panel title={`ATTRIBUTES // ${statUsed}/${rules?.stat_point_budget ?? "—"}`}>
          <div className="allocation-grid attribute-allocation-grid">
            {rules?.stats.map((stat) => (
              <div className="allocation-row allocation-row-rich" key={stat.id}>
                <span>
                  {stat.label}
                  <small>{stat.description}</small>
                </span>
                <div>
                  <button
                    type="button"
                    aria-label={`Lower ${stat.label}`}
                    onClick={() => nudge("stat", stat.id, -1)}
                  >
                    −
                  </button>
                  <strong>{stats[stat.id] ?? rules.stat_min}</strong>
                  <button
                    type="button"
                    aria-label={`Raise ${stat.label}`}
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
          <div className="skill-family-grid">
            {groupedSkills.map(({ stat, skills: statSkills }) => (
              <section className="skill-family" key={stat.id}>
                <header>
                  <strong>{stat.label.toUpperCase()}</strong>
                  <span>{stats[stat.id] ?? rules?.stat_min ?? 0}</span>
                </header>
                <div className="allocation-grid">
                  {statSkills.map((skill) => (
                    <div className="allocation-row allocation-row-rich" key={skill.id}>
                      <span>
                        {skill.label}
                        <small>{skill.description}</small>
                      </span>
                      <div>
                        <button
                          type="button"
                          aria-label={`Lower ${skill.label}`}
                          onClick={() => nudge("skill", skill.id, -1)}
                        >
                          −
                        </button>
                        <strong>{skills[skill.id] ?? rules?.skill_min ?? 0}</strong>
                        <button
                          type="button"
                          aria-label={`Raise ${skill.label}`}
                          onClick={() => nudge("skill", skill.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <Panel title="HOW ADVANCEMENT WORKS">
          <div className="progression-rules-grid">
            <div><strong>EVERY LEVEL</strong><span>+{rules?.skill_points_per_level ?? 2} SKILL POINTS</span></div>
            <div><strong>EVEN LEVELS</strong><span>+1 ATTRIBUTE POINT</span></div>
            <div><strong>LEVEL {rules?.talent_points_start_level ?? 3}+</strong><span>NEW TALENT POINT EVERY {rules?.talent_point_interval ?? 2} LEVELS</span></div>
          </div>
          <p className="muted-copy">
            XP still marks experience, but levels now create permanent choices: specialize
            skills, raise attributes, and unlock Talents that change how this Hero performs.
          </p>
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
