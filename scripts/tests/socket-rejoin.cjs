// Reproduction: transport connected, but backend lost this sid's room binding.
// An unanswered sync must re-run the existing authenticated resume handshake.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');

function createHarness() {
  const events = new Map(), sent = [], timers = new Map();
  const socket = {
    connected: true,
    on(event, fn) { events.set(event, fn); },
    off(event, fn) { if (events.get(event) === fn) events.delete(event); },
    emit(event, payload) { sent.push({event, payload}); },
    connect() { this.connected = true; events.get('connect')?.(); },
    receive(event, payload) { events.get(event)?.(payload); },
  };
  let hooks=[], cursor=0, dirty=false, output, now=0, timerId=0;
  const equal=(a,b)=>Boolean(a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i])));
  const useState=(initial)=>{ const i=cursor++; if(!hooks[i]) hooks[i]={value:typeof initial==='function'?initial():initial};return [hooks[i].value,v=>{const nv=typeof v==='function'?v(hooks[i].value):v;if(!Object.is(nv,hooks[i].value)){hooks[i].value=nv;dirty=true;}}]};
  const useRef=(initial)=>{const i=cursor++;if(!hooks[i])hooks[i]={value:{current:initial}};return hooks[i].value};
  const useMemo=(fn,deps)=>{const i=cursor++;if(!hooks[i]||!equal(hooks[i].deps,deps))hooks[i]={value:fn(),deps};return hooks[i].value};
  const useEffect=(fn,deps)=>{const i=cursor++;if(!hooks[i]||!equal(hooks[i].deps,deps))hooks[i]={deps,effect:fn,cleanup:hooks[i]?.cleanup,pending:true}};
  const React={useState,useRef,useEffect,useCallback:(fn,deps)=>useMemo(()=>fn,deps)};
  const setTimeoutFake=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,when:now+ms});return id};
  const clearTimeoutFake=id=>timers.delete(id);
  const file=path.join(__dirname,'../../frontend/src/state/useLiveAdventure.ts');
  const source=stripTypeScriptTypes(fs.readFileSync(file,'utf8'))
    .replace(/^import\s+\{[^}]+\}\s+from\s+"[^"]+";\s*$/gm,'')
    .replace(/^import\s+type\s+\{[^}]+\}\s+from\s+"[^"]+";\s*$/gm,'')
    .replace(/export function useLiveAdventure/, 'function useLiveAdventure')
    + '\nexports.useLiveAdventure=useLiveAdventure;';
  const module={exports:{}};
  vm.runInNewContext(source,{exports:module.exports,useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,useCallback:React.useCallback,getGameSocket:()=>socket,setTimeout:setTimeoutFake,clearTimeout:clearTimeoutFake}, {filename:file});
  const render=()=>{
    for(let pass=0;pass<25;pass++) {
      cursor=0;dirty=false;output=module.exports.useLiveAdventure('ABC','hero');
      for(const rec of hooks)if(rec?.pending){rec.pending=false;rec.cleanup?.();rec.cleanup=rec.effect()??null;}
      if(!dirty)return output;
    }
    throw new Error('state did not settle');
  };
  const advance=(ms)=>{const end=now+ms;let loops=0;while(true){const next=[...timers.entries()].sort((a,b)=>a[1].when-b[1].when)[0];if(!next||next[1].when>end)break;if(++loops>100)throw Error('timer loop');now=next[1].when;timers.delete(next[0]);next[1].fn();render();}now=end;return render();};
  return {socket,sent,render,advance,output:()=>output};
}

test('unanswered connected sync rebinds using resume_adventure without a reroll',()=>{
  const h=createHarness();h.render();
  assert.equal(h.sent.at(-1).event,'resume_adventure');
  h.socket.receive('resume_success',{room:{code:'ABC'},character_id:'hero',player_id:'p1'});
  h.socket.receive('game_state',{room_code:'ABC',turn_number:10,turn_pending:true});
  h.render();
  const epoch=h.output().resumeEpoch;
  h.output().sync();
  assert.equal(h.sent.at(-1).event,'sync_adventure_state');
  h.advance(5001);
  assert.equal(h.sent.at(-1).event,'resume_adventure');
  assert.deepEqual([...new Set(h.sent.map(item=>item.event))].sort(),['resume_adventure','sync_adventure_state']);
  h.socket.receive('resume_success',{room:{code:'ABC'},character_id:'hero',player_id:'p1'});
  h.socket.receive('game_state',{room_code:'ABC',turn_number:11,turn_pending:false});
  h.render();
  assert.ok(h.output().resumeEpoch>epoch);
});

test('answered sync cancels recovery handshake',()=>{
  const h=createHarness();h.render();
  h.socket.receive('resume_success',{room:{code:'ABC'},character_id:'hero',player_id:'p1'});
  h.socket.receive('game_state',{room_code:'ABC',turn_number:10,turn_pending:true});
  h.render();
  h.output().sync();
  const resumesBefore=h.sent.filter(item=>item.event==='resume_adventure').length;
  h.socket.receive('game_state',{room_code:'ABC',turn_number:10,turn_pending:true});
  h.render();h.advance(6000);
  assert.equal(h.sent.filter(item=>item.event==='resume_adventure').length,resumesBefore);
});
