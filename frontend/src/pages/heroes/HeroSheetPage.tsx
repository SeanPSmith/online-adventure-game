import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
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

  const advancementWaiting = hero
    ? hero.unspent_stat_points + hero.unspent_skill_points + hero.unspent_talent_points
    : 0;
  const pendingAdvancement = statCost + skillCost + talentSpend.length;

  return (
    <>
      <PageTitle
        eyebrow="CHARACTER SHEET // HERO RECORD"
        title={hero?.name?.toUpperCase() ?? "RECOVERING CHARACTER SHEET_"}
        actions={hero ? (
          <div className="hero-sheet-title-actions">
            <span className="hero-level-chip">LVL {hero.level}</span>
            {advancementWaiting > 0 ? (
              <span className="hero-advance-chip">{advancementWaiting} POINTS WAITING</span>
            ) : null}
            <Link className="button" to="/game/heroes">HERO HALL</Link>
          </div>
        ) : null}
      />

      {error ? <div className="form-error">{error}</div> : null}

      {hero ? (
        <div className="hero-sheet-grid hero-sheet-redesign">
          <Panel title="HERO DOSSIER" className="hero-sheet-wide hero-dossier-panel">
            <div className="hero-dossier-grid">
              <div className="hero-dossier-bio">
                <div className="hero-section-kicker">DIRECTOR CANON</div>
                {editingBio ? (
                  <div className="hero-bio-editor">
                    <textarea
                      rows={7}
                      maxLength={800}
                      value={bioDraft}
                      onChange={(event) => setBioDraft(event.target.value)}
                    />
                    <div className="hero-bio-editor-footer">
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
                  </div>
                ) : (
                  <div className="hero-bio-readout hero-bio-readout-large">
                    <p>{hero.bio || "NO AUTHORED BIO YET. GIVE THE DIRECTOR SOMETHING HUMAN TO WORK WITH."}</p>
                    <button type="button" className="button" onClick={() => setEditingBio(true)}>
                      EDIT BIO
                    </button>
                  </div>
                )}
              </div>

              <aside className="hero-dossier-vitals">
                <div className="hero-vital-primary">
                  <span>HEALTH</span>
                  <strong>{hero.health}<i>/ {hero.max_health}</i></strong>
                  <div className="meter"><span style={{ width: `${Math.max(0, Math.min(100, (hero.health / Math.max(1, hero.max_health)) * 100))}%` }} /></div>
                </div>
                <div className="hero-vital-primary">
                  <span>EXPERIENCE</span>
                  <strong>{hero.experience}<i>XP</i></strong>
                  <div className="meter"><span style={{ width: `${hero.xp_progress_percent}%` }} /></div>
                  <small>{hero.xp_needed_for_next_level} XP TO LEVEL {hero.level + 1}</small>
                </div>
                <div className="hero-point-ledger">
                  <div><span>ATTRIBUTE</span><strong>{hero.unspent_stat_points}</strong></div>
                  <div><span>SKILL</span><strong>{hero.unspent_skill_points}</strong></div>
                  <div><span>TALENT</span><strong>{hero.unspent_talent_points}</strong></div>
                </div>
              </aside>
            </div>
          </Panel>

          <Panel title="CORE ATTRIBUTES // WHO YOU ARE" className="hero-sheet-wide">
            <div className="sheet-stat-grid sheet-attribute-grid hero-attribute-grid">
              {rules?.stats.map((definition, index) => {
                const value = hero.stats[definition.id] ?? 0;
                const pending = statSpend[definition.id] ?? 0;
                return (
                  <article className="sheet-stat sheet-stat-rich hero-attribute-card" key={definition.id}>
                    <div className="hero-attribute-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="sheet-stat-heading">
                      <span>{definition.label.toUpperCase()}</span>
                      <strong>{value}{pending ? <em>+{pending}</em> : null}</strong>
                    </div>
                    <SegmentedMeter value={value + pending} max={rules.advancement_stat_cap} />
                    <small>{definition.description}</small>
                    {hero.unspent_stat_points > 0 ? (
                      <div className="sheet-advance hero-advance-controls">
                        <button type="button" aria-label={`Remove ${definition.label} point`} onClick={() => nudgeSpend("stat", definition.id, -1)}>−</button>
                        <span>{pending ? `+${pending} QUEUED` : "ALLOCATE"}</span>
                        <button type="button" aria-label={`Add ${definition.label} point`} onClick={() => nudgeSpend("stat", definition.id, 1)}>+</button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </Panel>

          <Panel title="SKILLS // WHAT YOU KNOW HOW TO DO" className="hero-sheet-wide">
            <div className="sheet-skill-families hero-skill-families">
              {groupedSkills.map(({ stat, skills }) => (
                <section className="sheet-skill-family hero-skill-family" key={stat.id}>
                  <header>
                    <span>{stat.label.toUpperCase()}</span>
                    <small>{hero.stats[stat.id] ?? 0} ATTRIBUTE</small>
                  </header>
                  <div className="hero-skill-list">
                    {skills.map((definition) => {
                      const value = hero.skills[definition.id] ?? 0;
                      const pending = skillSpend[definition.id] ?? 0;
                      return (
                        <div className="hero-skill-row" key={definition.id}>
                          <div className="hero-skill-copy">
                            <div>
                              <strong>{definition.label.toUpperCase()}</strong>
                              <span>{definition.description}</span>
                            </div>
                            <b>{value}{pending ? <em>+{pending}</em> : null}</b>
                          </div>
                          <SegmentedMeter value={value + pending} max={rules?.advancement_skill_cap ?? 6} />
                          {hero.unspent_skill_points > 0 ? (
                            <div className="sheet-advance hero-skill-advance">
                              <button type="button" aria-label={`Remove ${definition.label} point`} onClick={() => nudgeSpend("skill", definition.id, -1)}>−</button>
                              <span>{pending ? `+${pending} QUEUED` : "ALLOCATE"}</span>
                              <button type="button" aria-label={`Add ${definition.label} point`} onClick={() => nudgeSpend("skill", definition.id, 1)}>+</button>
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
              <div className="talent-grid hero-talent-grid">
                {ownedTalents.map((talent) => (
                  <article className="talent-card is-owned hero-talent-card" key={talent.id}>
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
                <div className="hero-talent-choice-heading">
                  <span className="eyebrow">AVAILABLE TALENTS</span>
                  <strong>{hero.unspent_talent_points - talentSpend.length} POINTS REMAIN</strong>
                </div>
                <div className="talent-grid hero-talent-grid">
                  {availableTalents.map((talent) => {
                    const selected = talentSpend.includes(talent.id);
                    return (
                      <button
                        type="button"
                        className={`talent-card talent-card-button hero-talent-card${selected ? " is-selected" : ""}`}
                        key={talent.id}
                        onClick={() => toggleTalent(talent.id)}
                      >
                        <span className="eyebrow">LVL {talent.min_level}+</span>
                        <strong>{talent.label}</strong>
                        <p>{talent.description}</p>
                        <small>{talentBonusLabel(talent)}</small>
                        <span>{selected ? "QUEUED // REMOVE" : "SELECT TALENT"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </Panel>

          {(statCost > 0 || skillCost > 0 || talentSpend.length > 0) ? (
            <div className="advancement-commit hero-sheet-wide hero-advancement-commit">
              <div>
                <span className="eyebrow">ADVANCEMENT QUEUED</span>
                <strong>{pendingAdvancement} TOTAL CHANGES</strong>
                <small>{statCost} ATTRIBUTE // {skillCost} SKILL // {talentSpend.length} TALENT</small>
              </div>
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

          <Panel title="SEALED CHRONICLES // WHERE THEY HAVE BEEN" className="hero-sheet-wide">
            {stories.length === 0 ? (
              <div className="empty-state">
                <strong>NO TALES TO TELL. YET.</strong>
                <span>Statistically, this cannot last.</span>
              </div>
            ) : (
              <div className="story-history-list hero-chronicle-list">
                {stories.map((story, index) => (
                  <article className="story-history-row hero-chronicle-row" key={story.history_id}>
                    <div className="hero-chronicle-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="hero-chronicle-copy">
                      <span className="eyebrow">{story.ending_label}</span>
                      <strong>{story.adventure_title}</strong>
                      <small>{story.final_scene_title}</small>
                      <p>{story.recap || story.final_resolution}</p>
                    </div>
                    <div className="hero-chronicle-meta">
                      <span>{story.turn_count} TURNS</span>
                      <span>ROOM {story.room_code}</span>
                    </div>
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
