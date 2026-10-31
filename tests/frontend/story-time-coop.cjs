'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function newGuard() {
  const source = stripTypeScriptTypes(read('frontend/src/services/storyAutoReadGate.ts'))
    .replace(/export (?=function )/g, '');
  const context = { exports: {}, Boolean };
  vm.runInNewContext(source + '\nexports.create = createAutoReadGate;', context);
  return context.exports.create();
}

test('first resumed snapshot of an existing chapter does not auto-read', () => {
  const gate = newGuard();
  gate.observe('ROOMA', false, 'ROOMA:7:chapter-7');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:7:chapter-7'), false);
  gate.observe('ROOMA', true, 'ROOMA:7:chapter-7');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:7:chapter-7'), false);
  gate.observe('ROOMA', true, 'ROOMA:7:chapter-7');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:7:chapter-7'), false);
});

test('fresh lobby arms first new chapter without treating lobby as chapter', () => {
  const gate = newGuard();
  gate.observe('ROOMA', true, '');
  assert.equal(gate.isNewScene('ROOMA',''), false);
  assert.equal(gate.isNewScene('ROOMA','ROOMA:1:chapter-1'), true);
});

test('reconnecting never auto-reads an already advanced scene', () => {
  const gate = newGuard();
  gate.observe('ROOMA', true, 'ROOMA:3:chapter-3');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:4:chapter-4'), true);
  gate.observe('ROOMA', false, 'ROOMA:4:chapter-4');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:4:chapter-4'), false);
  gate.observe('ROOMA', true, 'ROOMA:4:chapter-4');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:4:chapter-4'), false,
    'restored scene is not a newly revealed chapter');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:5:chapter-5'), true,
    'future live chapter still auto-reads');
});

test('room change discards prior admission and baselines restored room', () => {
  const gate = newGuard();
  gate.observe('ROOMA', true, 'ROOMA:3:chapter-3');
  gate.observe('ROOMB', false, 'ROOMB:6:chapter-6');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:4:chapter-4'), false);
  gate.observe('ROOMB', true, 'ROOMB:6:chapter-6');
  assert.equal(gate.isNewScene('ROOMB','ROOMB:6:chapter-6'), false);
  assert.equal(gate.isNewScene('ROOMB','ROOMB:7:chapter-7'), true);
});

test('snapshots without an authoritative ready state cannot establish baseline', () => {
  const gate = newGuard();
  gate.observe('ROOMA', false, 'ROOMA:2:a');
  gate.observe('ROOMA', false, 'ROOMA:3:b');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:3:b'), false);
  gate.observe('ROOMA', true, 'ROOMA:3:b');
  assert.equal(gate.isNewScene('ROOMA','ROOMA:3:b'), false);
});

test('two browsers have independent auto-read guards even in same shared room', () => {
  const host = newGuard();
  const guest = newGuard();
  host.observe('ROOMA', true, '');
  guest.observe('ROOMA', true, 'ROOMA:1:scene1');
  assert.equal(host.isNewScene('ROOMA','ROOMA:1:scene1'), true);
  assert.equal(guest.isNewScene('ROOMA','ROOMA:1:scene1'), false);
  assert.equal(guest.isNewScene('ROOMA','ROOMA:2:scene2'), true);
});

test('frontend lets each participant control voice while preserving local speed and volume', () => {
  const page = read('frontend/src/pages/game/AdventurePage.tsx');
  const narrator = read('frontend/src/services/storyNarrator.ts');
  const context = read('frontend/src/state/GameSocketContext.tsx');
  const backend = read('app/main.py');
  assert.match(context, /narration_voice: readAudioPreferences\(\)\.narrationVoice/);
  assert.match(backend, /session\.narrator_voice = proposed_voice/);
  assert.match(page, /setAdventureNarratorVoice\(live\.game\?\.narrator_voice/);
  assert.match(page, /Your voice · \{narratorVoiceLabel/);
  assert.match(page, /NarratorVoicePicker/);
  assert.match(narrator, /readAudioPreferences\(\)\.narrationVoice \|\| adventureVoice/);
  assert.match(narrator, /audio\.playbackRate = prefs\.narrationSpeed/);
  assert.match(narrator, /audio\.volume = prefs\.narrationVolume \/ 100/);
  assert.match(narrator, /speed: 1/);
});

test('reconnect and offline actions stop audio and never allow hidden narration', () => {
  const page = read('frontend/src/pages/game/AdventurePage.tsx');
  assert.match(page, /if \(!connected \|\| live\.status !== "ready"\) stopNarration\(\)/);
  assert.match(page, /autoReadGate\.current\.isNewScene/);
  assert.match(page, /sessionStorage\.getItem\(key\)/);
  assert.match(page, /!connected \|\| live\.status !== "ready" \|\| !audioPreferences\.narrationEnabled \|\| !theater\.chapterReleased \|\| !scene\?\.body/);
  assert.match(page, /!connected \|\| live\.status !== "ready" \|\| !audioPreferences\.narrationEnabled/);
  assert.match(page, /theater\.chapterReleased/);
});

test('voice selector explains that each participant picks their own narrator', () => {
  assert.match(read('frontend/src/pages/account/SettingsPage.tsx'), /YOUR NARRATOR/);
  assert.match(read('frontend/src/pages/account/SettingsPage.tsx'), /independently of the host/);
});
