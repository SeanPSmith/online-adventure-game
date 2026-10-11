'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');

function prefsModule(saved=null) {
  const kv=new Map();
  if(saved) kv.set('tot:audio-preferences-v1',JSON.stringify(saved));
  const state={storage:kv,events:[]};
  const exports={};
  const script=stripTypeScriptTypes(source('frontend/src/services/audioPreferences.ts'))
    .replace(/export (?=(?:const|function)\s)/g,'')+
    '\nexports.api={NARRATION_PLAYBACK_SPEEDS,normalizeNarrationSpeed,normalizeAudioPreferences,readAudioPreferences,writeAudioPreferences};';
  const ctx={exports,Map,Number,Object,Math,JSON,
    localStorage:{getItem:key=>kv.get(key)??null,setItem:(key,val)=>kv.set(key,val)},
    window:{dispatchEvent:e=>state.events.push(e)},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}
  };
  vm.runInNewContext(script,ctx);
  return { ...exports.api,state };
}

test('only the seven requested playback speeds are accepted',()=>{
  const p=prefsModule();
  assert.deepEqual(Array.from(p.NARRATION_PLAYBACK_SPEEDS),[0.5,0.75,1,1.25,1.5,1.75,2]);
  for(const rate of p.NARRATION_PLAYBACK_SPEEDS) assert.equal(p.normalizeNarrationSpeed(rate),rate);
  assert.equal(p.normalizeNarrationSpeed(-1),0.5);
  assert.equal(p.normalizeNarrationSpeed(3),2);
  assert.equal(p.normalizeNarrationSpeed(1.38),1.5);
  assert.equal(p.normalizeNarrationSpeed(Infinity),1);
  assert.equal(p.normalizeNarrationSpeed(NaN),1);
});

test('old saved speeds normalize and speed persists across reloads',()=>{
  const p=prefsModule({storyTimeApproved:true,narrationEnabled:true,narrationSpeed:1.23});
  assert.equal(p.readAudioPreferences().narrationSpeed,1.25);
  const saved=p.writeAudioPreferences({narrationSpeed:2});
  assert.equal(saved.narrationSpeed,2);
  assert.equal(p.readAudioPreferences().narrationSpeed,2);
  assert.equal(p.state.events.at(-1).type,'tot:audio-preferences-changed');
  assert.equal(p.state.events.at(-1).detail.narrationSpeed,2);
});

test('rate changes remain browser-local and update live narration',()=>{
  const settings=source('frontend/src/pages/account/SettingsPage.tsx');
  const adventure=source('frontend/src/pages/game/AdventurePage.tsx');
  const narrator=source('frontend/src/services/storyNarrator.ts');
  const engine=source('frontend/src/services/storyTimeEngine.ts');
  assert.match(settings,/step="0\.25"/);
  assert.match(settings,/max=\{NARRATION_PLAYBACK_SPEEDS\[NARRATION_PLAYBACK_SPEEDS\.length - 1\]\}/);
  assert.match(adventure,/\[audioPreferences\.narrationVolume, audioPreferences\.narrationSpeed\]/);
  assert.match(adventure,/onClick=\{cycleNarrationSpeed\}/);
  assert.match(adventure,/SPEED \{audioPreferences\.narrationSpeed\}×/);
  assert.match(narrator,/audio\.playbackRate = prefs\.narrationSpeed/);
  assert.match(narrator,/audio\.preservesPitch = true/);
  assert.match(narrator,/speed: 1/);
  assert.doesNotMatch(narrator,/\[item\.text, adventureVoice \?\? prefs\.narrationVoice, prefs\.narrationSpeed\]/);
  assert.doesNotMatch(engine,/AudioContext|new Worker/);
});
