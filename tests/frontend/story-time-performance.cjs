'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const root = path.resolve(__dirname, '../..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const tick = async () => { for (let i=0; i<6; i++) await new Promise(resolve => setImmediate(resolve)); };
function script(file, names) {
  return stripTypeScriptTypes(source(file))
    .replace('import.meta.env.VITE_API_BASE', '""')
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (?=(?:async )?(?:function|const) )/g, '')
    + '\nexports.api={' + names.join(',') + '};';
}
function engine() {
  const exports = {};
  vm.runInNewContext(script('frontend/src/services/storyTimeEngine.ts', ['responseDiagnostic']), {
    exports, Promise, Date, Math, Number,
    require(name) { if(name === './audioPreferences') return {readAudioPreferences:()=>({narrationEnabled:true})}; throw Error(name); }
  });
  return exports.api;
}
function result(sourceName, server, inference) {
  const lookup = new Map([
    ['X-Story-Time-Cache',sourceName],
    ['X-Story-Time-Server-Ms',server],
    ['X-Story-Time-Inference-Ms',inference],
  ]);
  return {headers:{get:name=>lookup.get(name)??null}};
}
test('server diagnostics distinguish inference, memory, S3 and unknown response headers', () => {
  const api=engine();
  for (const kind of ['generated','memory','s3']) {
    const value=api.responseDiagnostic(result(kind,'124','0'),253);
    assert.equal(value.source,kind);
    assert.equal(value.serverMs,124);
    assert.equal(value.inferenceMs,0);
    assert.equal(value.requestMs,253);
  }
  const unknown=api.responseDiagnostic({headers:{get:()=>null}},31);
  assert.equal(unknown.source,'unknown');
  assert.equal(unknown.serverMs,null);
  assert.equal(unknown.inferenceMs,null);
});

test('negative, invalid and nonfinite server timings cannot be reported as valid', () => {
  const api=engine();
  const value=api.responseDiagnostic(result('secret','-12','Infinity'),18);
  assert.equal(value.source,'unknown');
  assert.equal(value.serverMs,null);
  assert.equal(value.inferenceMs,null);
  const missing=api.responseDiagnostic({headers:null},0);
  assert.equal(missing.source,'unknown');
});

function narrator() {
  const exports={};
  let calls=0;
  let delayed=false;
  const observers=[];
  const fakeAudio = class {
    constructor() { this.src=''; this.onended=null; this.onerror=null; this.ontimeupdate=null; }
    play() { Promise.resolve().then(()=>this.onended?.()); return Promise.resolve(); }
    pause() {}
    load() {}
    removeAttribute() { this.src=''; }
  };
  const ctx={exports,Promise,AbortController,Set,Map,Date,Math,Number,Error,
    setTimeout,clearTimeout,Audio:fakeAudio,
    URL:{createObjectURL:()=>`blob:fake-${calls}`,revokeObjectURL:()=>{}},
    require(name) {
      if (name==='./audioPreferences') return {readAudioPreferences:()=>({narrationEnabled:true,storyTimeApproved:true,narrationVoice:'af_bella',narrationVolume:80,narrationSpeed:1,narrationDramaticPacing:false})};
      if (name==='./storyTimeEngine') return {synthesizeStoryTimeSpeech:(_item,signal,onDiagnostic)=>{
        calls++;
        if(delayed) return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')), {once:true}));
        onDiagnostic?.({source:'s3',serverMs:17,inferenceMs:null,requestMs:41});
        return Promise.resolve({size:99,type:'audio/mpeg'});
      }};
      throw Error(name);
    },
  };
  vm.runInNewContext(script('frontend/src/services/storyNarrator.ts',[
    'playNarration','stopNarration','observeNarrationDiagnostics','resetNarrationDiagnostics'
  ]),ctx);
  exports.api.observeNarrationDiagnostics(s=>observers.push(s));
  return {api:exports.api,observers,get calls(){return calls;},delay(){delayed=true;}};
}
const story = (text)=>[{text,kind:'story',label:'CHAPTER'}];
test('a cached local replay does not make another network speech request', async () => {
  const h=narrator();
  await h.api.playNarration(story('A tale without identifying text.'));
  assert.equal(h.calls,1);
  assert.equal(h.observers.at(-1).s3Hits,1);
  assert.equal(h.observers.at(-1).lastWaitMs,41);
  await h.api.playNarration(story('A tale without identifying text.'));
  assert.equal(h.calls,1);
  assert.equal(h.observers.at(-1).localHits,1);
  assert.equal(h.observers.at(-1).lastSource,'local');
  h.api.resetNarrationDiagnostics();
  assert.equal(h.observers.at(-1).s3Hits,0);
  assert.equal(h.observers.at(-1).localHits,0);
});
test('cancelled narration never increments completed-request counters', async () => {
  const h=narrator(); h.delay();
  const work=h.api.playNarration(story('Cancelled text.'));
  await tick();
  h.api.stopNarration();
  await work;
  assert.equal(h.observers.at(-1).s3Hits,0);
  assert.equal(h.observers.at(-1).unknownResponses,0);
});
test('adventure exposes optional performance panel, no forced voice changes', () => {
  const page=source('frontend/src/pages/game/AdventurePage.tsx');
  assert.match(page,/VOICE PERFORMANCE \/\/ THIS BROWSER/);
  assert.match(page,/observeNarrationDiagnostics\(setSpeechDiagnostics\)/);
  assert.match(page,/onClick=\{resetNarrationDiagnostics\}/);
  assert.match(page,/theater\.chapterReleased && scene\?\.body/);
  assert.doesNotMatch(source('frontend/src/services/storyNarrator.ts'),/console\.log\(item\.text\)/);
});
