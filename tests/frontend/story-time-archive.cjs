const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

test('narration requests include optional room context, not raw S3 access', () => {
  const source = read('frontend/src/services/storyNarrator.ts');
  const engine = read('frontend/src/services/storyTimeEngine.ts');
  assert.match(source, /setAdventureNarratorRoom/);
  assert.match(source, /room_code: adventureRoom/);
  assert.match(engine, /room_code\?: string/);
  assert.doesNotMatch(source, /amazonaws\.com|s3:\/\//);
});

test('Chronicle playback uses private authenticated app routes', () => {
  const api = read('frontend/src/services/characters.ts');
  const player = read('frontend/src/components/game/ArchivedChronicleAudio.tsx');
  assert.match(api, /\/api\/narration\/archive/);
  assert.match(player, /<audio/);
  assert.match(player, /onEnded/);
  assert.match(read('frontend/src/pages/game/MyAdventuresPage.tsx'), /ArchivedChronicleAudio/);
  assert.match(read('frontend/src/pages/game/HistoryPage.tsx'), /ArchivedChronicleAudio/);
});

test('archive has separate private retention and no GPU lifecycle change', () => {
  const backend = read('infra/lib/backend-stack.ts');
  const archive = read('app/narration/archive.py');
  const routes = read('app/narration/routes.py');
  assert.match(backend, /narrationArchive\.grantReadWrite/);
  assert.match(backend, /KOKORO_ARCHIVE_BUCKET/);
  assert.match(backend, /BLOCK_ALL/);
  assert.match(backend, /prefix: "pending\/"/);
  assert.match(archive, /ServerSideEncryption="AES256"/);
  assert.match(routes, /completed_audio_clips\(history_id, str\(user.user_id\)\)/);
  assert.doesNotMatch(archive, /hosting\.touch|_ensure_awake|_read_kokoro/);
});
