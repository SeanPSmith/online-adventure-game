// Node-only tests for the browser SFX engine. No external dependencies, real audio, or microphone.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.join(__dirname, '../..');
const local = new Map(), session = new Map(), events = [];
let visibilityState = 'visible';
let count = 0;
class FakeAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 10; this.destination = {}; }
  createOscillator() {
    const osc = { frequency: {setValueAtTime() {}}, connect() {}, disconnect() {},
      start() { count++; }, stop() {}, onended: null };
    return osc;
  }
  createGain() { return {gain: {setValueAtTime(){}, exponentialRampToValueAtTime(){}}, connect(){}, disconnect(){}}; }
  close() { this.state = 'closed'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
const context = {
  localStorage: {getItem:k=>local.get(k)??null, setItem:(k,v)=>local.set(k,v)},
  sessionStorage: {getItem:k=>session.get(k)??null, setItem:(k,v)=>session.set(k,v)},
  window: {AudioContext: FakeAudioContext, dispatchEvent:e=>events.push(e)},
  CustomEvent: class {constructor(type,options){this.type=type;this.detail=options.detail;}},
  document: {get visibilityState(){return visibilityState;}},
  exports: {},
  Date, Math, JSON, Number, String, Boolean, Object, Set, Map,
};
function load(relative, deps = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const names = [...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(x=>x[1]);
  const compiled = stripTypeScriptTypes(source)
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (?=(?:async )?(?:function|const) )/g, '')
    + '\n' + names.map(name => `exports.${name} = ${name};`).join('\n');
  const exports = {};
  vm.runInNewContext(compiled, {...context, exports, require: name=> {
    if (!(name in deps)) throw Error('Unknown module '+name);
    return deps[name];
  }}, {filename: relative});
  return exports;
}
const prefs = load('frontend/src/services/audioPreferences.ts');
const sfx = load('frontend/src/services/audioDirector.ts', {'./audioPreferences':prefs});

test('sound is opt-in and no AudioContext is created without a user gesture', () => {
  assert.equal(prefs.readAudioPreferences().effectsEnabled, false);
  assert.equal(sfx.playSound('chapter', 'room:0:chapter'), false);
  assert.equal(count, 0);
});

test('settings normalize corrupted input and persist volume controls', () => {
  local.set('tot:audio-preferences-v1', '{garbled');
  assert.equal(prefs.readAudioPreferences().effectsEnabled, false);
  const saved = prefs.writeAudioPreferences({effectsEnabled:true,masterVolume:250,effectsVolume:-10,arcadeVolume:43});
  assert.equal(saved.masterVolume,100);
  assert.equal(saved.effectsVolume,0);
  assert.equal(saved.arcadeVolume,43);
  assert.equal(events.at(-1).type, 'tot:audio-preferences-changed');
});

test('a real gesture unlocks SFX; event ID is idempotent across repeated snapshots', () => {
  prefs.writeAudioPreferences({effectsEnabled:true,masterVolume:80,effectsVolume:65});
  assert.equal(sfx.activateAudioFromGesture(), true);
  assert.equal(sfx.playSound('dice-roll','room:5:hero:rolling'), true);
  const played = count;
  assert.ok(played > 0);
  assert.equal(sfx.playSound('dice-roll','room:5:hero:rolling'), false);
  assert.equal(count,played);
  assert.equal(session.get('tot:sound:room:5:hero:rolling'),'1');
  assert.equal(sfx.playSound('dice-roll','room:6:hero:rolling'), true);
  assert.ok(count > played);
});

test('muted, backgrounded and zero-volume pages are silent and do not burn receipt IDs', () => {
  const key = 'room:9:hero:death';
  prefs.writeAudioPreferences({effectsEnabled:false});
  assert.equal(sfx.playSound('death',key),false);
  prefs.writeAudioPreferences({effectsEnabled:true,masterVolume:0});
  assert.equal(sfx.playSound('death',key),false);
  prefs.writeAudioPreferences({masterVolume:80});
  visibilityState='hidden';
  assert.equal(sfx.playSound('death',key),false);
  visibilityState='visible';
  assert.equal(sfx.playSound('death',key),true);
  assert.equal(sfx.playSound('death',key),false);
});

test('all documented cues are valid and independent Arcade mixer can mute cabinets', () => {
  prefs.writeAudioPreferences({effectsEnabled:true,masterVolume:80,arcadeVolume:0});
  assert.equal(sfx.playSound('arcade','arcade:2'),false);
  prefs.writeAudioPreferences({arcadeVolume:55});
  for (const cue of ['ui','chapter','lock','dice-roll','success','failure','critical',
    'critical-fail','xp','level-up','injury','death','qte-start','qte-success',
    'qte-neutral','qte-fail','arcade']) {
    assert.equal(sfx.playSound(cue,`catalog:${cue}`),true, cue);
  }
});
