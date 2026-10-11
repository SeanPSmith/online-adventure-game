'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'frontend/src/services/storyNarrator.ts'), 'utf8');

function harness() {
  const pending = new Map();
  const requests = [];
  const played = [];
  const revoked = [];
  const states = [];
  const prefs = { narrationEnabled: true, storyTimeApproved: true, narrationVoice: 'am_michael', narrationSpeed: 1, narrationVolume: 80 };
  let deferNextPlay = false;
  const releasePlay = [];
  class FakeAudio {
    constructor() { this.paused = true; this.volume = 1; this.playbackRate = 1; this.preservesPitch = false; this.onended = null; this.onerror = null; this.src = ''; }
    async play() {
      this.paused = false; played.push(this.src);
      if (deferNextPlay) {
        deferNextPlay = false;
        await new Promise(resolve => releasePlay.push(resolve));
      }
    }
    pause() { this.paused = true; }
    finish() { this.paused = true; this.onended?.(); }
    load() {}
    removeAttribute(attribute) { if (attribute === 'src') this.src = ''; }
  }
  let element = null;
  let blobId = 0;
  const context = {
    exports: {}, Promise, Map, Set, Error, Array, AbortController,
    Audio: class extends FakeAudio { constructor() { super(); element = this; } },
    URL: { createObjectURL(blob) { return `blob:${blob.text}:${++blobId}`; }, revokeObjectURL(url) { revoked.push(url); } },
    require(name) {
      if (name === './audioPreferences') return { readAudioPreferences: () => ({ ...prefs }) };
      if (name === './storyTimeEngine') return {
        synthesizeStoryTimeSpeech: (input, signal) => new Promise((resolve, reject) => {
          requests.push(input);
          const token = { input, signal, resolve, reject };
          if (!pending.has(input.text)) pending.set(input.text, []);
          pending.get(input.text).push(token);
          signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
        }),
      };
      throw new Error(`Unexpected dependency ${name}`);
    },
  };
  const script = stripTypeScriptTypes(source)
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (?=(?:async )?(?:function|const) )/g, '')
    + '\nexports.api={NARRATION_LOOKAHEAD,observeNarration,playNarration,stopNarration,pauseNarration,resumeNarration,adjustNarrationVolume,setAdventureNarratorVoice,splitPassage};';
  vm.runInNewContext(script, context, { filename: 'storyNarrator.ts' });
  const api = context.exports.api;
  api.observeNarration(s => states.push(s));
  const item = (text) => ({ text, kind: 'story', label: `STORY ${text}` });
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
  const finish = () => element?.finish();
  function complete(text) {
    const token = pending.get(text)?.shift();
    assert.ok(token, `No pending synthesis for ${text}`);
    token.resolve({ size: 100, type: 'audio/mpeg', text });
  }
  function fail(text) {
    const token = pending.get(text)?.shift();
    assert.ok(token);
    token.reject(new Error(`Speech failed for ${text}`));
  }
  return { api, prefs, played, requests, states, revoked, item, complete, fail, finish, flush, get audio() { return element; }, holdNextPlay() { deferNextPlay = true; }, unblockPlay() { releasePlay.shift()?.(); } };
}

test('starts the first chunk as soon as available and fetches two ahead, never out of order', async () => {
  const h = harness();
  assert.equal(h.api.NARRATION_LOOKAHEAD, 2);
  const run = h.api.playNarration(['A', 'B', 'C', 'D'].map(h.item));
  assert.deepEqual(h.requests.map(x => x.text), ['A','B','C']);
  h.complete('C'); await h.flush();
  assert.equal(h.played.length, 0, 'later chunk cannot jump ahead of first');
  h.complete('A'); await h.flush();
  assert.deepEqual(h.played.map(x => x.split(':')[1]), ['A']);
  assert.equal(h.states.at(-1).phase, 'playing');
  h.finish(); await h.flush();
  assert.deepEqual(h.requests.map(x => x.text), ['A','B','C','D']);
  assert.equal(h.states.at(-1).phase, 'buffering');
  h.complete('B'); await h.flush();
  assert.deepEqual(h.played.map(x => x.split(':')[1]), ['A','B']);
  h.finish(); await h.flush();
  assert.equal(h.played.at(-1).split(':')[1], 'C');
  h.finish(); await h.flush();
  h.complete('D'); await h.flush();
  assert.equal(h.played.at(-1).split(':')[1], 'D');
  h.finish(); await run;
  assert.equal(h.states.at(-1).phase, 'idle');
});

