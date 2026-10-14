'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname,'../..');
const read = p => fs.readFileSync(path.join(base,p),'utf8');
const voices = read('frontend/src/services/audioPreferences.ts');
const picker = read('frontend/src/components/game/NarratorVoicePicker.tsx');
const narrator = read('frontend/src/services/storyNarrator.ts');
const backend = read('app/narration/routes.py');

test('full English catalogue has 28 distinct IDs and keeps initial five featured', () => {
  const ids = [...voices.matchAll(/value: "([ab][fm]_[a-z]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,28);
  assert.equal(new Set(ids).size,28);
  for (const id of ['af_heart','af_bella','af_sky','am_michael','bm_george']) {
    assert.match(voices,new RegExp(`value: "${id}".*featured: true`));
  }
  for (const id of ['bf_emma','bm_fable','am_fenrir','am_puck']) assert.ok(ids.includes(id));
});

test('preview button reads authenticated archive samples without generating narration',()=>{
  assert.match(picker,/fetch\(`\$\{API_BASE\}\/api\/narration\/previews\/\$\{voice\}`/);
  assert.match(picker,/credentials: "include"/);
  assert.match(picker,/pauseNarration\(\)/);
  assert.doesNotMatch(picker,/\/api\/narration\/speech|seed\/\$\{voice\}/);
  assert.match(backend,/def _preview_read/);
  const route = backend.split('@router.get("/previews/{voice}")')[1].split('@router.post("/previews/seed/{voice}")')[0];
  assert.doesNotMatch(route,/_ensure_awake|_read_kokoro/);
});

test('only administrators can explicitly seed saved samples',()=>{
  assert.match(backend, /@router.post\("\/previews\/seed\/\{voice\}"\)/);
  assert.match(backend,/seed_voice_preview\(voice: str, admin=Depends\(require_admin_write\)\)/);
  const settings=read('frontend/src/pages/account/SettingsPage.tsx');
  assert.match(settings,/isAdmin \? <div className="narrator-admin-seed"/);
  assert.match(settings, /"X-TOT-Admin-Request": "1"/);
  assert.match(settings,/ADMIN \/\/ PREPARE VOICE PREVIEWS/);
});

test('voice switches affect the next clip, not the currently playing segment',()=>{
  assert.match(narrator,/const preferredVoice = \(\) => readAudioPreferences\(\)\.narrationVoice/);
  assert.match(narrator,/entry\.voice !== preferredVoice\(\)/);
  assert.match(narrator,/entry\.abort\.abort\(\)/);
  assert.match(narrator,/const selected = prepared\.get\(index\)!/);
  assert.match(narrator,/selected\.voice !== preferredVoice\(\)/);
  assert.match(narrator,/if \(identity !== sequence\) return/);
});

test('both account Settings and the live Adventure expose the voice library',()=>{
  assert.match(read('frontend/src/pages/game/AdventurePage.tsx'), /<NarratorVoicePicker value=\{audioPreferences\.narrationVoice\}/);
  assert.match(read('frontend/src/pages/account/SettingsPage.tsx'), /<NarratorVoicePicker value=\{audio\.narrationVoice\}/);
  const archive = read('frontend/src/components/game/ArchivedChronicleAudio.tsx');
  assert.match(archive,/PREFERRED NARRATOR TRACK/);
  assert.match(archive,/TerminalSelect ariaLabel="Preferred Chronicle narrator track"/);
  assert.doesNotMatch(archive,/<select\b/);
  assert.match(archive,/setPreferredVoice\(voice\)/);
});
