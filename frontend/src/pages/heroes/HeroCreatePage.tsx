import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  createCharacter, getCreationRules, proposeHeroBiography, generateHeroPortrait,
  chooseHeroPortrait, type Character, type CreationRules, type AppearanceAnswers,
  type HeroPortraitBook,
} from "../../services/characters";
import "./quillairoHeroCreator.css";
import "./quillairoHeroCreatorPass6627.css";
import "./quillairoHeroQuizPass6646.css";
import { APPEARANCE_CHAPTERS, PERSONALITY_QUESTIONS, quizSummary, suggestedBuild } from "./heroQuestionnaire";

type Step = "identity" | "journey" | "abilities" | "record" | "portraits";
const STEPS: { id: Step; label: string }[] = [
  { id: "identity", label: "Your likeness" },
  { id: "journey", label: "Your nature" },
  { id: "abilities", label: "Your abilities" },
  { id: "record", label: "Your story" },
  { id: "portraits", label: "Your portrait" },
];
const initialAppearance: AppearanceAnswers = {
  species: "Human", gender: "", age: "", height: "", weight: "", build: "",
  face: "", skin: "", hair: "", attire: "", origin: "", calling: "",
  disposition: "", motivation: "", defining_detail: "",
};
type Answers = Record<string,string>;
// Question choices are intentionally curated. Only the Hero's name and edited
// biography remain free text; gameplay rules are server-owned.

function EditableField({ label, value, onChange, placeholder, detail }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; detail?: string;
}) {
  return <label className="qh-field"><span>{label}</span><input type="text" value={value} maxLength={label === "Name" ? 40 : 200}
    onChange={e => onChange(e.target.value)} placeholder={placeholder || "Your answer…"} />{detail && <small>{detail}</small>}</label>;
}