test('pause while buffering holds the next chunk until explicit resume', async () => {
  const h = harness();
  const run = h.api.playNarration(['A','B'].map(h.item));
  h.complete('A'); await h.flush();
  h.finish(); await h.flush();
  assert.equal(h.states.at(-1).phase, 'buffering');
  h.api.pauseNarration();
  assert.equal(h.states.at(-1).phase, 'paused');
  h.complete('B'); await h.flush();
  assert.equal(h.played.length, 1);
  await h.api.resumeNarration(); await h.flush();
  assert.equal(h.played.length, 2);
  h.finish(); await run;
  assert.equal(h.states.at(-1).phase, 'idle');
});

test('pause and resume during playback do not restart synthesis or replay the chunk', async () => {
  const h = harness();
  const run = h.api.playNarration([h.item('A')]);
  h.complete('A'); await h.flush();
  h.api.pauseNarration();
  assert.equal(h.audio.paused, true);
  assert.equal(h.states.at(-1).phase, 'paused');
  await h.api.resumeNarration();
  assert.equal(h.audio.paused, false);
  assert.equal(h.states.at(-1).phase, 'playing');
  assert.equal(h.requests.length, 1);
  h.finish(); await run;
});

test('stop cancels queued work; an old scene never plays after the new one begins', async () => {
  const h = harness();
  const old = h.api.playNarration(['OLD-1','OLD-2','OLD-3'].map(h.item));
  h.api.stopNarration();
  assert.equal(h.states.at(-1).phase, 'idle');
  assert.ok(h.requests.every(x => x.voice === 'am_michael'));
  const newer = h.api.playNarration([h.item('NEW')]);
  h.complete('NEW'); await h.flush();
  assert.deepEqual(h.played, ['blob:NEW:1']);
  h.finish(); await Promise.all([old, newer]);
  assert.equal(h.states.at(-1).phase, 'idle');
});

test('changing speed and volume in the middle of audio does not generate new speech', async () => {
  const h = harness();
  const run = h.api.playNarration([h.item('A')]);
  h.complete('A'); await h.flush();
  h.prefs.narrationSpeed = 2;
  h.prefs.narrationVolume = 20;
  h.api.adjustNarrationVolume();
  assert.equal(h.audio.playbackRate, 2);
  assert.equal(h.audio.volume, 0.2);
  assert.equal(h.audio.preservesPitch, true);
  assert.equal(h.requests.length, 1);
  h.finish(); await run;
  const again = h.api.playNarration([h.item('A')]);
  await h.flush();
  assert.equal(h.requests.length, 1, 'cached audio reused regardless of speed');
  h.finish(); await again;
});

test('a failed lookahead chunk cannot interrupt an earlier playable passage', async () => {
  const h = harness();
  const run = h.api.playNarration(['A','B'].map(h.item));
  h.fail('B'); await h.flush();
  assert.equal(h.states.at(-1).phase, 'loading');
  h.complete('A'); await h.flush();
  assert.equal(h.states.at(-1).phase, 'playing');
  h.finish(); await run;
  assert.equal(h.states.at(-1).phase, 'error');
  assert.match(h.states.at(-1).error, /Speech failed for B/);
});

test('the room voice is frozen for all lookahead requests', async () => {
  const h = harness();
  h.api.setAdventureNarratorVoice('bm_george');
  const run = h.api.playNarration(['A','B','C'].map(h.item));
  h.prefs.narrationVoice = 'af_bella';
  h.api.setAdventureNarratorVoice('af_bella');
  for (const text of ['A','B','C']) h.complete(text);
  await h.flush(); h.finish(); await h.flush(); h.finish(); await h.flush(); h.finish(); await run;
  assert.deepEqual(h.requests.map(x => x.voice), ['bm_george','bm_george','bm_george']);
});


test('a superseded play() promise cannot clear the new chapter audio handlers', async () => {
  const h = harness();
  h.holdNextPlay();
  const old = h.api.playNarration([h.item('OLD')]);
  h.complete('OLD'); await h.flush();
  assert.equal(h.played.length, 1);
  h.api.stopNarration();
  const newer = h.api.playNarration([h.item('NEW')]);
  h.complete('NEW'); await h.flush();
  assert.equal(h.played.length, 2);
  const newOnEnded = h.audio.onended;
  assert.equal(typeof newOnEnded, 'function');
  h.unblockPlay(); await h.flush();
  assert.equal(h.audio.onended, newOnEnded, 'stale finally must not remove newer handler');
  h.finish(); await Promise.all([old, newer]);
  assert.equal(h.states.at(-1).phase, 'idle');
});


test('backend prefetch and browser use the same 280-character sentence boundary', () => {
  const h = harness();
  const passage = 'x'.repeat(279) + '. ' + 'The princess turned toward the gate. '.repeat(5);
  const chunks = h.api.splitPassage(passage);
  assert.equal(chunks[0].length, 280);
  assert.equal(chunks.join(' '), passage.trim());
  assert.ok(chunks.every(chunk => chunk.length <= 280));
});
