// Exercise the actual production turn-theater hook across shuffled socket events.
// No DOM/React test dependency: deterministic hook scheduler and fake clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { stripTypeScriptTypes } = require('node:module');

function loadTs(relative, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../', relative), 'utf8');
  const js = stripTypeScriptTypes(source)
    .replace(/import \{([^}]+)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/export (function|const|class) /g, 'exports.$1 ');
  // Replace named exports with declarations plus an explicit export list.
  const patched = js.replace(/exports\.function\s+(\w+)/g, 'function $1')
    .replace(/exports\.const\s+(\w+)/g, 'const $1')
    .concat('\n', [...js.matchAll(/exports\.(?:function|const|class)\s+(\w+)/g)]
      .map(m => `exports.${m[1]} = ${m[1]};`).join('\n'));
  return { patched, imports };
}

const flow = (() => {
  const { patched } = loadTs('frontend/src/features/adventure/turnFlow.ts');
  const out = { exports: {} };
  vm.runInNewContext(patched, { exports: out.exports, require: () => { throw Error('unexpected import'); } });
  return out.exports;
})();

function harness() {
  let hooks = [], hookIndex = 0, dirty = false, now = 0, props, output;
  const storage = new Map(), timers = new Map();
  let nextTimer = 0;
  const equal = (left, right) => Boolean(left && right && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index])));
  const useState = initial => {
    const index = hookIndex++;
    if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
    return [hooks[index].value, setter => {
      const prev = hooks[index].value;
      const next = typeof setter === 'function' ? setter(prev) : setter;
      if (!Object.is(prev, next)) { hooks[index].value = next; dirty = true; }
    }];
  };
  const useRef = initial => {
    const index = hookIndex++;
    if (!hooks[index]) hooks[index] = { value: { current: initial } };
    return hooks[index].value;
  };
  const useMemo = (fn, deps) => {
    const index = hookIndex++;
    if (!hooks[index] || !equal(hooks[index].deps, deps)) hooks[index] = { value: fn(), deps };
    return hooks[index].value;
  };
  const useEffect = (fn, deps) => {
    const index = hookIndex++;
    if (!hooks[index] || !equal(hooks[index].deps, deps)) hooks[index] = { deps, effect: fn, cleanup: hooks[index]?.cleanup, pending: true };
  };
  const setInterval = (callback, interval) => {
    const id = ++nextTimer;
    timers.set(id, { callback, interval, when: now + interval });
    return id;
  };
  const clearInterval = id => timers.delete(id);
  const React = { useState, useRef, useMemo, useCallback: (fn, deps) => useMemo(() => fn, deps), useEffect };
  const { patched } = loadTs('frontend/src/features/adventure/useTurnTheater.ts');
  const module = { exports: {} };
  vm.runInNewContext(patched, {
    exports: module.exports,
    require(name) {
      if (name === 'react') return React;
      if (name === './turnFlow') return flow;
      throw Error(`unknown import ${name}`);
    },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) },
    performance: { now: () => now }, setInterval, clearInterval,
  });
  const hook = module.exports.useTurnTheater;
  const game = ({ started = true, turn = 1, pending = false, final = null, intermission = null, retry = false } = {}) => ({
    started, room_code: 'SOLO1', turn_number: turn, turn_pending: pending,
    last_turn_result: final, pending_intermission: intermission,
    director_retry_required: retry,
    readiness: [{ player_id: 'p1', ready: true }], required_players: 1,
  });
  props = {roomCode:'SOLO1', characterId:'hero-1', game: game({started:false}),
    lockCountdown:null, storyAdvancing:null, turnReceipt:null, lastTurn:null,
    retryableError:null, error:''};
  const render = () => {
    for (let pass=0;pass<25;pass++) {
      dirty = false; hookIndex = 0;
      output = hook(props);
      for (const record of hooks) {
        if (record?.pending) {
          record.pending = false;
          record.cleanup?.();
          record.cleanup = record.effect() ?? null;
        }
      }
      if (!dirty) return output;
    }
    throw Error('hook update did not settle');
  };
  const update = changes => { props = {...props, ...changes}; return render(); };
  const advance = ms => {
    const end = now + ms;
    let iterations = 0;
    while (true) {
      const scheduled = [...timers.entries()].sort((a,b) => a[1].when - b[1].when)[0];
      if (!scheduled || scheduled[1].when > end) break;
      if (++iterations > 10000) throw Error('timer loop');
      now = scheduled[1].when;
      if (timers.has(scheduled[0])) {
        scheduled[1].when = now + scheduled[1].interval;
        scheduled[1].callback(); render();
      }
    }
    now = end; return render();
  };
  return { game, render, update, advance, props: () => props,
    output: () => output,
    acknowledge: () => { output.acknowledgeResolution(); return render(); },
    endArcade: () => { output.finishIntermissionStoryReady(); return render(); },
  };
}

