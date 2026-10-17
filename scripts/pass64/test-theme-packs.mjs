import assert from 'node:assert/strict';
import * as t from '../../frontend/src/features/appearance/themePacks.ts';
const packs=t.INCLUDED_PACKS;
assert.equal(packs.length,6);
assert.equal(new Set(packs.map(p=>p.id)).size, 6);
assert.equal(packs.filter(p=>p.target==='library').length,3);
assert.equal(packs.filter(p=>p.target==='reader').length,3);
for(const p of packs){
  assert.deepEqual(t.parseThemePack(JSON.parse(JSON.stringify(p))),p);
  assert.ok(t.contrastRatio(p.palette.paper,p.palette.ink)>=4.5,p.id+' ink contrast');
  assert.ok(t.contrastRatio(p.palette.muted,p.palette.paper)>=4.5,p.id+' secondary contrast');
  assert.ok(t.contrastRatio(p.palette.accent,p.palette.accentText)>=4.5,p.id+' action contrast');
  assert.ok(t.themeFileName(p).endsWith('.json'));
  assert.equal(Object.keys(t.themeCssVars(p)).length,8);
}
const fresh={...packs[0],id:'my-trail-blazer',name:'Trail Blazer'};
assert.deepEqual(t.importThemeJSON(JSON.stringify(fresh),[]),fresh);
assert.throws(()=>t.importThemeJSON(JSON.stringify(packs[0]),[]),/already exists/i);
assert.throws(()=>t.importThemeJSON(JSON.stringify(fresh),[fresh]),/already exists/i);
assert.throws(()=>t.importThemeJSON('a'.repeat(16385),[]),/16 KB/i);
assert.throws(()=>t.importThemeJSON(JSON.stringify(fresh),Array.from({length:24},(_,i)=>({...fresh,id:'theme-'+i}))),/full/i);
const malicious=[{...fresh, script:'alert(1)'}, {...fresh, palette:{...fresh.palette,paper:'url(https://example.org/evil.png)'}}, {...fresh, name:'<script>alert(1)</script>'}, {...fresh,id:'../../escape'}, {...fresh, palette:{...fresh.palette,ink:fresh.palette.paper}}, {...fresh,target:'server'}];
for(const bad of malicious) assert.throws(()=>t.parseThemePack(bad),'invalid theme must fail');
assert.equal(t.findTheme(packs[0].id,[]).id,packs[0].id);
assert.equal(t.findTheme(fresh.id,[fresh]).id,fresh.id);
console.log('PASS: theme manifest contract (6 included, import/export, contrast, safe values, limits, lookup).');
