import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import "./quillairoHeroSheetPortrait.css";
import { Panel } from "../../components/ui/Panel";
import { HeroEffectList } from "../../features/adventure/HeroEffectList";
import { activeHeroEffects } from "../../features/adventure/heroEffects";
import "./quillairoHeroArchivePass6615.css";
import {
  advanceCharacter,
  getCharacter,
  getCreationRules,
  getHeroPortraits,
  chooseHeroPortrait,
  generateHeroPortrait,
  type HeroPortraitBook,
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
  const [portraitBook, setPortraitBook] = useState<HeroPortraitBook | null>(null);
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
        void getHeroPortraits(heroId).then(value => { if (alive) setPortraitBook(value); }).catch(() => { /* A saved Hero remains accessible if portrait storage is unavailable. */ });
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

  function queueSpend(
    kind: "stat" | "skill",
    key: string,
    amount: number | "max",
  ) {
    if (!hero || !rules) return;

    const available = kind === "stat"
      ? hero.unspent_stat_points
      : hero.unspent_skill_points;
    const currentValue = kind === "stat"
      ? hero.stats[key] ?? 0
      : hero.skills[key] ?? 0;
    const cap = kind === "stat"
      ? rules.advancement_stat_cap
      : rules.advancement_skill_cap;
    const setSpending = kind === "stat" ? setStatSpend : setSkillSpend;

    // Use the latest queued state instead of render-time totals. This makes
    // repeated/rapid clicks safe and lets a player distribute several points
    // across several Attributes/Skills before committing once.
    setSpending((current) => {
      const queuedTotal = Object.values(current).reduce((total, value) => total + value, 0);
      const currentSpend = current[key] ?? 0;
      const remainingPool = Math.max(0, available - queuedTotal);
      const remainingCap = Math.max(0, cap - currentValue - currentSpend);

      let delta: number;
      if (amount === "max") {
        delta = Math.min(remainingPool, remainingCap);
      } else if (amount > 0) {
        delta = Math.min(amount, remainingPool, remainingCap);
      } else {
        delta = Math.max(amount, -currentSpend);
      }

      if (delta === 0) return current;

      const nextSpend = currentSpend + delta;
      const next = { ...current };
      if (nextSpend <= 0) delete next[key];
      else next[key] = nextSpend;
      return next;
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

  const remainingStatPoints = hero ? Math.max(0, hero.unspent_stat_points - statCost) : 0;
  const remainingSkillPoints = hero ? Math.max(0, hero.unspent_skill_points - skillCost) : 0;
  const remainingTalentPoints = hero ? Math.max(0, hero.unspent_talent_points - talentSpend.length) : 0;
  const pendingAdvancement = statCost + skillCost + talentSpend.length;

  function jumpToAdvancement(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
      <PageTitle
        eyebrow="CHARACTER SHEET // HERO RECORD"
        title={hero?.name?.toUpperCase() ?? "RECOVERING CHARACTER SHEET_"}
        actions={hero ? (
          <div className="hero-sheet-title-actions">
            <span className="hero-level-chip">LVL {hero.level}</span>
            {hero.unspent_stat_points > 0 ? (
              <button
                type="button"
                className="hero-advance-chip"
                onClick={() => jumpToAdvancement("hero-attributes")}
              >
                {hero.unspent_stat_points} ATTRIBUTE {hero.unspent_stat_points === 1 ? "POINT" : "POINTS"}
              </button>
            ) : null}
            {hero.unspent_skill_points > 0 ? (
              <button
                type="button"
                className="hero-advance-chip"
                onClick={() => jumpToAdvancement("hero-skills")}
              >
                {hero.unspent_skill_points} SKILL {hero.unspent_skill_points === 1 ? "POINT" : "POINTS"}
              </button>
            ) : null}
            {hero.unspent_talent_points > 0 ? (
              <button
                type="button"
                className="hero-advance-chip"
                onClick={() => jumpToAdvancement("hero-talents")}
              >
                {hero.unspent_talent_points} TALENT {hero.unspent_talent_points === 1 ? "POINT" : "POINTS"}
              </button>
            ) : null}
            <Link className="button" to="/game/heroes">HERO HALL</Link>
          </div>
        ) : null}
      />

      {hero ? (
        <section className="qh15-sheet-frontispiece" aria-label="Hero portrait, identity and vital statistics">
          <div className="qh15-sheet-portrait-frame">
            {portraitBook?.selected_attempt ? (
              <img src={`/api/characters/${encodeURIComponent(hero.character_id)}/portrait/${portraitBook.selected_attempt}`} alt={`Chosen illustrated portrait of ${hero.name}`} />
            ) : portraitBook?.candidates[0] ? (
              <img src={portraitBook.candidates[0].url} alt={`Portrait candidate for ${hero.name}`} />
            ) : (
              <div className="qh15-sheet-unillustrated">
                <img src="/brand/monogram-gold-original.png" alt="" aria-hidden="true" />
                <span>THE LIKENESS IS YET TO BE DRAWN</span>
              </div>
            )}
          </div>
          <div className="qh15-sheet-identity">
            <span className="qh15-kicker">AN ILLUSTRATED LIFE · THE CHARACTER SHEET</span>
            <h2>{hero.name}</h2>
            <p className="qh15-sheet-archetype">{hero.archetype || "A traveler between worlds"}</p>
            <div className="qh15-sheet-info-list">
              <div><span>HERITAGE</span><strong>{hero.appearance?.species || "Unrecorded"}</strong></div>
              <div><span>ORIGIN</span><strong>{hero.appearance?.origin || "Not yet known"}</strong></div>
              <div><span>BUILD</span><strong>{[hero.appearance?.height, hero.appearance?.build].filter(Boolean).join(" · ") || "Unrecorded"}</strong></div>
              <div><span>CALLING</span><strong>{hero.appearance?.calling || hero.archetype || "A path to choose"}</strong></div>
            </div>
            <p className="qh15-sheet-motto">“Every road changes the traveler, and every traveler changes the road.”</p>
          </div>
          <aside className="qh15-sheet-vitals" aria-label="Hero progression">
            <span className="qh15-kicker">CURRENT RECORD</span>
            <div className="qh15-vital"><div><span>HEALTH</span><strong>{hero.health} / {hero.max_health}</strong></div>
              <div className="qh15-bar" role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={hero.max_health} aria-valuenow={hero.health}>
                <span style={{ width: `${Math.max(0, Math.min(100, 100 * hero.health / Math.max(1, hero.max_health)))}%` }} /></div>
            </div>
            <div className="qh15-vital"><div><span>EXPERIENCE</span><strong>{hero.experience} XP</strong></div>
              <div className="qh15-bar" role="progressbar" aria-label="Progress toward next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hero.xp_progress_percent}>
                <span style={{ width: `${Math.max(0, Math.min(100, hero.xp_progress_percent))}%` }} /></div>
              <small>{hero.xp_needed_for_next_level} XP until level {hero.level + 1}</small>
            </div>
            <div className="qh15-vital"><div><span>LEVEL</span><strong>{hero.level}</strong></div></div>
            <div className="qh15-vital"><div><span>UNSPENT POINTS</span><strong>{remainingStatPoints + remainingSkillPoints + remainingTalentPoints}</strong></div></div>
            <button type="button" className="qh15-subtle-link" onClick={() => jumpToAdvancement("hero-attributes")}>Review abilities →</button>
          </aside>
          {portraitBook && Object.keys(hero.appearance || {}).length > 0 ? (
            <div className="qh15-sheet-art-actions">
              <span className="qh15-kicker">YOUR PORTRAIT · {portraitBook.attempts_used} OF {portraitBook.max_attempts} ATTEMPTS USED</span>
              <div className="qh15-portrait-buttons">
                {portraitBook.candidates.map(candidate => (
                  <button type="button" className="button" key={candidate.attempt} disabled={working || candidate.attempt === portraitBook.selected_attempt}
                    onClick={() => {
                      setWorking(true);
                      void chooseHeroPortrait(hero.character_id, candidate.attempt).then(setPortraitBook)
                        .catch(reason => setError(reason instanceof Error ? reason.message : "Could not choose portrait."))
                        .finally(() => setWorking(false));
                    }}>
                    {candidate.attempt === portraitBook.selected_attempt ? `Drawing ${candidate.attempt} selected` : `Choose drawing ${candidate.attempt}`}
                  </button>
                ))}
                {portraitBook.selected_attempt === null && portraitBook.attempts_used < portraitBook.max_attempts ? (
                  <button className="button button-primary" type="button" disabled={working} onClick={() => {
                    setWorking(true);
                    void generateHeroPortrait(hero.character_id).then(setPortraitBook)
                      .catch(reason => setError(reason instanceof Error ? reason.message : "Portrait generation unavailable."))
                      .finally(() => setWorking(false));
                  }}>Generate portrait {portraitBook.attempts_used + 1} of 3</button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}

      {hero && (!hero.is_alive || hero.hero_status !== "active") ? (
        <section className={`hero-fate-banner ${!hero.is_alive ? "is-fallen" : "is-retired"}`} aria-label="Hero fate">
          <span className="qh15-fate-emblem" aria-hidden="true">✦</span>
          <div>
            <strong>{!hero.is_alive ? "THIS HERO HAS FALLEN" : "THIS HERO HAS RETIRED"}</strong>
            <p>{!hero.is_alive ? String(hero.death_record?.cause || "Their journey has ended. Their story remains.") : "Their adventures are archived. The Hero may return from retirement."}</p>
            {hero.hero_status === "buried" ? <Link className="button" to="/game/graveyard">VISIT THEIR GRAVE →</Link> : <Link className="button" to="/game/heroes">MANAGE THEIR LEGACY →</Link>}
          </div>
        </section>
      ) : null}

      {hero ? (
        <div className="hero-sheet-grid hero-sheet-redesign">
          <Panel title="HERO DOSSIER" className="hero-sheet-wide hero-dossier-panel qh15-sheet-dossier">
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
                  {hero.is_alive && hero.health < hero.max_health ? (
                    <small>RECOVERS +{Math.max(1, Math.ceil(hero.max_health * 0.1))} HP / HOUR OUTSIDE ADVENTURES</small>
                  ) : null}
                </div>
                <div className="hero-vital-primary">
                  <span>EXPERIENCE</span>
                  <strong>{hero.experience}<i>XP</i></strong>
                  <div className="meter"><span style={{ width: `${hero.xp_progress_percent}%` }} /></div>
                  <small>{hero.xp_needed_for_next_level} XP TO LEVEL {hero.level + 1}</small>
                </div>
                <div className="hero-point-ledger">
                  <div>
                    <span>ATTRIBUTE</span>
                    <strong>{remainingStatPoints}</strong>
                    <small>{statCost ? `${statCost} QUEUED` : remainingStatPoints > 0 ? "READY TO SPEND" : "NONE"}</small>
                  </div>
                  <div>
                    <span>SKILL</span>
                    <strong>{remainingSkillPoints}</strong>
                    <small>{skillCost ? `${skillCost} QUEUED` : remainingSkillPoints > 0 ? "READY TO SPEND" : "NONE"}</small>
                  </div>
                  <div>
                    <span>TALENT</span>
                    <strong>{remainingTalentPoints}</strong>
                    <small>{talentSpend.length ? `${talentSpend.length} QUEUED` : remainingTalentPoints > 0 ? "READY TO SPEND" : "NONE"}</small>
                  </div>
                </div>
              </aside>
            </div>
          </Panel>

          <Panel title={<span id="hero-attributes">CORE ATTRIBUTES // WHO YOU ARE</span>} className="hero-sheet-wide qh15-sheet-attributes">
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
                    {(hero.unspent_stat_points > 0 || pending > 0) ? (
                      <div className="sheet-advance hero-advance-controls">
                        <button
                          type="button"
                          disabled={pending <= 0}
                          aria-label={`Remove ${definition.label} point`}
                          onClick={() => queueSpend("stat", definition.id, -1)}
                        >−</button>
                        <span>
                          {pending ? `+${pending} QUEUED` : value >= rules.advancement_stat_cap ? "MAXED" : `${remainingStatPoints} LEFT`}
                        </span>
                        <div className="hero-advance-adders">
                          <button
                            type="button"
                            disabled={remainingStatPoints <= 0 || value + pending >= rules.advancement_stat_cap}
                            aria-label={`Add one ${definition.label} point`}
                            onClick={() => queueSpend("stat", definition.id, 1)}
                          >+1</button>
                          <button
                            type="button"
                            className="hero-advance-max"
                            disabled={remainingStatPoints <= 0 || value + pending >= rules.advancement_stat_cap}
                            aria-label={`Add as many ${definition.label} points as possible`}
                            onClick={() => queueSpend("stat", definition.id, "max")}
                          >MAX</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </Panel>

          <Panel title={<span id="hero-skills">SKILLS // WHAT YOU KNOW HOW TO DO</span>} className="hero-sheet-wide qh15-sheet-skills">
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
                          {(hero.unspent_skill_points > 0 || pending > 0) ? (
                            <div className="sheet-advance hero-skill-advance">
                              <button
                                type="button"
                                disabled={pending <= 0}
                                aria-label={`Remove ${definition.label} point`}
                                onClick={() => queueSpend("skill", definition.id, -1)}
                              >−</button>
                              <span>
                                {pending ? `+${pending} QUEUED` : value >= (rules?.advancement_skill_cap ?? 6) ? "MAXED" : `${remainingSkillPoints} LEFT`}
                              </span>
                              <div className="hero-advance-adders">
                                <button
                                  type="button"
                                  disabled={remainingSkillPoints <= 0 || value + pending >= (rules?.advancement_skill_cap ?? 6)}
                                  aria-label={`Add one ${definition.label} point`}
                                  onClick={() => queueSpend("skill", definition.id, 1)}
                                >+1</button>
                                <button
                                  type="button"
                                  className="hero-advance-max"
                                  disabled={remainingSkillPoints <= 0 || value + pending >= (rules?.advancement_skill_cap ?? 6)}
                                  aria-label={`Add as many ${definition.label} points as possible`}
                                  onClick={() => queueSpend("skill", definition.id, "max")}
                                >MAX</button>
                              </div>
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

          <Panel title={<span id="hero-talents">TALENTS // PERMANENT EDGES</span>} className="hero-sheet-wide qh15-sheet-talents">
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
                  <strong>{remainingTalentPoints} POINTS REMAIN</strong>
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
              <div className="hero-advancement-actions">
                <button
                  className="button"
                  type="button"
                  disabled={working}
                  onClick={() => {
                    setStatSpend({});
                    setSkillSpend({});
                    setTalentSpend([]);
                  }}
                >
                  RESET QUEUE
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={working}
                  onClick={() => void commitAdvancement()}
                >
                  {working ? "UPDATING THE RECORD_" : "COMMIT ADVANCEMENT"}
                </button>
              </div>
            </div>
          ) : null}

          <Panel title="EQUIPMENT & CURRENT CONDITIONS" className="hero-sheet-wide qh15-sheet-inventory">
            <div className="qh15-inventory-heading"><span className="qh15-kicker">WHAT THEY CARRY</span><small>{hero.inventory.length} ITEMS</small></div>
            {hero.inventory.length > 0 ? (
              <div className="qh15-inventory-list">
                {hero.inventory.map((item, index) => <div className="qh15-inventory-item" key={`${index}:${item}`}>
                  <span aria-hidden="true">✧</span><strong>{item}</strong>
                </div>)}
              </div>
            ) : <p className="qh15-inventory-empty">No equipment has been recorded for this Hero.</p>}
            <div className="qh15-inventory-heading qh15-conditions-heading"><span className="qh15-kicker">CURRENT CONDITIONS</span><small>{activeHeroEffects(hero.effects).length} ACTIVE</small></div>
            <div className="qh15-conditions"><HeroEffectList effects={hero.effects} /></div>
          </Panel>

          <Panel title="SEALED CHRONICLES // WHERE THEY HAVE BEEN" className="hero-sheet-wide qh15-sheet-chronicles">
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
