/** Quillairo Hero questionnaire. Narrative answers influence suggestions, not mechanical limits.
 * This is deliberately data-driven so future answer sets can be reviewed before shipping.
 */
import type { AppearanceAnswers, CreationRules } from "../../services/characters";

export type AppearanceKey = keyof AppearanceAnswers;
export type AnswerOption = { value: string; label: string; detail?: string };
export type AppearancePrompt = { key: AppearanceKey; label: string; options: AnswerOption[] };
export type AppearanceChapter = { title: string; subtitle: string; prompts: AppearancePrompt[] };
const option = (value: string, detail?: string): AnswerOption => ({ value, label: value, detail });

export const APPEARANCE_CHAPTERS: AppearanceChapter[] = [
  { title: "Where do you come from?", subtitle: "Your lineage sets the scene, never your starting power.", prompts: [
    { key: "species", label: "Choose a lineage", options: ["Human", "Elf", "Dwarf", "Orc", "Ogre", "Goblin", "Fae", "Beastfolk", "Android", "Alien", "Spirit", "Otherworlder"].map(v => option(v)) },
    { key: "origin", label: "Your home before the story", options: ["A crowded city", "A remote village", "A nomadic community", "The wilderness", "An ancient kingdom", "A spacefaring colony", "A hidden enclave", "Unknown origins"].map(v => option(v)) },
    { key: "age", label: "Life stage", options: ["Young adult", "Adult", "Middle-aged", "Elder", "Ageless", "Unknown age"].map(v => option(v)) },
  ] },
  { title: "What does the world see?", subtitle: "A few deliberate details build a recognizable silhouette.", prompts: [
    { key: "gender", label: "Presentation", options: ["Masculine", "Feminine", "Androgynous", "Fluid", "Unspecified"].map(v => option(v)) },
    { key: "height", label: "Stature", options: ["Very short", "Short", "Average height", "Tall", "Towering"].map(v => option(v)) },
    { key: "weight", label: "Frame", options: ["Light", "Average", "Heavy", "Not specified"].map(v => option(v)) },
    { key: "build", label: "Build", options: ["Slender", "Lean", "Athletic", "Muscular", "Stocky", "Broad", "Soft", "Otherworldly"].map(v => option(v)) },
  ] },
  { title: "The details people remember", subtitle: "Choose visual cues for your original ink illustration.", prompts: [
    { key: "skin", label: "Skin, scales or markings", options: ["Light complexion", "Medium complexion", "Deep complexion", "Warm brown complexion", "Freckled", "Scarred or tattooed", "Scales or patterned skin", "Metal or synthetic finish", "Luminescent markings"].map(v => option(v)) },
    { key: "hair", label: "Hair or defining features", options: ["Short dark hair", "Long dark hair", "Light or silver hair", "Curly hair", "Braided hair", "Shaved or bald", "Horns or antlers", "Fur or feathers", "Synthetic or alien features"].map(v => option(v)) },
    { key: "face", label: "Expression", options: ["Kind and curious", "Determined", "Cautious and observant", "Mischievous", "Calm and unreadable", "World-weary", "Radiantly optimistic"].map(v => option(v)) },
    { key: "defining_detail", label: "Signature detail", options: ["A worn keepsake", "A distinctive scar", "A family emblem", "Unusual eyes", "A carved talisman", "A mechanical prosthesis", "A cherished book", "No singular feature"].map(v => option(v)) },
  ] },
  { title: "How do you travel?", subtitle: "Your outfit and outlook complete the initial portrait brief.", prompts: [
    { key: "attire", label: "Clothing and gear", options: ["Travel-worn cloak", "Simple everyday clothes", "Practical explorer's gear", "Ceremonial robes", "Leather armor", "Knightly armor", "Field scientist's kit", "Futuristic flight suit", "Elegant formal wear"].map(v => option(v)) },
    { key: "disposition", label: "How you carry yourself", options: ["Warm and open", "Quietly observant", "Bold and direct", "Playful and irreverent", "Cautious but kind", "Intense and focused"].map(v => option(v)) },
    { key: "motivation", label: "What brought you to this journey?", options: ["Protect someone", "Find belonging", "Discover the unknown", "Set right an old mistake", "Prove myself", "Build something lasting", "Make a better world", "Simply survive"].map(v => option(v)) },
  ] },
];

