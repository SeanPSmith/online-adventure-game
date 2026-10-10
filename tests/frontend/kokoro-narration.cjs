// Pass 56: deterministic browser narration tests. No inference, microphone or real audio.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '../..');
const local = new Map();
let requests = 0;
let objectUrls = 0;
class FakeAudio {
  constructor() { this.volume=1; this.onended=null; this.onerror=null; this.paused=true; }
  async play() { this.paused=false; Promise.resolve().then(() => this.onended?.()); }
  pause() { this.paused=true; }
  load() {}
  removeAttribute(name) { if(name==='src') this.src=''; }
}
const context = {
  localStorage: {getItem:k=>local.get(k)??null, setItem:(k,v)=>local.set(k,v)},
  window: {dispatchEvent(){}},
  CustomEvent: class {constructor(type, options) {this.type=type;this.detail=options.detail;}},
  Audio: FakeAudio, AbortController, Promise, Map, Set, Error, Array,
  URL: {createObjectURL() {return 'blob:test-'+(++objectUrls);}, revokeObjectURL(){}},
  fetch: async()=> { requests++; return {ok:true,blob:async()=>({size:12,type:'audio/mpeg'}),status:200}; },
  exports: {}, console,
};
function load(relative, deps={}) {
  const source = fs.readFileSync(path.join(root, relative),'utf8');
  const names=[...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(m=>m[1]);
  const output=stripTypeScriptTypes(source)
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (?=(?:async )?(?:function|const) )/g, '')
    + '\n' + names.map(name=>`exports.${name}=${name};`).join('\n');
  const exposed={};
  vm.runInNewContext(output,{...context,exports:exposed,require:n=> {
    if(!(n in deps)) throw new Error('Unmocked import: '+n);
    return deps[n];
  }},{filename:relative});
  return exposed;
}
const prefs=load('frontend/src/services/audioPreferences.ts');
const narrator=load('frontend/src/services/storyNarrator.ts',{'./audioPreferences':prefs});

test('narration, auto-read and voice input all default OFF',()=> {
  const value=prefs.readAudioPreferences();
  assert.equal(value.narrationEnabled,false);
  assert.equal(value.narrationAutoPlay,false);
  assert.equal(value.narrationAutoChoices,false);
  assert.equal('microphone' in value,false);
});

test('narration preferences preserve SFX settings and clamp voice / speed / volume',()=> {
  prefs.writeAudioPreferences({effectsEnabled:true,masterVolume:44,narrationVoice:'bad',narrationSpeed:7,narrationVolume:-3});
  const value=prefs.readAudioPreferences();
  assert.equal(value.effectsEnabled,true);
  assert.equal(value.masterVolume,44);
  assert.equal(value.narrationVoice,'af_heart');
  assert.equal(value.narrationSpeed,1.5);
  assert.equal(value.narrationVolume,0);
});

test('long chapters are split below API request cap without losing text',()=> {
  const input=('A storyteller speaks. ').repeat(140);
  const parts=narrator.splitPassage(input);
  assert.ok(parts.length>1);
  assert.ok(parts.every(part=>part.length<=1300));
  assert.equal(parts.join(' '),input.trim());
});

test('read choices is separate; one choice can be listened to without selecting',()=> {
  const c=[{label:'Enter the tower.'},{label:'Wait outside.'}];
  assert.equal(narrator.sceneNarrationItems('Chapter text.',c,false).length,1);
  const items=narrator.choiceNarrationItems(c);
  assert.deepEqual(Array.from(items,v=>v.kind),['choice','choice']);
  assert.match(items[1].text,/Option 2/);
});

test('silent until enabled and cache reuses narration across playback',async()=> {
  prefs.writeAudioPreferences({narrationEnabled:false,narrationVolume:85});
  const item={text:'The tower watches.',kind:'story',label:'CHAPTER'};
  await narrator.playNarration([item]);
  assert.equal(requests,0);
  prefs.writeAudioPreferences({narrationEnabled:true});
  await narrator.playNarration([item]);
  assert.equal(requests,1);
  await narrator.playNarration([item]);
  assert.equal(requests,1);
  assert.equal(objectUrls,1);
});

test('story page only narrates the scene; explicit interruption stops playback',()=> {
  const page=fs.readFileSync(path.join(root,'frontend/src/pages/game/AdventurePage.tsx'),'utf8');
  assert.match(page,/sceneNarrationItems\(scene\.body, scene\.choices/);
  assert.match(page,/stopNarration\(\)/);
  assert.match(page,/pending_micro_event/);
  assert.match(page,/READ CHAPTER/);
  assert.match(page,/READ CHOICES/);
  assert.match(page,/Read choice \$\{index \+ 1\} aloud/);
  assert.doesNotMatch(page,/getUserMedia|SpeechRecognition/);
});
