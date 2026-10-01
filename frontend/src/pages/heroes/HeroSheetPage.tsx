import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  advanceCharacter,
  getCharacter,
  getCreationRules,
  listCharacterStories,
  type Character,
  type CompletedStory,
  type CreationRules,
} from "../../services/characters";

export function HeroSheetPage() {
  const { heroId } = useParams();

  const [hero, setHero] = useState<Character | null>(null);
  const [rules, setRules] = useState<CreationRules | null>(null);
  const [stories, setStories] = useState<CompletedStory[]>([]);
  const [statSpend, setStatSpend] = useState<Record<string, number>>({});
  const [skillSpend, setSkillSpend] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!heroId) return;

    let alive = true;

    Promise.all([
      getCharacter(heroId),
      getCreationRules(),
      listCharacterStories(heroId),
    ])
      .then(([heroValue, rulesValue, storyValue]) => {
        if (!alive) return;

        setHero(heroValue);
        setRules(rulesValue);
        setStories(storyValue.stories);
        setError("");
      })
      .catch((reason) => {
        if (!alive) return;
        setError(
          reason instanceof Error ? reason.message : "Hero record unavailable.",
        );
      });

    return () => {
      alive = false;
    };
  }, [heroId]);

  const statCost = useMemo(
    () => Object.values(statSpend).reduce((total, value) => total + value, 0),
    [statSpend],
  );

  const skillCost = useMemo(
    () => Object.values(skillSpend).reduce((total, value) => total + value, 0),
    [skillSpend],
  );

  function nudgeSpend(
    kind: "stat" | "skill",
    key: string,
    amount: number,
  ) {
    if (!hero || !rules) return;

    const spending = kind === "stat" ? statSpend : skillSpend;
    const setSpending = kind === "stat" ? setStatSpend : setSkillSpend;
    const cost = kind === "stat" ? statCost : skillCost;
    const available = kind === "stat"
      ? hero.unspent_stat_points
      : hero.unspent_skill_points;
    const currentValue = kind === "stat"
      ? hero.stats[key] ?? 0
      : hero.skills[key] ?? 0;
    const cap = kind === "stat"
      ? rules.advancement_stat_cap
      : rules.advancement_skill_cap;

    const currentSpend = spending[key] ?? 0;
    const nextSpend = currentSpend + amount;

    if (nextSpend < 0) return;
    if (amount > 0 && cost >= available) return;
    if (currentValue + nextSpend > cap) return;

    setSpending({
      ...spending,
      [key]: nextSpend,
    });
  }

  async function commitAdvancement() {
    if (!heroId || !hero || (statCost === 0 && skillCost === 0)) return;

    setWorking(true);
    setError("");

    try {
      const updated = await advanceCharacter(heroId, statSpend, skillSpend);
      setHero(updated);
      setStatSpend({});
      setSkillSpend({});
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The advancement ledger refused that allocation.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="HERO RECORD"
        title={hero?.name?.toUpperCase() ?? "RECOVERING CHARACTER SHEET_"}
      />

      {error ? <div className="form-error">{error}</div> : null}

      {hero ? (
        <div className="hero-sheet-grid">
          <Panel title="VITALS">
            <div className="hero-sheet-vitals">
              <div><b>LEVEL</b><span>{hero.level}</span></div>
              <div><b>XP</b><span>{hero.experience}</span></div>
              <div><b>HP</b><span>{hero.health}/{hero.max_health}</span></div>
              <div><b>STAT POINTS</b><span>{hero.unspent_stat_points}</span></div>
              <div><b>SKILL POINTS</b><span>{hero.unspent_skill_points}</span></div>
            </div>
          </Panel>

          <Panel title="CORE STATS">
            <div className="sheet-stat-grid">
              {Object.entries(hero.stats).map(([key, value]) => (
                <div className="sheet-stat" key={key}>
                  <span>{key.toUpperCase()}</span>
                  <strong>{value}</strong>

                  {hero.unspent_stat_points > 0 ? (
                    <div className="sheet-advance">
                      <button
                        type="button"
                        onClick={() => nudgeSpend("stat", key, -1)}
                      >
                        −
                      </button>
                      <span>+{statSpend[key] ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => nudgeSpend("stat", key, 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="SKILLS" className="hero-sheet-wide">
            <div className="sheet-stat-grid sheet-skill-grid">
              {Object.entries(hero.skills).map(([key, value]) => (
                <div className="sheet-stat" key={key}>
                  <span>{key.toUpperCase()}</span>
                  <strong>{value}</strong>

                  {hero.unspent_skill_points > 0 ? (
                    <div className="sheet-advance">
                      <button
                        type="button"
                        onClick={() => nudgeSpend("skill", key, -1)}
                      >
                        −
                      </button>
                      <span>+{skillSpend[key] ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => nudgeSpend("skill", key, 1)}
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {(statCost > 0 || skillCost > 0) ? (
              <div className="advancement-commit">
                <span>
                  SPEND // {statCost} STAT // {skillCost} SKILL
                </span>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={working}
                  onClick={() => void commitAdvancement()}
                >
                  {working ? "UPDATING THE RECORD_" : "COMMIT ADVANCEMENT"}
                </button>
              </div>
            ) : null}
          </Panel>

          <Panel title="SEALED CHRONICLES" className="hero-sheet-wide">
            {stories.length === 0 ? (
              <div className="empty-state">
                <strong>NO TALES TO TELL. YET.</strong>
                <span>Statistically, this cannot last.</span>
              </div>
            ) : (
              <div className="story-history-list">
                {stories.map((story) => (
                  <article className="story-history-row" key={story.history_id}>
                    <div>
                      <span className="eyebrow">{story.ending_label}</span>
                      <strong>{story.adventure_title}</strong>
                      <small>{story.final_scene_title}</small>
                    </div>
                    <div>
                      <span>{story.turn_count} TURNS</span>
                      <span>{story.room_code}</span>
                    </div>
                    <p>{story.recap || story.final_resolution}</p>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <div className="route-loading">CONSULTING THE HERO ARCHIVE_</div>
      )}
    </>
  );
}
