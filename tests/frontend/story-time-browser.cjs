'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
function loadEngine(fetch, enabled = true) {
  const source=stripTypeScriptTypes(read('frontend/src/services/storyTimeEngine.ts'))
   .replace('import.meta.env.VITE_API_BASE','""')
   .replace(/import \{ ([^}]+) \} from "([^"]+)";/g, 'const {$1} = require("$2");')
   .replace(/export (?=(?:async )?(?:function|const|type|interface) )/g,'');
  const exports = {};
  const output=source+'\nexports.prepareStoryTime=prepareStoryTime; exports.synthesizeStoryTimeSpeech=synthesizeStoryTimeSpeech; exports.stopStoryTimeEngine=stopStoryTimeEngine; exports.observeStoryTime=observeStoryTime;';
  vm.runInNewContext(output,{ exports, require: () => ({readAudioPreferences:()=>({narrationEnabled:enabled})}),fetch,Set,Promise,Error,Object,AbortController,DOMException,console });
  return exports;
}
test('Story Time browser never downloads or initializes a local model',()=>{
  const source=read('frontend/src/services/storyTimeEngine.ts');
  const settings=read('frontend/src/pages/account/SettingsPage.tsx');
  const pkg=JSON.parse(read('frontend/package.json'));
  assert.doesNotMatch(source,/new Worker|from_pretrained|onnx-community|kokoro-js/);
  assert.doesNotMatch(settings,/DOWNLOAD &amp; ENABLE|DOWNLOAD STORY TIME MODEL/);
  assert.equal(Object.prototype.hasOwnProperty.call(pkg.dependencies,'kokoro-js'),false);
});
test('narration status is checked with credentials and defaults unavailable', async()=>{
  const engine=loadEngine(async()=>({ok:true,json:async()=>({available:false})}));
  await assert.rejects(()=>engine.prepareStoryTime(),/resting/i);
  const seen=[];engine.observeStoryTime(s=>seen.push(s));
  assert.equal(seen.at(-1).phase,'error');
});
test('disabled narration cannot wake hosted service',async()=>{
  let requests=0; const engine=loadEngine(async()=>{requests++;return {ok:true,json:async()=>({available:true})};},false);
  await assert.rejects(()=>engine.prepareStoryTime(),/Enable Story Time/i);
  assert.equal(requests,0);
});
test('narration requests authenticated audio but no microphone',async()=>{
  let count=0;
  const engine=loadEngine(async (_url,opts)=>{
    count++;
    return opts && opts.method === "POST" ? {ok:true,blob:async()=>({type:'audio/mpeg',size:22})} : {ok:true,json:async()=>({available:true})};
  });
  const blob=await engine.synthesizeStoryTimeSpeech({text:'A story',voice:'af_heart',speed:1},new AbortController().signal);
  assert.equal(blob.size,22);
  assert.equal(count,2);
  assert.doesNotMatch(read('frontend/src/services/storyTimeEngine.ts'),/getUserMedia|SpeechRecognition/);
});
test('one host-selected narrator voice travels with the room and is used for playback',()=>{
  const game=read('frontend/src/state/GameSocketContext.tsx');
  const page=read('frontend/src/pages/game/AdventurePage.tsx');
  const backend=read('app/main.py');
  assert.match(game,/narration_voice: readAudioPreferences\(\)\.narrationVoice/);
  assert.match(page,/setAdventureNarratorVoice\(live\.game\?\.narrator_voice/);
  assert.match(backend,/session\.narrator_voice/);
});
test('hosted narration privacy and license notices remain available',()=>{
  const privacy=read('frontend/src/pages/legal/PrivacyPage.tsx');
  const notice=read('frontend/public/legal/story-time-third-party-notices.txt');
  assert.match(privacy,/hosted speech-generation/);
  assert.doesNotMatch(privacy,/350 MB|locally on your/);
  assert.match(notice,/Apache License/);
});