const result = (number, preliminary = true, turn = 1) => ({
  room_code: 'SOLO1', resolved_turn_number:turn,
  turn_number: preliminary ? turn : turn + 1,
  preliminary, previous_scene_id:'opening', resolution: preliminary?'Early narration':'Committed narration',
  results:[{player_id:'p1', choice_id:'open', choice_label:'Open the door',
    check:{roll:number, total:number+3, difficulty:13, outcome:'success'}}],
});
const arcade = turn => ({room_code:'SOLO1',turn_number:turn,game_id:'rune_catch',play_mode:'solo',intermission_stats:[],submitted_player_ids:[]});

// Test both pure identity and the entire hook's timers/acknowledgements.
test('final receipts retain the first server dice and use a stable resolved turn', () => {
  const early = result(17), final = result(5,false);
  assert.equal(flow.receiptKey(early), flow.receiptKey(final));
  const merged = flow.mergeTurnReceipt(early, final);
  assert.equal(merged.results[0].check.roll,17);
  assert.equal(merged.resolution,'Committed narration');
  assert.equal(merged.preliminary,false);
  assert.equal(flow.latestTurnReceipt('SOLO1',2,false,[early,final]), final);
  assert.equal(flow.latestTurnReceipt('SOLO1',2,true,[early,final]), null);
});

test('lobby presence cannot trigger turn countdown or arcade', () => {
  const h = harness(); h.render();
  h.update({game:h.game({started:false}),lockCountdown:{room_code:'SOLO1',turn_number:1,duration_seconds:3}});
  assert.equal(h.output().phase,'none');
});

test('countdown -> one dice reveal -> arcade -> new scene, no second dice reveal', () => {
  const h = harness(); h.render();
  h.update({game:h.game({pending:false}),lockCountdown:{room_code:'SOLO1',turn_number:1,duration_seconds:3}});
  assert.equal(h.output().phase,'lock-countdown');
  h.update({game:h.game({pending:true,intermission:arcade(1)}),turnReceipt:result(17)});
  assert.equal(h.output().phase,'lock-countdown');
  h.advance(3100);
  assert.equal(h.output().phase,'resolution');
  assert.equal(h.output().activeReceipt.results[0].check.roll,17);
  h.acknowledge(); assert.equal(h.output().phase,'intermission');
  const final = result(17,false);
  h.update({turnReceipt:final,lastTurn:final,game:h.game({turn:2,final})});
  assert.equal(h.output().phase,'story-ready');
  h.advance(3100); h.endArcade();
  assert.equal(h.output().phase,'none');
  h.update({game:h.game({turn:2,final})});
  assert.equal(h.output().phase,'none');
});

test('an intermission cannot launch its game before the receipt is acknowledged', () => {
  const h = harness(); h.render();
  h.update({game:h.game({pending:true,intermission:arcade(1)})});
  assert.equal(h.output().phase,'intermission');
  assert.equal(h.output().arcadeAvailable,false);
  h.update({turnReceipt:result(12)});
  assert.equal(h.output().phase,'resolution');
  assert.equal(h.output().arcadeAvailable,false);
  h.acknowledge();
  assert.equal(h.output().phase,'intermission');
  assert.equal(h.output().arcadeAvailable,true);
});