export type QuizOption = { id: string; label: string; detail: string; stat: string; skills: string[]; trait: string; calling?: string };
export type QuizQuestion = { id: string; title: string; scene: string; options: QuizOption[] };
const answer = (id: string, label: string, detail: string, stat: string, skills: string[], trait: string, calling?: string): QuizOption => ({id,label,detail,stat,skills,trait,calling});
export const PERSONALITY_QUESTIONS: QuizQuestion[] = [
  { id: "storm", title: "The sky turns black", scene: "Your party is hours from shelter when the storm arrives. What do you do first?", options: [
    answer("shelter","Build a shelter","Make sure everyone has somewhere safe.","strength",["survival","athletics"],"Protective"),
    answer("trail","Find a faster path","There must be a way through.","perception",["navigation","awareness"],"Adventurous"),
    answer("plan","Study the conditions","Look for the safest window.","intellect",["investigation","knowledge"],"Thoughtful"),
    answer("steady","Keep everyone calm","Panic is the greater danger.","presence",["persuasion","insight"],"Compassionate"),
  ] },
  { id: "door", title: "A door with no key", scene: "A sealed ruin stands between you and a vital clue.", options: [
    answer("force","Test its strength","Sometimes the direct way works.","strength",["athletics","brawl"],"Resolute"),
    answer("slip","Seek a hidden entrance","Silence can solve what force cannot.","agility",["stealth","sleight"],"Inventive"),
    answer("runes","Read the inscription","Every lock has a history.","intellect",["investigation","knowledge"],"Curious"),
    answer("guide","Ask the local guide","People are a source of knowledge.","presence",["persuasion","insight"],"Social"),
  ] },
  { id: "stranger", title: "Someone asks for help", scene: "An injured stranger is sitting beside the road as sunset approaches.", options: [
    answer("aid","Stop and tend their wounds","Help first, questions later.","intellect",["medicine","insight"],"Empathetic"),
    answer("guard","Stand watch","Someone needs to keep the road safe.","willpower",["awareness","discipline"],"Loyal"),
    answer("ask","Hear their story","Know the truth before choosing.","presence",["insight","persuasion"],"Understanding"),
    answer("track","Search for the cause","Prevent anyone else getting hurt.","perception",["survival","navigation"],"Observant"),
  ] },
  { id: "machine", title: "A machine no one understands", scene: "Its lights pulse and the doors are beginning to close.", options: [
    answer("decode","Decode the controls","There is a pattern here.","intellect",["technology","investigation"],"Analytical"),
    answer("dash","Leap through the opening","A quick chance is still a chance.","agility",["acrobatics","sleight"],"Daring"),
    answer("listen","Watch and listen","The machine is telling us something.","perception",["awareness","technology"],"Patient"),
    answer("risk","Trust your instincts","Not every answer can be calculated.","luck",["navigation","composure"],"Spontaneous"),
  ] },
  { id: "conflict", title: "Two friends disagree", scene: "Both have persuasive plans, and neither will back down.", options: [
    answer("mediate","Find common ground","No one should have to lose.","presence",["persuasion","insight"],"Diplomatic"),
    answer("evidence","Compare the facts","There is a way to test both plans.","intellect",["investigation","knowledge"],"Methodical"),
    answer("decide","Make the hard call","Someone has to lead.","willpower",["discipline","composure"],"Decisive"),
    answer("adapt","Propose a third path","Why choose between bad options?","luck",["navigation","sleight"],"Creative"),
  ] },
  { id: "danger", title: "The bridge is breaking", scene: "One companion is stranded on the far side.", options: [
    answer("reach","Go back for them","No one gets left behind.","strength",["athletics","discipline"],"Brave"),
    answer("rope","Find a clever rescue","Use the tools we have.","agility",["acrobatics","survival"],"Resourceful"),
    answer("route","Spot another crossing","There is always more than one route.","perception",["navigation","awareness"],"Practical"),
    answer("coordinate","Organize everyone","Together we'll make this work.","presence",["persuasion","composure"],"Steady"),
  ] },
  { id: "secret", title: "You learn a dangerous secret", scene: "The truth could help your friends but harm an innocent person.", options: [
    answer("protect","Protect the innocent","Truth needs compassion.","willpower",["discipline","insight"],"Principled"),
    answer("share","Tell the party","Trust grows through honesty.","presence",["persuasion","composure"],"Honest"),
    answer("study","Investigate further","We don't know enough yet.","intellect",["investigation","knowledge"],"Careful"),
    answer("observe","Wait for the right moment","Timing changes everything.","perception",["awareness","stealth"],"Watchful"),
  ] },
  { id: "legacy", title: "How will they remember you?", scene: "Many years from now, which story would you want told about your Hero?", options: [
    answer("guardian","They kept us safe","Courage where it mattered.","willpower",["discipline","awareness"],"Guardian","Guardian"),
    answer("healer","They helped us heal","Compassion at the hardest moment.","intellect",["medicine","insight"],"Healer","Healer"),
    answer("scholar","They found the answer","The mystery became a discovery.","intellect",["knowledge","investigation"],"Scholar","Scholar"),
    answer("guide","They showed us the way","No road was truly impassable.","perception",["navigation","survival"],"Wayfinder","Wayfinder"),
    answer("speaker","They made us believe","Words turned fear into hope.","presence",["persuasion","performance"],"Envoy","Envoy"),
  ] },
];

export function quizSummary(responses: Record<string,string>) {
  const resolved = PERSONALITY_QUESTIONS.flatMap(q => {
    const opt=q.options.find(o=>o.id===responses[q.id]); return opt?[opt]:[];
  });
  const ranking = (values:string[]) => Object.entries(values.reduce<Record<string,number>>((acc,v)=>{acc[v]=(acc[v]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  return { stats: ranking(resolved.map(o=>o.stat)), skills: ranking(resolved.flatMap(o=>o.skills)), traits: [...new Set(resolved.map(o=>o.trait))], calling: resolved.find(o=>o.calling)?.calling || "Wayfinder", complete: resolved.length===PERSONALITY_QUESTIONS.length };
}

export function suggestedBuild(rules: CreationRules, responses: Record<string,string>) {
  const preference = quizSummary(responses);
  function allocate(defs:{id:string}[],minimum:number,maximum:number,budget:number,preferred:string[]) {
    const result:Record<string,number>=Object.fromEntries(defs.map(x=>[x.id,minimum]));
    let remaining=Math.max(0,budget-defs.length*minimum);
    const valid=preferred.filter(id=>id in result);
    // Fill primary strengths first, then balance remaining points across every rule-defined entry.
    const order=[...new Set([...valid,...defs.map(d=>d.id)])];
    while(remaining>0) {let moved=false;for(const id of order) {if(remaining<=0)break;if(result[id]<maximum){result[id]++;remaining--;moved=true;}}if(!moved)break;}
    return result;
  }
  return { stats: allocate(rules.stats,rules.stat_min,rules.stat_max,rules.stat_point_budget,preference.stats), skills: allocate(rules.skills,rules.skill_min,rules.skill_max,rules.skill_point_budget,preference.skills) };
}
