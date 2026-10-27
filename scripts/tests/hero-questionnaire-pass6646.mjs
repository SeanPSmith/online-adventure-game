/** Offline acceptance checks; run with: node --experimental-strip-types scripts/tests/hero-questionnaire-pass6646.mjs */
import assert from "node:assert/strict";
import { APPEARANCE_CHAPTERS, PERSONALITY_QUESTIONS, suggestedBuild, quizSummary } from "../../frontend/src/pages/heroes/heroQuestionnaire.ts";
assert.equal(APPEARANCE_CHAPTERS.length,4);
assert.equal(PERSONALITY_QUESTIONS.length,8);
const fields=APPEARANCE_CHAPTERS.flatMap(c=>c.prompts);
assert.equal(new Set(fields.map(f=>f.key)).size,fields.length,'each appearance field occurs once');
for(const field of fields){assert(field.options.length>=4,`curated choices for ${field.key}`);assert.equal(new Set(field.options.map(o=>o.value)).size,field.options.length);}
for(const q of PERSONALITY_QUESTIONS){assert(q.options.length>=4,`four outcomes for ${q.id}`);assert(q.options.every(o=>o.stat&&o.skills.length&&o.trait));}
const rules={ stats:['strength','agility','intellect','perception','presence','willpower','luck'].map(id=>({id})), skills:['athletics','acrobatics','stealth','investigation','knowledge','technology','awareness','survival','persuasion','deception','intimidation','discipline','brawl','sleight','medicine','mechanics','navigation','insight','performance','composure'].map(id=>({id})), stat_min:0,stat_max:3,skill_min:0,skill_max:2,stat_point_budget:9,skill_point_budget:8 };
for(const select of [0,1,2,3]) {
 const responses=Object.fromEntries(PERSONALITY_QUESTIONS.map(q=>[q.id,q.options[Math.min(select,q.options.length-1)].id]));
 const profile=quizSummary(responses);const build=suggestedBuild(rules,responses);
 assert.equal(profile.complete,true);
 assert.equal(Object.values(build.stats).reduce((a,b)=>a+b,0),9);
 assert.equal(Object.values(build.skills).reduce((a,b)=>a+b,0),8);
 assert(Object.values(build.stats).every(n=>n>=0&&n<=3));
 assert(Object.values(build.skills).every(n=>n>=0&&n<=2));
 assert(profile.calling);
}
const empty=quizSummary({});assert.equal(empty.complete,false);
console.log('PASS: curated questions, profile outcomes, valid mechanical budgets, incomplete quiz gate');