test('reconnect can present a durable committed roll, not an old story turn', () => {
  const h = harness(); h.render();
  const final = result(16,false,2);
  h.update({game:h.game({turn:3,final})});
  assert.equal(h.output().phase,'resolution');
  assert.equal(h.output().activeReceipt.results[0].check.roll,16);
  h.acknowledge(); assert.equal(h.output().phase,'none');
  h.update({game:h.game({turn:3,final})});
  assert.equal(h.output().phase,'none');
});

test('committed result while dice are visible never rerolls or interrupts the reveal', () => {
  const h = harness(); h.render();
  h.update({game:h.game({pending:true,intermission:arcade(1)}),turnReceipt:result(19)});
  assert.equal(h.output().phase,'resolution');
  const changedNarration = result(3,false);
  h.update({turnReceipt:changedNarration,lastTurn:changedNarration,game:h.game({turn:2,final:changedNarration})});
  assert.equal(h.output().phase,'resolution');
  assert.equal(h.output().activeReceipt.results[0].check.roll,19);
  h.acknowledge(); assert.equal(h.output().phase,'none');
});

test('refresh during Director generation restores frozen dice; acknowledged finals do not replay', () => {
  const h = harness(); h.render();
  h.update({game:h.game({pending:true,intermission:arcade(1)}),turnReceipt:result(15)});
  assert.equal(h.output().phase,'resolution');
  h.acknowledge(); assert.equal(h.output().phase,'intermission');
  const final = result(15,false);
  h.update({game:h.game({turn:2,final}),lastTurn:final});
  assert.equal(h.output().phase,'story-ready');
  h.advance(3200);h.endArcade();
  assert.equal(h.output().phase,'none');
  // The current snapshot and durable receipt may be resent for reconnect.
  h.update({game:h.game({turn:2,final}),lastTurn:result(15,false)});
  assert.equal(h.output().phase,'none');
});

test('a Director retry after the receipt does not reroll or erase it', () => {
  const h = harness(); h.render();
  h.update({game:h.game({pending:true}),turnReceipt:result(14)});
  assert.equal(h.output().phase,'resolution');
  h.update({game:h.game({pending:true,retry:true})});
  assert.equal(h.output().phase,'resolution');
  h.acknowledge(); assert.equal(h.output().phase,'retry');
});


test('static opening resolves once without launching Arcade or restarting dice', () => {
  const h = harness(); h.render();
  h.update({game:h.game({started:false})});
  assert.equal(h.output().phase,'none');
  h.update({game:h.game({turn:1}),lockCountdown:{room_code:'SOLO1',turn_number:1,duration_seconds:3}});
  assert.equal(h.output().phase,'lock-countdown');
  const committed = result(11,false);
  h.update({game:h.game({turn:2,final:committed}),turnReceipt:committed,lastTurn:committed});
  h.advance(3100);
  assert.equal(h.output().phase,'resolution');
  assert.equal(h.output().activeReceipt.results[0].check.roll,11);
  h.acknowledge();
  assert.equal(h.output().phase,'none');
  assert.equal(h.output().activeIntermission,null);
});

test('repeated previous-turn snapshot cannot cancel the next countdown', () => {
  const h = harness(); h.render();
  const previous = result(12,false);
  h.update({game:h.game({turn:2,final:previous}),lastTurn:previous});
  assert.equal(h.output().phase,'resolution');
  h.acknowledge();
  assert.equal(h.output().phase,'none');
  h.update({game:h.game({turn:2,final:previous}),lockCountdown:{room_code:'SOLO1',turn_number:2,duration_seconds:3}});
  assert.equal(h.output().phase,'lock-countdown');
  const duplicate = result(12,false);
  h.update({game:h.game({turn:2,final:duplicate}),lastTurn:duplicate});
  assert.equal(h.output().phase,'lock-countdown');
  h.advance(3100);
  assert.equal(h.output().phase,'none');
});