export function HeroCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo")?.trim() || "";
  const [step, setStep] = useState<Step>("identity");
  const [identityPage, setIdentityPage] = useState(0);
  const [quizPage, setQuizPage] = useState(0);
  const [rules, setRules] = useState<CreationRules | null>(null);
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState<AppearanceAnswers>(initialAppearance);
  const [answers, setAnswers] = useState<Answers>({});
  const [archetype, setArchetype] = useState("Wayfinder");
  const [stats, setStats] = useState<Record<string, number>>({});
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [bio, setBio] = useState("");
  const [hero, setHero] = useState<Character | null>(null);
  const [portraits, setPortraits] = useState<HeroPortraitBook | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [activity, setActivity] = useState("");
  useEffect(() => {
    let active = true;
    getCreationRules().then(value => {
      if (!active) return;
      setRules(value);
      const build = suggestedBuild(value, answers);
      setStats(build.stats); setSkills(build.skills);
    }).catch(reason => active && setError(reason instanceof Error ? reason.message : "The character rules could not be loaded."));
    return () => { active = false; };
  // Initialize once. Questionnaire updates happen through explicit recommendation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const statUsed = Object.values(stats).reduce((a, b) => a + b, 0);
  const skillUsed = Object.values(skills).reduce((a, b) => a + b, 0);
  const validPoints = Boolean(rules && statUsed === rules.stat_point_budget && skillUsed === rules.skill_point_budget);
  const skillsByStat = useMemo(() => rules?.stats.map(stat => ({
    stat, skills: rules.skills.filter(skill => skill.stat === stat.id),
  })) || [], [rules]);
  const updateAppearance = (key: keyof AppearanceAnswers, value: string) => setAppearance(current => ({...current, [key]: value}));
  function recommend(nextAnswers = answers) {
    if (!rules) return;
    const build = suggestedBuild(rules, nextAnswers);
    setStats(build.stats); setSkills(build.skills);
    const profile = quizSummary(nextAnswers);
    if (profile.complete) { setArchetype(profile.calling); setAppearance(current => ({...current, calling:profile.calling})); }
  }
  function setAnswer(key: string, id: string) {
    const next = {...answers, [key]: id};
    setAnswers(next); recommend(next);
  }
  function nudge(type: "stat" | "skill", id: string, delta: number) {
    if (!rules) return;
    const values = type === "stat" ? stats : skills;
    const change = type === "stat" ? setStats : setSkills;
    const minimum = type === "stat" ? rules.stat_min : rules.skill_min;
    const maximum = type === "stat" ? rules.stat_max : rules.skill_max;
    const available = type === "stat" ? rules.stat_point_budget - statUsed : rules.skill_point_budget - skillUsed;
    const next = (values[id] ?? minimum) + delta;
    if (next < minimum || next > maximum || delta > 0 && available <= 0) return;
    change({...values, [id]: next});
  }
  function completedAppearance(): AppearanceAnswers {
    // Preserve the questionnaire's personality signals for both biography and
    // character illustration without changing the existing server schema.
    return {...appearance, calling: archetype,
      disposition: [appearance.disposition, ...quizSummary(answers).traits.slice(0,3)].filter(Boolean).join("; ").slice(0,100)};
  }
  async function writeBiography() {
    if (!rules || !validPoints || !name.trim()) { setError("Name your Hero and allocate every point before generating a biography."); return; }
    setWorking(true); setError(""); setActivity("The chronicler is writing your Hero's story…");
    try { const proposal = await proposeHeroBiography(name.trim(), completedAppearance(), stats, skills); setBio(proposal.bio); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The chronicler is unavailable. You can still write your own bio."); }
    finally { setWorking(false); setActivity(""); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!rules || !validPoints || name.trim().length < 2) { setError("Give your Hero a name and use all available ability points."); return; }
    setWorking(true); setError(""); setActivity("Saving your Hero…");
    try {
      const saved = await createCharacter(name.trim(), bio.trim(), stats, skills, archetype.trim(), completedAppearance());
      setHero(saved); setStep("portraits");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create Hero."); }
    finally { setWorking(false); setActivity(""); }
  }
  async function generatePortrait() {
    if (!hero) return;
    setWorking(true); setError(""); setActivity("Painting an original transparent ink portrait…");
    try { setPortraits(await generateHeroPortrait(hero.character_id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Portrait generation could not complete."); }
    finally { setWorking(false); setActivity(""); }
  }
  async function selectPortrait(attempt: number) {
    if (!hero) return;
    setWorking(true); setError("");
    try { setPortraits(await chooseHeroPortrait(hero.character_id, attempt)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save selected portrait."); }
    finally { setWorking(false); }
  }
  const goToHero = () => navigate(returnTo || `/game/heroes/${encodeURIComponent(hero!.character_id)}`, { replace:true });
  function advance(next: Step) { setError(""); setStep(next); window.scrollTo({top: 0, behavior: "smooth"}); }
  const stepIndex = STEPS.findIndex(item => item.id === step);
  const appearanceChapter = APPEARANCE_CHAPTERS[identityPage];
  const appearanceComplete = appearanceChapter.prompts.every(prompt => appearance[prompt.key]?.trim());
  const question = PERSONALITY_QUESTIONS[quizPage];
  const quizProfile = quizSummary(answers);
  function nextIdentity() {
    if (!name.trim() || !appearanceComplete) return;
    if (identityPage < APPEARANCE_CHAPTERS.length - 1) { setIdentityPage(index => index + 1); window.scrollTo({top:0,behavior:"smooth"}); }
    else advance("journey");
  }
  function nextQuiz() {
    if (!answers[question.id]) return;
    if (quizPage < PERSONALITY_QUESTIONS.length - 1) { setQuizPage(index=>index+1); window.scrollTo({top:0,behavior:"smooth"}); }
    else { recommend(); advance("abilities"); }
  }
  return <div className="quill-hero-creator">
    <div className="qh-topline"><Link to="/game/heroes">← Hero Hall</Link><span>THE CHARACTER BOOK · VOL. I</span></div>
    <header className="qh-header"><img className="qh-header-art" src="/art/inkbound/hero-vista.png" alt="" aria-hidden="true" /><p className="qh-eyebrow">A LIFE NOT YET LIVED</p>
      <h1>{step === "portraits" ? "A face for the story" : "Who will you become?"}</h1>
      <p>Make yourself, an ordinary traveler, an ancient ogre, an elven wanderer, or a noble visitor from another world. Your story begins with your choices.</p>
    </header>
    <nav className="qh-steps" aria-label="Character creation progress">
      {STEPS.map((item, index) => <button type="button" key={item.id}
        disabled={index > stepIndex || Boolean(hero) && item.id !== "portraits"}
        aria-current={item.id === step ? "step" : undefined}
        onClick={() => advance(item.id)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}
    </nav>
    {error && <p className="qh-error" role="alert">{error}</p>}
    {activity && <p className="qh-activity" role="status">{activity}</p>}
    {!rules && !error && <p className="qh-activity">Opening the creation ledger…</p>}
    <form onSubmit={submit}>
      {step === "identity" && <section className="qh-sheet qh46-stage" aria-label="Guided Hero appearance">
        <div className="qh46-progress"><span>YOUR LIKENESS · CHAPTER {identityPage + 1} OF {APPEARANCE_CHAPTERS.length}</span><progress max={APPEARANCE_CHAPTERS.length} value={identityPage + 1} aria-label="Appearance progress" /></div>
        <div className="qh-section-heading"><span>01 / CHOOSE YOUR LIKENESS</span><h2>{appearanceChapter.title}</h2><p>{appearanceChapter.subtitle}</p></div>
        {identityPage === 0 && <div className="qh46-name"><EditableField label="Name" value={name} onChange={setName} placeholder="Give your Hero a name" detail="Only your Hero's name is typed. All other appearance details are selected from curated choices." /></div>}
        <div className="qh46-prompts">{appearanceChapter.prompts.map(prompt => <fieldset className="qh46-prompt" key={prompt.key}>
          <legend>{prompt.label}</legend><div className="qh46-options" role="group" aria-label={prompt.label}>
            {prompt.options.map(option => <button key={option.value} type="button" aria-pressed={appearance[prompt.key] === option.value} onClick={() => updateAppearance(prompt.key, option.value)}>{option.label}</button>)}
          </div>
        </fieldset>)}</div>
        <p className="qh46-footnote">These are story and illustration details, not stat bonuses. Your abilities will come from your decisions in the personality quiz.</p>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => identityPage === 0 ? navigate("/game/heroes") : setIdentityPage(index=>index-1)}>← {identityPage === 0 ? "Hero Hall" : "Previous chapter"}</button>
          <button type="button" className="qh-primary" disabled={name.trim().length < 2 || !appearanceComplete} onClick={nextIdentity}>{identityPage === APPEARANCE_CHAPTERS.length - 1 ? "Begin personality quiz" : "Turn the page"} →</button></div>
      </section>}
      {step === "journey" && <section className="qh-sheet qh46-stage" aria-label="Hero personality questionnaire">
        <div className="qh46-progress"><span>YOUR NATURE · QUESTION {quizPage + 1} OF {PERSONALITY_QUESTIONS.length}</span><progress max={PERSONALITY_QUESTIONS.length} value={quizPage + 1} aria-label="Personality quiz progress" /></div>
        <div className="qh-section-heading"><span>02 / A QUIZ ABOUT YOU</span><h2>{question.title}</h2><p>{question.scene}</p></div>
        <fieldset className="qh46-quiz"><legend>What would you do?</legend>
          <div className="qh-answer-grid qh46-answer-grid">{question.options.map((option,index) => <button key={option.id} type="button" aria-pressed={answers[question.id] === option.id}
            onClick={() => setAnswer(question.id, option.id)}><span className="qh46-letter">{String.fromCharCode(65 + index)}</span><strong>{option.label}</strong><small>{option.detail}</small></button>)}</div>
        </fieldset>
        <p className="qh46-footnote">There are no wrong answers. Your choices suggest attributes and skills; you can adjust every point before saving.</p>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => quizPage === 0 ? advance("identity") : setQuizPage(index=>index-1)}>← Previous question</button>
          <button type="button" className="qh-primary" disabled={!answers[question.id]} onClick={nextQuiz}>{quizPage === PERSONALITY_QUESTIONS.length - 1 ? "See my Hero profile" : "Next question"} →</button></div>
      </section>}
      {step === "abilities" && <section className="qh-sheet">
        <div className="qh-section-heading"><span>03 / YOUR ABILITIES</span><h2>Your answers shaped a Hero.</h2><p>Eight choices created this suggested build. You can redistribute points within the same server-enforced limits as every other player.</p></div>
        <div className="qh46-personality-result"><span>YOUR QUIZ PROFILE</span><h3>{quizProfile.calling}</h3><p>{quizProfile.traits.slice(0,4).join(" · ")}</p><small>Suggested strengths: {quizProfile.stats.slice(0,3).join(" · ")}</small></div>
        <div className="qh-budget-head"><strong>Attributes · {statUsed}/{rules?.stat_point_budget}</strong><button type="button" className="qh-quiet" onClick={() => recommend()}>Reapply questionnaire</button></div>
        <div className="qh-ledger">{rules?.stats.map(stat => <div key={stat.id} className="qh-ledger-row"><div><strong>{stat.label}</strong><small>{stat.description}</small></div><div className="qh-adjust"><button type="button" disabled={stats[stat.id] <= rules.stat_min} onClick={() => nudge("stat",stat.id,-1)} aria-label={`Lower ${stat.label}`}>−</button><output>{stats[stat.id] ?? 0}</output><button type="button" disabled={stats[stat.id] >= rules.stat_max || statUsed >= rules.stat_point_budget} onClick={() => nudge("stat",stat.id,1)} aria-label={`Raise ${stat.label}`}>+</button></div></div>)}</div>
        <div className="qh-progression-note"><strong>EVERY LEVEL</strong> grants {rules?.skill_points_per_level ?? 2} skill points; even levels award an <strong>ATTRIBUTE POINT</strong>; from level {rules?.talent_points_start_level ?? 3}, special milestones award a <strong>TALENT POINT</strong>.</div>
        <div className="qh-budget-head"><strong>Skills · {skillUsed}/{rules?.skill_point_budget}</strong></div>
        <div className="qh-skill-groups">{skillsByStat.map(({stat,skills:group}) => <section key={stat.id}><h3>{stat.label}</h3><div className="qh-ledger">{group.map(skill => <div key={skill.id} className="qh-ledger-row"><div><strong>{skill.label}</strong><small>{skill.description}</small></div><div className="qh-adjust"><button type="button" disabled={skills[skill.id] <= rules!.skill_min} onClick={() => nudge("skill",skill.id,-1)} aria-label={`Lower ${skill.label}`}>−</button><output>{skills[skill.id] ?? 0}</output><button type="button" disabled={skills[skill.id] >= rules!.skill_max || skillUsed >= rules!.skill_point_budget} onClick={() => nudge("skill",skill.id,1)} aria-label={`Raise ${skill.label}`}>+</button></div></div>)}</div></section>)}</div>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => { setQuizPage(PERSONALITY_QUESTIONS.length - 1); advance("journey"); }}>← Review quiz</button><button type="button" className="qh-primary" disabled={!validPoints} onClick={() => advance("record")}>Compose your story →</button></div>
      </section>}
      {step === "record" && <section className="qh-sheet qh-record">
        <div className="qh-section-heading"><span>04 / YOUR STORY</span><h2>One life, a hundred possibilities.</h2><p>Let the Story Director draft your background using your appearance and abilities, or write it yourself. The proposed text is never saved until you create your Hero.</p></div>
        <div className="qh-review"><div><span>NAME</span><strong>{name}</strong></div><div><span>ORIGIN</span><strong>{appearance.species}{appearance.origin ? ` · ${appearance.origin}` : ""}</strong></div><div><span>CALLING</span><strong>{archetype || "Wanderer"}</strong></div><div><span>YOUR QUIZ</span><strong>{quizProfile.traits.slice(0,3).join(" · ")}</strong></div><div><span>POINTS</span><strong>{statUsed}/{rules?.stat_point_budget} attributes · {skillUsed}/{rules?.skill_point_budget} skills</strong></div></div>
        <div className="qh-bio-heading"><h3>Biography</h3><button className="qh-quiet" type="button" disabled={working || !validPoints} onClick={() => void writeBiography()}>{working ? "Writing…" : "✧ Generate with AI"}</button></div>
        <label className="qh-field"><span>BIO // BACKGROUND, TEMPERAMENT, QUIRKS</span><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={800} rows={9} placeholder="The story behind this Hero…" /><small>{bio.length}/800 · OPTIONAL BACKGROUND — HELPS PERSONALIZE YOUR STORIES. This becomes part of their permanent record.</small></label>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => advance("abilities")}>← Adjust abilities</button><button type="submit" className="qh-primary" disabled={working || !validPoints || name.trim().length < 2}>Create Hero & prepare portraits →</button></div>
      </section>}
      {step === "portraits" && hero && <section className="qh-sheet qh-portrait-stage">
        <div className="qh-section-heading"><span>05 / YOUR PORTRAIT</span><h2>{hero.name}, in ink.</h2><p>Your Hero is saved. Commission up to three full-character ink illustrations, then choose one. Its upper portion also becomes a profile crop. Both are private; artwork is optional.</p></div>
        <div className="qh-portrait-grid">{portraits?.candidates.map(candidate => <div key={candidate.attempt} className="qh-portrait-option" data-selected={portraits.selected_attempt === candidate.attempt}>
          <div className="qh46-art-pair"><img className="qh46-figure" src={candidate.url} alt={`Full illustrated figure ${candidate.attempt} for ${hero.name}`} loading="lazy" />
            <div className="qh46-pfp-frame" aria-label="Profile crop preview"><img src={candidate.url} alt={`Profile crop for ${hero.name}`} loading="lazy" /></div></div>
          <span>Drawing {candidate.attempt} of 3 · Full figure + profile crop</span>
          <button className="qh-quiet" disabled={working || portraits.selected_attempt === candidate.attempt} type="button" onClick={() => void selectPortrait(candidate.attempt)}>{portraits.selected_attempt === candidate.attempt ? "Chosen portrait" : "Choose this portrait"}</button>
        </div>)}</div>
        {portraits?.selected_attempt !== null && portraits?.selected_attempt !== undefined ? <p className="qh-picked">Your portrait is saved to your Hero record.</p> : <button className="qh-primary" type="button" disabled={working || (portraits?.attempts_used ?? 0) >= 3} onClick={() => void generatePortrait()}>{working ? "Painting…" : `Generate portrait ${(portraits?.attempts_used ?? 0) + 1} of 3`}</button>}
        <p className="qh-smallprint">One paid image generation supplies both the full-figure view and a profile crop, so there is no second image charge. The three-attempt limit is enforced by the server. Artwork is private.</p>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={goToHero}>Finish {portraits?.selected_attempt ? "and see your Hero" : "without a portrait"} →</button></div>
      </section>}
    </form>
    <footer className="qh-footer"><span>✧</span> EVERY HERO IS A NEW PAGE IN THE STORY <span>✧</span></footer>
  </div>;
}
