const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const read = (name) => readFileSync(path.join(root, name), 'utf8');

const warSource = read('frontend/src/features/arcade/games/warRules.ts');
const warContext = { crypto: webcrypto, Uint32Array, Math, RangeError, module: { exports: {} } };
vm.runInNewContext(stripTypeScriptTypes(warSource).replace(/^export /gm, '') + '\nmodule.exports = { shuffleWarCards, resolveWarWinner };', warContext);
const war = warContext.module.exports;

test('War starts only on exactly equal ranks and has no fixed house-winning rule', () => {
  const {resolveWarWinner} = war;
  assert.equal(resolveWarWinner(10, 6), 'player');
  assert.equal(resolveWarWinner(6, 10), 'enemy');
  let playerWins = 0;
  for (let i=0; i<2000; i++) if (resolveWarWinner(6,6)==='player') playerWins++;
  assert.ok(playerWins > 840 && playerWins < 1160, `exhausted war tie must be approximately fair; got ${playerWins}/2000`);
  const view = read('frontend/src/features/arcade/games/WarCardGame.tsx');
  assert.match(view,/while \(mine\.value === theirs\.value && player\.length && enemy\.length\)/);
  assert.match(view,/openingMine/);
  assert.match(view,/setPlayerCard\(result\.openingMine\)/);
});

test('independent 52-card War decks are never seeded from the room turn', () => {
  const {shuffleWarCards} = war;
  const original=Array.from({length:52},(_,i)=>i);
  const a=shuffleWarCards(original), b=shuffleWarCards(original);
  assert.deepEqual([...a].sort((x,y)=>x-y),original);
  assert.deepEqual([...b].sort((x,y)=>x-y),original);
  assert.notDeepEqual(a,b,'independent randomized shuffles should not repeat');
  const src=read('frontend/src/features/arcade/games/WarCardGame.tsx');
  assert.doesNotMatch(src,/seededShuffle/);
  assert.match(src,/shuffleWarCards\(pot\)/);
});

test('dice cycles apparent faces and settles only on the committed check', () => {
  const src=read('frontend/src/features/adventure/TurnResolutionTheater.tsx');
  assert.match(src,/setDisplayRoll\(cosmeticD20Face\(\)\)/);
  assert.doesNotMatch(src,/Math\.random\(\)/);
  assert.match(src,/setDisplayRoll\(check\.roll\)/);
  assert.doesNotMatch(src,/setDisplayRoll\("\?"\)/);
});

test('re-sync stays optional during writing and never interrupts the story-ready countdown', () => {
  const src=read('frontend/src/features/adventure/TurnTheater.tsx');
  // Normal writing exposes recovery after 30 seconds; a stuck story-ready
  // countdown exposes it after 10. Neither threshold triggers a reroll.
  assert.match(src,/readyWithoutExit\s*\?\s*10000\s*:\s*30000/);
  assert.match(src,/if \(theater\.phase !== "intermission" && !readyWithoutExit\) return;/);
  assert.match(src,/return \(\) => window\.clearTimeout\(timer\);/);
  assert.match(src,/onClick=\{onSync\}/);
  assert.match(src,/onSync=\{showResync \? onSync : undefined\}/);
});

test('narration never causes chapter words to vanish and restart', () => {
  const src=read('frontend/src/features/adventure/StoryReveal.tsx');
  assert.match(src,/const animate = enabled && !prefersReducedMotion\(\)/);
  assert.doesNotMatch(src,/enabled && !followNarration/);
  assert.match(src,/setVisibleWords\(\(current\) => Math\.max/);
  assert.match(src,/sentence\.text\.split/);
  assert.match(src,/className=\{`story-reveal-word/);
});

test('Arcade effects use existing opt-in SFX mixer', () => {
  const audio = read('frontend/src/features/arcade/engine/ArcadeFeedback.tsx');
  assert.match(audio,/playSound\("arcade"\)/);
  assert.match(read('frontend/src/services/audioDirector.ts'),/settings\.effectsEnabled/);
});

test('QTE is a temporary stat effect, never a chapter epilogue', () => {
  const page=read('frontend/src/pages/game/AdventurePage.tsx');
  const director=read('app/generation/director.py');
  assert.doesNotMatch(page,/qte-choice-consequence/);
  assert.doesNotMatch(page,/localReaction/);
  assert.match(director,/recent_micro_events is UI-only reaction history/);
  assert.match(director,/never determine/);
});


test('cosmetic dice animation is isolated from server-authoritative roll outcomes', () => {
  const src = read('frontend/src/features/adventure/diceAnimation.ts');
  assert.match(src, /DISPLAY ONLY/);
  assert.doesNotMatch(src, /TurnResult\.check\.roll\s*=/);
  const values = [0, 0.5, 0.9999999999];
  const context = { Math: { floor: Math.floor, random: () => values.shift() }, module: { exports: {} } };
  vm.runInNewContext(stripTypeScriptTypes(src).replace(/^export /gm, '') + '\nmodule.exports = { cosmeticD20Face };', context);
  assert.deepEqual([context.module.exports.cosmeticD20Face(), context.module.exports.cosmeticD20Face(), context.module.exports.cosmeticD20Face()], [1, 11, 20]);
});
