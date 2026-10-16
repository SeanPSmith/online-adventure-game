'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('playtest dashboard is read-only, manually refreshed and restricted to admin page', () => {
 const page = read('frontend/src/pages/admin/PlaytestDiagnostics.tsx');
 const admin = read('frontend/src/pages/admin/AdminPage.tsx');
 const svc = read('frontend/src/services/admin.ts');
 assert.match(admin, /<PlaytestDiagnostics\s*\/>/);
 assert.match(page, /getPlaytestDiagnostics\(\)/);
 assert.match(page, /REFRESH PLAYTEST METRICS/);
 assert.doesNotMatch(page, /setInterval|POST|PUT|DELETE|model\s*:/);
 assert.match(svc, /\/api\/auth\/admin\/playtest-diagnostics\?limit=/);
});

test('cost projection and latency caveats remain visible to operators', () => {
 const page = read('frontend/src/pages/admin/PlaytestDiagnostics.tsx');
 assert.match(page, /GPT-6\.1 same tokens\*/);
 assert.match(page, /report\.limits\.comparison/);
 assert.match(page, /report\.limits\.timing/);
 assert.match(page, /NO DATA/);
 assert.match(page, /runs_with_progress_data/);
});
