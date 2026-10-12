const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('main dashboard excludes fallen and archived heroes from cards and selection',()=>{
  const code=read('frontend/src/pages/game/GameHomePage.tsx');
  assert.match(code, /playableHeroes\s*= useMemo\([\s\S]*hero\.is_alive && hero\.hero_status === "active"/);
  assert.match(code,/playableHeroes\.slice\(0, 4\)/);
  assert.match(code,/selectableHeroes\.map/);
  assert.match(code,/setSelectedHeroId\(selectableHeroes\[0\]\?\.character_id/);
  assert.doesNotMatch(code,/heroes\.slice\(0, 4\)/);
});

test('invitation picker also blocks dead and retired heroes',()=>{
  const code=read('frontend/src/pages/public/JoinInvitePage.tsx');
  assert.match(code,/hero\.is_alive && hero\.hero_status === "active"/);
  assert.match(code,/selectableHeroes\.map/);
});

test('hero hall distinguishes fallen from buried and requires typed deletion confirmation',()=>{
  const code=read('frontend/src/pages/heroes/HeroManagerPage.tsx');
  assert.match(code,/FALLEN IN ADVENTURE/);
  assert.match(code,/LAID TO REST/);
  assert.match(code,/confirmName !== hero\.name/);
  assert.match(code,/COMMIT TO MEMORY/);
  assert.match(code,/setHeroDisposition/);
});

test('graveyard is a distinct protected route with public memorials but no biography',()=>{
  const router=read('frontend/src/router.tsx');
  const grave=read('frontend/src/pages/heroes/GraveyardPage.tsx');
  assert.match(router,/path: "graveyard"/);
  assert.match(grave,/listGraveyard\(\)/);
  assert.doesNotMatch(grave,/hero\.bio|owner_user_id/);
});
