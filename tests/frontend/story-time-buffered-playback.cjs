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
  const events = new Map();
  const windowFake = {
    addEventListener(name, fn) { const set=events.get(name) ?? new Set(); set.add(fn); events.set(name,set); },
    removeEventListener(name, fn) { events.get(name)?.delete(fn); },
    fire(name) { for (const fn of events.get(name) ?? []) fn(); },
  };
  const context = {
    exports: {}, Promise, Map, Set, Error, Array, AbortController, window:windowFake,
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
  function completeLatest(text, voice) {
    const queue=pending.get(text) ?? [];
    const at=queue.findIndex(token => token.input.voice===voice && !token.signal.aborted);
    assert.ok(at>=0, `No active ${voice} synthesis for ${text}`);
    const token=queue.splice(at,1)[0];token.resolve({size:100,type:'audio/mpeg',text});
  }
  return { api, prefs, played, requests, states, revoked, item, complete, completeLatest, fail, finish, flush, window:windowFake, get audio() { return element; }, holdNextPlay() { deferNextPlay = true; }, unblockPlay() { releasePlay.shift()?.(); } };
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

test('room default does not override a player\'s preferred voice', async () => {
  const h = harness();
  h.api.setAdventureNarratorVoice('bm_george');
  const run = h.api.playNarration(['A','B','C'].map(h.item));
  assert.deepEqual(h.requests.map(x => x.voice), ['am_michael','am_michael','am_michael']);
  for (const text of ['A','B','C']) h.complete(text);
  await h.flush(); h.finish(); await h.flush(); h.finish(); await h.flush(); h.finish(); await run;
});


test('mid-adventure switch preserves current audio, cancels lookahead and changes the next clip', async () => {
  const h = harness();
  const run = h.api.playNarration(['A','B','C'].map(h.item));
  h.complete('A'); await h.flush();
  assert.equal(h.played.length,1);
  const oldPrefetch=h.requests.filter(x => x.text==='B' || x.text==='C');
  assert.ok(oldPrefetch.every(x => x.voice==='am_michael'));
  h.prefs.narrationVoice = 'af_bella';
  h.window.fire('tot:audio-preferences-changed');
  assert.equal(h.played.length,1, 'current A must not be interrupted');
  h.finish(); await h.flush();
  assert.ok(h.requests.some(x => x.text==='B' && x.voice==='af_bella'));
  assert.ok(h.requests.some(x => x.text==='C' && x.voice==='af_bella'));
  h.completeLatest('B','af_bella'); await h.flush();
  assert.equal(h.played.length,2);
  h.finish(); await h.flush();
  h.completeLatest('C','af_bella'); await h.flush();
  assert.equal(h.played.length,3);
  h.finish(); await run;
  assert.equal(h.states.at(-1).phase,'idle');
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

// Pass 60A: visual tracking never changes the audio chunking or narration transport.
test('audio position drives a bounded browser-only cue, pause preserves it, stop clears it', async () => {
  const h = harness();
  const run = h.api.playNarration([h.item('One. Two. Three.')]);
  h.complete('One. Two. Three.'); await h.flush();
  assert.equal(h.states.at(-1).cue.text, 'One. Two. Three.');
  assert.equal(h.states.at(-1).cue.progress, 0);
  h.audio.duration = 10;
  h.audio.currentTime = 5;
  h.audio.ontimeupdate?.();
  assert.equal(h.states.at(-1).cue.progress, 0.5);
  h.api.pauseNarration();
  assert.equal(h.states.at(-1).phase, 'paused');
  assert.equal(h.states.at(-1).cue.progress, 0.5);
  h.api.stopNarration();
  assert.equal(h.states.at(-1).cue, null);
  assert.equal(h.audio.ontimeupdate, null);
  await run;
});

test('late old-chapter audio events never overwrite the next chapter cue', async () => {
  const h = harness();
  const old = h.api.playNarration([h.item('OLD')]);
  h.complete('OLD'); await h.flush();
  const oldUpdate = h.audio.ontimeupdate;
  const newer = h.api.playNarration([h.item('NEW')]);
  h.complete('NEW'); await h.flush();
  assert.equal(h.states.at(-1).cue.text, 'NEW');
  h.audio.duration = 10;
  h.audio.currentTime = 7;
  oldUpdate?.();
  assert.equal(h.states.at(-1).cue.text, 'NEW');
  assert.equal(h.states.at(-1).cue.progress, 0);
  h.finish(); await Promise.all([old, newer]);
});

test('estimated sentence selection follows the existing cached passages and rejects stale cues', () => {
  const syncSource = fs.readFileSync(path.join(root, 'frontend/src/services/storySentenceSync.ts'), 'utf8');
  const exports = {};
  const script = stripTypeScriptTypes(syncSource)
    .replace(/export (?=(?:function|const)\s)/g, '')
    + '\nexports.sync={spokenText,splitSentencesForDisplay,visualSentenceRanges,estimateSentenceIndex};';
  vm.runInNewContext(script, { exports }, { filename: 'storySentenceSync.ts' });
  const { sync } = exports;
  const text = 'The gate opened. A shadow moved. The hero stepped forward.';
  const chunks = [sync.spokenText(text)];
  assert.equal(sync.estimateSentenceIndex(text, chunks, { index:0, text:chunks[0], progress:0 }), 0);
  assert.equal(sync.estimateSentenceIndex(text, chunks, { index:0, text:chunks[0], progress:0.5 }), 1);
  assert.equal(sync.estimateSentenceIndex(text, chunks, { index:0, text:chunks[0], progress:0.99 }), 2);
  assert.equal(sync.estimateSentenceIndex(text, chunks, { index:0, text:'OTHER SCENE', progress:0.5 }), null);
  assert.equal(sync.estimateSentenceIndex(text, chunks, { index:2, text:chunks[0], progress:0.5 }), null);
  assert.equal(sync.estimateSentenceIndex(text, chunks, null), null);
  assert.equal(sync.splitSentencesForDisplay('One. Two.\n\nThree!').length, 3);
  // Larger real chapters span multiple cached 280-character passages.
  // Tracking MUST NOT change or invalidate those existing cache boundaries.
  const longScene = Array.from({ length: 14 }, (_, i) =>
    `The travelers cross another silent bridge number ${i + 1} under a clouded sky.`).join(' ');
  const cachedChunks = hForSentenceChunks(longScene);
  assert.ok(cachedChunks.length > 1);
  assert.equal(cachedChunks.join(' '), sync.spokenText(longScene));
  assert.notEqual(sync.estimateSentenceIndex(longScene, cachedChunks,
    { index: 1, text: cachedChunks[1], progress: 0.7 }), null);
});

function hForSentenceChunks(text) {
  const h = harness();
  return h.api.splitPassage(text);
}

test('Story Time keeps the full authoritative chapter readable and does not leak unrevealed scenes', () => {
  const reveal = fs.readFileSync(path.join(root,'frontend/src/features/adventure/StoryReveal.tsx'),'utf8');
  const page = fs.readFileSync(path.join(root,'frontend/src/pages/game/AdventurePage.tsx'),'utf8');
  const narrator = fs.readFileSync(path.join(root,'frontend/src/services/storyNarrator.ts'),'utf8');
  assert.match(reveal, /sr-only/);
  assert.match(reveal, /followNarration/);
  assert.match(reveal, /estimateSentenceIndex/);
  assert.match(page, /theater\.chapterReleased && scene\?\.body/);
  assert.match(page, /FOLLOW VOICE/);
  assert.match(page, /narration\.cue/);
  assert.match(narrator, /speed: 1/);
});
