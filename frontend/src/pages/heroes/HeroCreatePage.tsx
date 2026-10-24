import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  createCharacter, getCreationRules, proposeHeroBiography, generateHeroPortrait,
  chooseHeroPortrait, type Character, type CreationRules, type AppearanceAnswers,
  type HeroPortraitBook,
} from "../../services/characters";
import "./quillairoHeroCreator.css";
import "./quillairoHeroCreatorPass6627.css";

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
type Answers = { instinct: string; obstacle: string; gift: string };
const choices: { key: keyof Answers; title: string; description: string; options: { id: string; label: string; detail: string }[] }[] = [
  { key: "instinct", title: "When the unexpected happens, you…", description: "Your first impulse shapes your strongest attribute.", options: [
    { id: "strength", label: "Stand your ground", detail: "I meet it head-on" },
    { id: "agility", label: "Move first", detail: "Speed creates opportunity" },
    { id: "intellect", label: "Make a plan", detail: "Knowledge is an advantage" },
    { id: "perception", label: "Notice the detail", detail: "I see what others miss" },
    { id: "presence", label: "Talk it through", detail: "People change outcomes" },
    { id: "willpower", label: "Keep your nerve", detail: "Endurance is its own weapon" },
    { id: "luck", label: "Take the chance", detail: "Fortune favors the bold" },
  ] },
  { key: "obstacle", title: "A locked door blocks your path. You…", description: "There is more than one way forward.", options: [
    { id: "brawn", label: "Force it", detail: "Sometimes the direct route works" },
    { id: "shadow", label: "Find a quiet way", detail: "Leave no trace" },
    { id: "reason", label: "Understand it", detail: "Every lock has a story" },
    { id: "social", label: "Ask someone", detail: "A friend can open doors" },
    { id: "wild", label: "Find another road", detail: "Trust the terrain" },
  ] },
  { key: "gift", title: "What will your companions remember?", description: "Not a bonus—an expression of your character.", options: [
    { id: "guardian", label: "I kept them safe", detail: "Courage and compassion" },
    { id: "healer", label: "I helped them recover", detail: "Care when it counts" },
    { id: "scholar", label: "I knew the answer", detail: "Learning without limits" },
    { id: "guide", label: "I found the way", detail: "Through unfamiliar places" },
    { id: "speaker", label: "I gave them hope", detail: "The right words matter" },
  ] },
];

const skillMap: Record<string, string[]> = {
  strength: ["athletics", "brawl"], agility: ["acrobatics", "stealth"],
  intellect: ["investigation", "knowledge"], perception: ["awareness", "survival"],
  presence: ["persuasion", "performance"], willpower: ["discipline", "composure"],
  luck: ["sleight", "navigation"], brawn: ["athletics", "brawl"],
  shadow: ["stealth", "sleight"], reason: ["investigation", "technology"],
  social: ["persuasion", "insight"], wild: ["survival", "navigation"],
  guardian: ["discipline", "awareness"], healer: ["medicine", "insight"],
  scholar: ["knowledge", "investigation"], guide: ["navigation", "survival"],
  speaker: ["persuasion", "performance"],
};
const statMap: Record<string, string> = {
  brawn: "strength", shadow: "agility", reason: "intellect", social: "presence",
  wild: "perception", guardian: "willpower", healer: "intellect",
  scholar: "intellect", guide: "perception", speaker: "presence",
};
const callingMap: Record<string, string> = {
  guardian: "Guardian", healer: "Healer", scholar: "Scholar", guide: "Wayfinder", speaker: "Envoy",
};
function spread(defs: { id: string }[], minimum: number, maximum: number, budget: number, priority: string[]): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(defs.map(({ id }) => [id, minimum]));
  const order = [...new Set([...priority, ...defs.map(({id}) => id)])].filter(id => id in result);
  let remaining = Math.max(0, budget - defs.length * minimum);
  // Give each favored entry a point before cycling. No appearance identity
  // deterministically disadvantages a species, gender, or body size.
  while (remaining > 0) {
    let progressed = false;
    for (const id of order) {
      if (remaining === 0) break;
      if (result[id] < maximum) { result[id]++; remaining--; progressed = true; }
    }
    if (!progressed) break;
  }
  return result;
}
function suggestedBuild(rules: CreationRules, answers: Answers) {
  const statPriority = [answers.instinct, statMap[answers.obstacle], statMap[answers.gift]].filter(Boolean);
  const skillPriority = [answers.instinct, answers.obstacle, answers.gift].flatMap(id => skillMap[id] || []);
  return {
    stats: spread(rules.stats, rules.stat_min, rules.stat_max, rules.stat_point_budget, statPriority),
    skills: spread(rules.skills, rules.skill_min, rules.skill_max, rules.skill_point_budget, skillPriority),
  };
}

