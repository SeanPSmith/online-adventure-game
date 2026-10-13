'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function harness() {
  const played = [];
  const snapshots = [];
  const requests = [];
  const preferences = { narrationEnabled: true, storyTimeApproved: true, narrationVoice: 'am_michael', narrationVolume: 80,
    narrationSpeed: 2, narrationDramaticPacing: true };
  let element;
  let nextBlob = 0;
  class FakeAudio {
    constructor() { this.src = ''; this.onended = null; this.onerror = null; this.ontimeupdate = null; this.paused = true; element = this; }
    play() { this.paused = false; played.push(this.src); return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    finish() { this.onended?.(); }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
  }
  const exports = {};
  const source = stripTypeScriptTypes(read('frontend/src/services/storyNarrator.ts'))
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (?=(?:async )?(?:function|const) )/g, '')
    + '\nexports.api={narrationTransitionMs,playNarration,stopNarration,pauseNarration,resumeNarration,observeNarration};';
  const context = {
    exports, Map, Set, Promise, Array, Error, AbortController, Date, setTimeout, clearTimeout,
    Audio: FakeAudio,
    URL: { createObjectURL: () => `blob:${++nextBlob}`, revokeObjectURL: () => {} },
    require(name) {
      if (name === './audioPreferences') return { readAudioPreferences: () => ({ ...preferences }) };
      if (name === './storyTimeEngine') return {
        synthesizeStoryTimeSpeech: async (input) => {
          requests.push(input);
          return { size: 22, type: 'audio/mpeg' };
        },
      };
      throw new Error(`Unexpected dependency ${name}`);
    },
  };
  vm.runInNewContext(source, context, { filename: 'storyNarrator.ts' });
  exports.api.observeNarration(s => snapshots.push(s));
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
  return { api: exports.api, preferences, played, requests, snapshots, flush,
    get element() { return element; } };
}

const story = (text, label = 'STORY 1/2') => ({ kind: 'story', label, text });
const choice = (text, label) => ({ kind: 'choice', label, text });

test('dramatic beats only happen at story-to-choice and between distinct choices', () => {
  const { api } = harness();
  const f = api.narrationTransitionMs;
  assert.equal(f(undefined, story('A'), true, 1), 0);
  assert.equal(f(story('A'), story('B', 'STORY 2/2'), true, 1), 0);
  assert.equal(f(story('A'), choice('Choice 1', 'CHOICE 1'), true, 1), 480);
  assert.equal(f(story('A'), choice('Choice 1', 'CHOICE 1'), true, 2), 240);
  assert.equal(f(choice('A', 'CHOICE 1'), choice('B', 'CHOICE 1'), true, 1), 0);
  assert.equal(f(choice('A', 'CHOICE 1'), choice('C', 'CHOICE 2'), true, 1), 280);
  assert.equal(f(choice('A', 'CHOICE 1'), choice('C', 'CHOICE 2'), false, 1), 0);
  assert.equal(f(story('A'), choice('B', 'CHOICE 1'), true, Number.NaN), 480);
});

test('normal story chunks play back-to-back without artificial silence', async () => {
  const h = harness();
  const run = h.api.playNarration([story('First'), story('Second', 'STORY 2/2')]);
  await h.flush();
  assert.equal(h.played.length, 1);
  h.element.finish(); await h.flush();
  assert.equal(h.played.length, 2);
  h.element.finish(); await run;
  assert.equal(h.requests.length, 2);
  assert.ok(h.requests.every(req => req.speed === 1));
});

test('paced transition can be stopped immediately without playing a hidden choice', async () => {
  const h = harness();
  const run = h.api.playNarration([story('Chapter'), choice('Option 1', 'CHOICE 1')]);
  await h.flush();
  h.element.finish(); await h.flush();
  assert.equal(h.played.length, 1);
  assert.match(h.snapshots.at(-1).label, /BREATH \/\//);
  h.api.stopNarration();
  await run;
  assert.equal(h.played.length, 1);
  assert.equal(h.snapshots.at(-1).phase, 'idle');
});

test('pause during the transition holds choices until resume', async () => {
  const h = harness();
  const run = h.api.playNarration([story('Chapter'), choice('Option 1', 'CHOICE 1')]);
  await h.flush();
  h.element.finish(); await h.flush();
  h.api.pauseNarration();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(h.played.length, 1, 'a paused local breath cannot advance audio');
  assert.equal(h.snapshots.at(-1).phase, 'paused');
  await h.api.resumeNarration();
  await new Promise(resolve => setTimeout(resolve, 330)); await h.flush();
  assert.equal(h.played.length, 2, 'choice resumes after remaining local beat');
  h.element.finish(); await run;
});

test('pacing is browser-local and never changes narration request or cached chunk', async () => {
  const h = harness();
  h.preferences.narrationDramaticPacing = false;
  const run = h.api.playNarration([story('Chapter'), choice('Option 1', 'CHOICE 1')]);
  await h.flush(); h.element.finish(); await h.flush();
  assert.equal(h.played.length, 2, 'pacing OFF removes only the transition beat');
  h.element.finish(); await run;
  assert.deepEqual(h.requests.map(x => [x.text, x.speed]), [['Chapter',1], ['Option 1',1]]);
});

test('pacing controls and dialogue display are wired without modifying story text', () => {
  const page = read('frontend/src/pages/game/AdventurePage.tsx');
  const settings = read('frontend/src/pages/account/SettingsPage.tsx');
  const prefs = read('frontend/src/services/audioPreferences.ts');
  const reveal = read('frontend/src/features/adventure/StoryReveal.tsx');
  assert.match(page, /PACE \{audioPreferences\.narrationDramaticPacing \? "ON" : "OFF"\}/);
  assert.match(settings, /DRAMATIC PACING \/\/ BREATH BETWEEN CHOICES/);
  assert.match(prefs, /narrationDramaticPacing: true/);
  assert.match(reveal, /story-dialogue-paragraph/);
  assert.match(reveal, /\{sentence\.text\}/);
  assert.match(reveal, /\{token\}/);
});
