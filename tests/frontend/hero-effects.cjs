"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const tsPath = path.join(root, "frontend/src/features/adventure/heroEffects.ts");
const compiler = path.join(root, "frontend/node_modules/.bin/tsc");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "quillairo-effects-"));
let helpers;
try {
  execFileSync(fs.existsSync(compiler) ? compiler : "tsc", [
    "--strict", "--skipLibCheck", "--module", "commonjs", "--target", "es2022",
    "--outDir", temp, tsPath,
  ], { stdio: "pipe" });
  helpers = require(path.join(temp, "heroEffects.js"));
} finally {
  process.on("exit", () => fs.rmSync(temp, { recursive: true, force: true }));
}

const { activeHeroEffects, heroEffectModifiers, heroEffectDuration, heroEffectName } = helpers;

test("displays only live server-owned effects; legacy zero budgets do not masquerade as buffs", () => {
  const current = { effect_id: "a", name: "Sly Focus", active: true, remaining_checks: 1, remaining_turns: 2 };
  assert.deepEqual(activeHeroEffects([current, {name:"Old",active:false}, {name:"Spent",remaining_checks:0}, {name:"Lapsed",remaining_turns:0}, {}, null]), [current, {}]);
  assert.deepEqual(activeHeroEffects([]), []);
  assert.deepEqual(activeHeroEffects(undefined), []);
});

test("reports both checks and turn lifetimes without suggesting they stack", () => {
  assert.equal(heroEffectDuration({remaining_turns:2,remaining_checks:1}), "2 turns left · 1 check left");
  assert.equal(heroEffectDuration({remaining_checks:3}), "3 checks left");
  assert.equal(heroEffectDuration({permanence:"permanent"}), "Permanent");
  assert.equal(heroEffectDuration({}), "Active");
  assert.equal(heroEffectName({name:"" ,effect_id:"misty_guard"}), "misty guard");
});

test("effect values remain read-only and visually bounded to the server per-effect limit", () => {
  const input = {stat_modifiers: {strength:9, dexterity:-8}, skill_modifiers: {stealth:1, bogus:NaN}};
  assert.deepEqual(heroEffectModifiers(input), ["STRENGTH +2 · STAT", "DEXTERITY -2 · STAT", "STEALTH +1 · SKILL"]);
  assert.equal(input.stat_modifiers.strength, 9);
});

test("every major Hero surface uses the same effect ledger", () => {
  const expected = [
    "frontend/src/pages/game/InkboundLiveRoom.tsx",
    "frontend/src/pages/game/AdventurePage.tsx",
    "frontend/src/pages/heroes/HeroSheetPage.tsx",
  ];
  for (const file of expected) {
    assert.match(fs.readFileSync(path.join(root, file), "utf8"), /<HeroEffectList/);
  }
  assert.match(fs.readFileSync(path.join(root,"frontend/src/features/adventure/TurnResolutionTheater.tsx"),"utf8"),/<HeroEffectDetails/);
  assert.match(fs.readFileSync(path.join(root,"frontend/src/features/adventure/LevelUpModal.tsx"),"utf8"),/<HeroEffectDetails/);
});