function EditableField({ label, value, onChange, placeholder, detail }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; detail?: string;
}) {
  const limits: Record<string, number> = {
    "Name": 40, "Species / ancestry": 80, "Gender / presentation": 80,
    "Age or apparent age": 50, "Height": 60, "Weight": 60,
    "Build / muscle": 100, "Skin / markings": 100, "Hair / features": 110,
    "Face / expression": 180, "Clothing / equipment": 160,
    "Defining detail": 200, "Where are you from?": 150,
    "Calling / role": 80, "Temperament": 100, "What drives you?": 150,
  };
  return <label className="qh-field"><span>{label}</span><input type="text" value={value} maxLength={limits[label] ?? 200}
    onChange={e => onChange(e.target.value)} placeholder={placeholder || "Your answer…"} />{detail && <small>{detail}</small>}</label>;
}

export function HeroCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo")?.trim() || "";
  const [step, setStep] = useState<Step>("identity");
  const [rules, setRules] = useState<CreationRules | null>(null);
  const [name, setName] = useState("");
  const [appearance, setAppearance] = useState<AppearanceAnswers>(initialAppearance);
  const [answers, setAnswers] = useState<Answers>({ instinct: "perception", obstacle: "wild", gift: "guide" });
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
    setArchetype(callingMap[nextAnswers.gift] || "Wanderer");
  }
  function setAnswer(key: keyof Answers, id: string) {
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
  async function writeBiography() {
    if (!rules || !validPoints || !name.trim()) { setError("Name your Hero and allocate every point before generating a biography."); return; }
    setWorking(true); setError(""); setActivity("The chronicler is writing your Hero's story…");
    try { const proposal = await proposeHeroBiography(name.trim(), {...appearance, calling: archetype}, stats, skills); setBio(proposal.bio); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The chronicler is unavailable. You can still write your own bio."); }
    finally { setWorking(false); setActivity(""); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!rules || !validPoints || name.trim().length < 2) { setError("Give your Hero a name and use all available ability points."); return; }
    setWorking(true); setError(""); setActivity("Saving your Hero…");
    try {
      const saved = await createCharacter(name.trim(), bio.trim(), stats, skills, archetype.trim(), appearance);
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
      {step === "identity" && <section className="qh-sheet">
        <div className="qh-section-heading"><span>01 / YOUR LIKENESS</span><h2>There are no ordinary people.</h2><p>Describe the person you want to bring into the world. None of these details limit your abilities.</p></div>
        <div className="qh-fields">
          <EditableField label="Name" value={name} onChange={setName} placeholder="What are you called?" />
          <EditableField label="Species / ancestry" value={appearance.species} onChange={v => updateAppearance("species",v)} placeholder="Human, ogre, elf, alien, or something entirely new" />
          <EditableField label="Gender / presentation" value={appearance.gender} onChange={v => updateAppearance("gender",v)} placeholder="Anything, or leave blank" />
          <EditableField label="Age or apparent age" value={appearance.age} onChange={v => updateAppearance("age",v)} placeholder="Late 30s, ageless, 90 winters…" />
          <EditableField label="Height" value={appearance.height} onChange={v => updateAppearance("height",v)} placeholder="5′ 10″, towering, 2.4m…" />
          <EditableField label="Weight" value={appearance.weight} onChange={v => updateAppearance("weight",v)} placeholder="160 lb, immense, slight…" />
          <EditableField label="Build / muscle" value={appearance.build} onChange={v => updateAppearance("build",v)} placeholder="Average, lean, stocky, muscular, massive…" />
          <EditableField label="Skin / markings" value={appearance.skin} onChange={v => updateAppearance("skin",v)} placeholder="Tone, texture, scales, tattoos…" />
          <EditableField label="Hair / features" value={appearance.hair} onChange={v => updateAppearance("hair",v)} placeholder="Color, style, fur, horns, antennae…" />
          <EditableField label="Face / expression" value={appearance.face} onChange={v => updateAppearance("face",v)} placeholder="An ordinary face, a scar, gentle eyes…" />
          <EditableField label="Clothing / equipment" value={appearance.attire} onChange={v => updateAppearance("attire",v)} placeholder="A worn coat, ceremonial armor, plain clothes…" />
          <EditableField label="Defining detail" value={appearance.defining_detail} onChange={v => updateAppearance("defining_detail",v)} placeholder="One detail that makes them unmistakable" />
        </div>
        <div className="qh-actions"><button type="button" className="qh-primary" disabled={name.trim().length < 2} onClick={() => advance("journey")}>Continue — your nature →</button></div>
      </section>}
      {step === "journey" && <section className="qh-sheet">
        <div className="qh-section-heading"><span>02 / YOUR NATURE</span><h2>What kind of person are you?</h2><p>Three little decisions suggest your starting abilities. You can change every point afterward.</p></div>
        <div className="qh-questions">{choices.map(question => <fieldset key={question.key}>
          <legend>{question.title}</legend><p>{question.description}</p>
          <div className="qh-answer-grid">{question.options.map(option => <button key={option.id} type="button"
            aria-pressed={answers[question.key] === option.id} onClick={() => setAnswer(question.key, option.id)}><strong>{option.label}</strong><small>{option.detail}</small></button>)}</div>
        </fieldset>)}</div>
        <div className="qh-fields qh-personality-fields">
          <EditableField label="Where are you from?" value={appearance.origin} onChange={v => updateAppearance("origin",v)} placeholder="An ordinary city, forgotten kingdom, distant star…" />
          <EditableField label="Calling / role" value={archetype} onChange={setArchetype} placeholder="Wanderer, engineer, royal envoy, none…" />
          <EditableField label="Temperament" value={appearance.disposition} onChange={v => updateAppearance("disposition",v)} placeholder="Curious, anxious, reserved, irreverent…" />
          <EditableField label="What drives you?" value={appearance.motivation} onChange={v => updateAppearance("motivation",v)} placeholder="Something worth the journey" />
        </div>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => advance("identity")}>← Back</button><button type="button" className="qh-primary" onClick={() => advance("abilities")}>Review your abilities →</button></div>
      </section>}
      {step === "abilities" && <section className="qh-sheet">
        <div className="qh-section-heading"><span>03 / YOUR ABILITIES</span><h2>A suggested starting build.</h2><p>Your answers decide where the first points go. Change anything. The same game rules and budgets apply to everyone.</p></div>
        <div className="qh-budget-head"><strong>Attributes · {statUsed}/{rules?.stat_point_budget}</strong><button type="button" className="qh-quiet" onClick={() => recommend()}>Reapply questionnaire</button></div>
        <div className="qh-ledger">{rules?.stats.map(stat => <div key={stat.id} className="qh-ledger-row"><div><strong>{stat.label}</strong><small>{stat.description}</small></div><div className="qh-adjust"><button type="button" disabled={stats[stat.id] <= rules.stat_min} onClick={() => nudge("stat",stat.id,-1)} aria-label={`Lower ${stat.label}`}>−</button><output>{stats[stat.id] ?? 0}</output><button type="button" disabled={stats[stat.id] >= rules.stat_max || statUsed >= rules.stat_point_budget} onClick={() => nudge("stat",stat.id,1)} aria-label={`Raise ${stat.label}`}>+</button></div></div>)}</div>
        <div className="qh-progression-note"><strong>EVERY LEVEL</strong> grants {rules?.skill_points_per_level ?? 2} skill points; even levels award an <strong>ATTRIBUTE POINT</strong>; from level {rules?.talent_points_start_level ?? 3}, special milestones award a <strong>TALENT POINT</strong>.</div>
        <div className="qh-budget-head"><strong>Skills · {skillUsed}/{rules?.skill_point_budget}</strong></div>
        <div className="qh-skill-groups">{skillsByStat.map(({stat,skills:group}) => <section key={stat.id}><h3>{stat.label}</h3><div className="qh-ledger">{group.map(skill => <div key={skill.id} className="qh-ledger-row"><div><strong>{skill.label}</strong><small>{skill.description}</small></div><div className="qh-adjust"><button type="button" disabled={skills[skill.id] <= rules!.skill_min} onClick={() => nudge("skill",skill.id,-1)} aria-label={`Lower ${skill.label}`}>−</button><output>{skills[skill.id] ?? 0}</output><button type="button" disabled={skills[skill.id] >= rules!.skill_max || skillUsed >= rules!.skill_point_budget} onClick={() => nudge("skill",skill.id,1)} aria-label={`Raise ${skill.label}`}>+</button></div></div>)}</div></section>)}</div>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => advance("journey")}>← Back</button><button type="button" className="qh-primary" disabled={!validPoints} onClick={() => advance("record")}>Compose your story →</button></div>
      </section>}
      {step === "record" && <section className="qh-sheet qh-record">
        <div className="qh-section-heading"><span>04 / YOUR STORY</span><h2>One life, a hundred possibilities.</h2><p>Let the Story Director draft your background using your appearance and abilities, or write it yourself. The proposed text is never saved until you create your Hero.</p></div>
        <div className="qh-review"><div><span>NAME</span><strong>{name}</strong></div><div><span>ORIGIN</span><strong>{appearance.species}{appearance.origin ? ` · ${appearance.origin}` : ""}</strong></div><div><span>CALLING</span><strong>{archetype || "Wanderer"}</strong></div><div><span>POINTS</span><strong>{statUsed}/{rules?.stat_point_budget} attributes · {skillUsed}/{rules?.skill_point_budget} skills</strong></div></div>
        <div className="qh-bio-heading"><h3>Biography</h3><button className="qh-quiet" type="button" disabled={working || !validPoints} onClick={() => void writeBiography()}>{working ? "Writing…" : "✧ Generate with AI"}</button></div>
        <label className="qh-field"><span>BIO // BACKGROUND, TEMPERAMENT, QUIRKS</span><textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={800} rows={9} placeholder="The story behind this Hero…" /><small>{bio.length}/800 · OPTIONAL BACKGROUND — HELPS PERSONALIZE YOUR STORIES. This becomes part of their permanent record.</small></label>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={() => advance("abilities")}>← Adjust abilities</button><button type="submit" className="qh-primary" disabled={working || !validPoints || name.trim().length < 2}>Create Hero & prepare portraits →</button></div>
      </section>}
      {step === "portraits" && hero && <section className="qh-sheet qh-portrait-stage">
        <div className="qh-section-heading"><span>05 / YOUR PORTRAIT</span><h2>{hero.name}, in ink.</h2><p>Your Hero is saved. You may commission up to three original transparent ink illustrations, then choose the one that belongs in their folio. No image is required to play.</p></div>
        <div className="qh-portrait-grid">{portraits?.candidates.map(candidate => <div key={candidate.attempt} className="qh-portrait-option" data-selected={portraits.selected_attempt === candidate.attempt}>
          <img src={candidate.url} alt={`Portrait candidate ${candidate.attempt} for ${hero.name}`} loading="lazy" /><span>Sketch {candidate.attempt} of 3</span>
          <button className="qh-quiet" disabled={working || portraits.selected_attempt === candidate.attempt} type="button" onClick={() => void selectPortrait(candidate.attempt)}>{portraits.selected_attempt === candidate.attempt ? "Chosen portrait" : "Choose this portrait"}</button>
        </div>)}</div>
        {portraits?.selected_attempt !== null && portraits?.selected_attempt !== undefined ? <p className="qh-picked">Your portrait is saved to your Hero record.</p> : <button className="qh-primary" type="button" disabled={working || (portraits?.attempts_used ?? 0) >= 3} onClick={() => void generatePortrait()}>{working ? "Painting…" : `Generate portrait ${(portraits?.attempts_used ?? 0) + 1} of 3`}</button>}
        <p className="qh-smallprint">Each generation uses a paid image model. Your limit is enforced by the server. The drawings are private, stored with your account, and shown only to you.</p>
        <div className="qh-actions"><button type="button" className="qh-quiet" onClick={goToHero}>Finish {portraits?.selected_attempt ? "and see your Hero" : "without a portrait"} →</button></div>
      </section>}
    </form>
    <footer className="qh-footer"><span>✧</span> EVERY HERO IS A NEW PAGE IN THE STORY <span>✧</span></footer>
  </div>;
}
