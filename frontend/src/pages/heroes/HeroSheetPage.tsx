import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  advanceCharacter,
  getCharacter,
  getCreationRules,
  listCharacterStories,
  updateCharacterProfile,
  type Character,
  type CompletedStory,
  type CreationRules,
  type TalentDefinition,
} from "../../services/characters";

function SegmentedMeter({ value, max }: { value: number; max: number }) {
  const boundedMax = Math.max(1, max);
  const boundedValue = Math.max(0, Math.min(boundedMax, value));
  return (
    <div className="segmented-meter" aria-label={`${boundedValue} of ${boundedMax}`}>
      {Array.from({ length: boundedMax }, (_, index) => (
        <span key={index} className={index < boundedValue ? "is-filled" : ""} />
      ))}
    </div>
  );
}

function talentBonusLabel(talent: TalentDefinition) {
  const entries = [
    ...Object.entries(talent.stat_modifiers),
    ...Object.entries(talent.skill_modifiers),
  ];
  if (!entries.length) return "NARRATIVE TALENT";
  return entries
    .map(([key, value]) => `${value >= 0 ? "+" : ""}${value} ${key.replaceAll("_", " ").toUpperCase()}`)
    .join(" // ");
}

export function HeroSheetPage() {
  const { heroId } = useParams();

  const [hero, setHero] = useState<Character | null>(null);
  const [rules, setRules] = useState<CreationRules | null>(null);
  const [stories, setStories] = useState<CompletedStory[]>([]);
  const [statSpend, setStatSpend] = useState<Record<string, number>>({});
  const [skillSpend, setSkillSpend] = useState<Record<string, number>>({});
  const [talentSpend, setTalentSpend] = useState<string[]>([]);
  const [bioDraft, setBioDraft] = useState("");
  const [editingBio, setEditingBio] = useState(false);
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
        setBioDraft(heroValue.bio ?? "");
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

  const groupedSkills = useMemo(() => {
    if (!rules) return [];
    return rules.stats.map((stat) => ({
      stat,
      skills: rules.skills.filter((skill) => skill.stat === stat.id),
    })).filter((group) => group.skills.length > 0);
  }, [rules]);

  const ownedTalents = useMemo(() => {
    if (!hero || !rules) return [];
    const ids = new Set(hero.talents);
    return rules.talents.filter((talent) => ids.has(talent.id));
  }, [hero, rules]);

  const availableTalents = useMemo(() => {
    if (!hero || !rules) return [];
    const owned = new Set(hero.talents);
    return rules.talents.filter(
      (talent) => !owned.has(talent.id) && hero.level >= talent.min_level,
    );
  }, [hero, rules]);

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

  function toggleTalent(talentId: string) {
    if (!hero) return;
    setTalentSpend((current) => {
      if (current.includes(talentId)) {
        return current.filter((id) => id !== talentId);
      }
      if (current.length >= hero.unspent_talent_points) return current;
      return [...current, talentId];
    });
  }

  async function commitAdvancement() {
    if (!heroId || !hero || (statCost === 0 && skillCost === 0 && talentSpend.length === 0)) return;

    setWorking(true);
    setError("");

    try {
      const updated = await advanceCharacter(heroId, statSpend, skillSpend, talentSpend);
      setHero(updated);
      setStatSpend({});
      setSkillSpend({});
      setTalentSpend([]);
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

  async function saveBio() {
    if (!heroId || !hero) return;
    setWorking(true);
    setError("");
    try {
      const updated = await updateCharacterProfile(heroId, bioDraft.trim());
      setHero(updated);
      setBioDraft(updated.bio ?? "");
      setEditingBio(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Hero bio could not be saved.");
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
          <Panel title="VITALS // PROGRESSION">
            <div className="hero-sheet-vitals hero-sheet-vitals-dense">
              <div><b>LEVEL</b><span>{hero.level}</span></div>
              <div><b>HP</b><span>{hero.health}/{hero.max_health}</span></div>
              <div><b>ATTRIBUTE PTS</b><span>{hero.unspent_stat_points}</span></div>
              <div><b>SKILL PTS</b><span>{hero.unspent_skill_points}</span></div>
              <div><b>TALENT PTS</b><span>{hero.unspent_talent_points}</span></div>
            </div>
            <div className="hero-sheet-xp">
              <div>
                <strong>XP {hero.experience}</strong>
                <span>{hero.xp_needed_for_next_level} TO LEVEL {hero.level + 1}</span>
              </div>
              <div className="meter"><span style={{ width: `${hero.xp_progress_percent}%` }} /></div>
            </div>
          </Panel>

          <Panel title="BIO // DIRECTOR CANON">
            {editingBio ? (
              <div className="hero-bio-editor">
                <textarea
                  rows={6}
                  maxLength={800}
                  value={bioDraft}
                  onChange={(event) => setBioDraft(event.target.value)}
                />
                <small>{bioDraft.length}/800</small>
                <div>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setBioDraft(hero.bio ?? "");
                      setEditingBio(false);
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={working}
                    onClick={() => void saveBio()}
                  >
                    SAVE BIO
                  </button>
                </div>
              </div>
            ) : (
              <div className="hero-bio-readout">
                <p>{hero.bio || "NO AUTHORED BIO YET. THE DIRECTOR ONLY KNOWS THE NUMBERS."}</p>
                <button type="button" className="button" onClick={() => setEditingBio(true)}>
                  EDIT BIO
                </button>
              </div>
            )}
          </Panel>

          <Panel title="CORE ATTRIBUTES" className="hero-sheet-wide">
            <div className="sheet-stat-grid sheet-attribute-grid">
              {rules?.stats.map((definition) => {
                const value = hero.stats[definition.id] ?? 0;
                const pending = statSpend[definition.id] ?? 0;
                return (
                  <div className="sheet-stat sheet-stat-rich" key={definition.id}>
                    <div className="sheet-stat-heading">
                      <span>{definition.label.toUpperCase()}</span>
                      <strong>{value}{pending ? ` +${pending}` : ""}</strong>
                    </div>
                    <SegmentedMeter value={value + pending} max={rules.advancement_stat_cap} />
                    <small>{definition.description}</small>
                    {hero.unspent_stat_points > 0 ? (
                      <div className="sheet-advance">
                        <button type="button" onClick={() => nudgeSpend("stat", definition.id, -1)}>−</button>
                        <span>SPEND {pending}</span>
                        <button type="button" onClick={() => nudgeSpend("stat", definition.id, 1)}>+</button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="SKILLS" className="hero-sheet-wide">
            <div className="sheet-skill-families">
              {groupedSkills.map(({ stat, skills }) => (
                <section className="sheet-skill-family" key={stat.id}>
                  <header>{stat.label.toUpperCase()}</header>
                  <div className="sheet-stat-grid sheet-skill-grid">
                    {skills.map((definition) => {
                      const value = hero.skills[definition.id] ?? 0;
                      const pending = skillSpend[definition.id] ?? 0;
                      return (
                        <div className="sheet-stat sheet-stat-rich" key={definition.id}>
                          <div className="sheet-stat-heading">
                            <span>{definition.label.toUpperCase()}</span>
                            <strong>{value}{pending ? ` +${pending}` : ""}</strong>
                          </div>
                          <SegmentedMeter value={value + pending} max={rules?.advancement_skill_cap ?? 6} />
                          <small>{definition.description}</small>
                          {hero.unspent_skill_points > 0 ? (
                            <div className="sheet-advance">
                              <button type="button" onClick={() => nudgeSpend("skill", definition.id, -1)}>−</button>
                              <span>SPEND {pending}</span>
                              <button type="button" onClick={() => nudgeSpend("skill", definition.id, 1)}>+</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </Panel>

          <Panel title="TALENTS // PERMANENT EDGES" className="hero-sheet-wide">
            {ownedTalents.length ? (
              <div className="talent-grid">
                {ownedTalents.map((talent) => (
                  <article className="talent-card is-owned" key={talent.id}>
                    <span className="eyebrow">KNOWN TALENT</span>
                    <strong>{talent.label}</strong>
                    <p>{talent.description}</p>
                    <small>{talentBonusLabel(talent)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <strong>NO TALENTS YET.</strong>
                <span>Talent Points begin at level {rules?.talent_points_start_level ?? 3}.</span>
              </div>
            )}

            {hero.unspent_talent_points > 0 ? (
              <div className="talent-available">
                <div className="eyebrow">CHOOSE // {hero.unspent_talent_points - talentSpend.length} TALENT POINTS REMAIN</div>
                <div className="talent-grid">
                  {availableTalents.map((talent) => {
                    const selected = talentSpend.includes(talent.id);
                    return (
                      <button
                        type="button"
                        className={`talent-card talent-card-button${selected ? " is-selected" : ""}`}
                        key={talent.id}
                        onClick={() => toggleTalent(talent.id)}
                      >
                        <strong>{talent.label}</strong>
                        <p>{talent.description}</p>
                        <small>{talentBonusLabel(talent)}</small>
                        <span>{selected ? "SELECTED" : "SELECT TALENT"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </Panel>

          {(statCost > 0 || skillCost > 0 || talentSpend.length > 0) ? (
            <div className="advancement-commit hero-sheet-wide">
              <span>
                SPEND // {statCost} ATTRIBUTE // {skillCost} SKILL // {talentSpend.length} TALENT
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
