'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = async () => { for (let i = 0; i < 8; ++i) await new Promise(resolve => setImmediate(resolve)); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function moduleScript(file, names) {
  return stripTypeScriptTypes(read(file))
    .replace('import.meta.env.VITE_API_BASE', '""')
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (?=(?:async )?(?:function|const) )/g, '')
    + '\nexports.api={' + names.join(',') + '};';
}
function narratorHarness() {
  const states = [];
  const waiting = new Map();
  const playing = [];
  const calls = [];
  let player;
  let heldPlay = null;
  class AudioFake {
    constructor() { this.src = ''; this.onended = null; this.onerror = null; this.ontimeupdate = null; player = this; }
    play() {
      playing.push(this.src);
      if (heldPlay) { const captured = heldPlay; heldPlay = null; return captured.promise; }
      return Promise.resolve();
    }
    pause() {}
    load() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    finish() { this.onended?.(); }
    fail() { this.onerror?.(); }
  }
  const prefs = { narrationEnabled:true, storyTimeApproved:true, narrationSpeed:1, narrationVolume:70, narrationVoice:'am_michael', narrationDramaticPacing:false };
  const context = { exports:{}, Promise, Map, Set, Array, Date, Math, Number, Error, AbortController, setTimeout, clearTimeout,
    Audio:AudioFake,
    URL:{ createObjectURL:blob=>'blob:'+blob.text, revokeObjectURL:()=>{} },
    require(module) {
      if (module === './audioPreferences') return { readAudioPreferences:()=>({ ...prefs }) };
      if (module === './storyTimeEngine') return { synthesizeStoryTimeSpeech:(item, signal)=>{
        calls.push({item,signal});
        const d=deferred();
        waiting.set(item.text,d);
        signal.addEventListener('abort',()=>d.reject(Error('cancelled')), {once:true});
        return d.promise;
      }};
      throw Error('Unexpected '+module);
    },
  };
  vm.runInNewContext(moduleScript('frontend/src/services/storyNarrator.ts',
    ['playNarration','stopNarration','observeNarration']), context);
  context.exports.api.observeNarration(s=>states.push(s));
  return { api:context.exports.api, states, calls, playing,
    hold() { heldPlay=deferred(); return heldPlay; },
    speech(text) { assert.ok(waiting.get(text),`missing speech request ${text}`); waiting.get(text).resolve({size:44,type:'audio/mpeg',text}); },
    get audio() { return player; },
  };
}
function engineHarness(fetcher) {
  const events=[];
  const exports={};
  const context={ exports, Promise, Map, Set, Object, Error, AbortController, DOMException,
    setTimeout, clearTimeout, fetch:fetcher,
    require(name) { assert.equal(name,'./audioPreferences'); return { readAudioPreferences:()=>({narrationEnabled:true}) }; },
  };
  vm.runInNewContext(moduleScript('frontend/src/services/storyTimeEngine.ts',
    ['prepareStoryTime','stopStoryTimeEngine','observeStoryTime','synthesizeStoryTimeSpeech']),context);
  exports.api.observeStoryTime(s=>events.push(s));
  return {api:exports.api,events};
}
const story = text => [{kind:'story',text,label:'STORY'}];

test('stop resolves pending narration even if browser play() never settles', async () => {
  const h=narratorHarness();
  h.hold();
  const old=h.api.playNarration(story('OLD'));
  h.speech('OLD'); await tick();
  assert.equal(h.playing.length,1);
  h.api.stopNarration();
  await old; // Must not await an indefinitely stalled HTMLMediaElement.play() promise.
  assert.equal(h.states.at(-1).phase,'idle');
  assert.equal(h.audio.onended,null);
});

test('stale pending play cannot override or detach next chapter handlers', async () => {
  const h=narratorHarness();
  const unresolved=h.hold();
  const old=h.api.playNarration(story('OLD'));
  h.speech('OLD'); await tick();
  const newer=h.api.playNarration(story('NEW'));
  h.speech('NEW'); await tick();
  assert.equal(h.states.at(-1).cue.text,'NEW');
  const handler=h.audio.onended;
  await old;
  assert.equal(h.audio.onended,handler);
  unresolved.resolve(); await tick();
  assert.equal(h.states.at(-1).cue.text,'NEW');
  h.audio.finish(); await newer;
  assert.equal(h.states.at(-1).phase,'idle');
});

test('media errors during delayed play are handled without unobserved rejection', async () => {
  const h=narratorHarness();
  const held=h.hold();
  const run=h.api.playNarration(story('BAD'));
  h.speech('BAD'); await tick();
  h.audio.fail();
  await run;
  assert.equal(h.states.at(-1).phase,'error');
  assert.match(h.states.at(-1).error,/Audio playback was interrupted/);
  held.reject(new Error('Late browser play rejection'));
  await tick();
  assert.equal(h.states.at(-1).phase,'error');
});

test('stopped hosted startup cannot restore ready state after a late HTTP response', async () => {
  const status=deferred();
  const h=engineHarness(()=>status.promise);
  const first=h.api.prepareStoryTime();
  h.api.stopStoryTimeEngine();
  status.resolve({ok:true,json:async()=>({available:true})});
  await assert.rejects(first,/interrupted/i);
  assert.equal(h.events.at(-1).phase,'idle');
  assert.equal(h.events.some((e,i)=>i>1 && e.phase==='ready'),false);
});

test('cancelled speech waiter returns promptly without cancelling another waiter startup', async () => {
  const status=deferred();
  let posts=0;
  const h=engineHarness((_url,opts)=>opts?.method==='POST'
    ? (posts++,Promise.resolve({ok:true,blob:async()=>({size:15,type:'audio/mpeg'})}))
    : status.promise);
  const controller=new AbortController();
  const cancelled=h.api.synthesizeStoryTimeSpeech({text:'OLD',voice:'am_michael',speed:1},controller.signal);
  const active=h.api.synthesizeStoryTimeSpeech({text:'NEW',voice:'am_michael',speed:1},new AbortController().signal);
  controller.abort();
  await assert.rejects(cancelled,/interrupted/i);
  assert.equal(posts,0);
  status.resolve({ok:true,json:async()=>({available:true})});
  const result=await active;
  assert.equal(result.size,15);
  assert.equal(posts,1);
  assert.equal(h.events.at(-1).phase,'ready');
});

test('stopping startup during its polling interval aborts wait instead of lingering', async () => {
  const h=engineHarness(async()=>({ok:true,json:async()=>({available:false,state:'starting'})}));
  const attempt=h.api.prepareStoryTime();
  await tick();
  assert.equal(h.events.at(-1).phase,'downloading');
  h.api.stopStoryTimeEngine();
  await assert.rejects(attempt,/interrupted/i);
  assert.equal(h.events.at(-1).phase,'idle');
});
