// Run the actual hook with deterministic React/socket/timer adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { stripTypeScriptTypes } = require('node:module');
const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/state/useLiveAdventure.ts'), 'utf8');
const compiled = stripTypeScriptTypes(source)
  .replace(/import \{([^}]+)\} from ("[^"\n]+");/g, 'const {$1} = require($2);')
  .replace('export function useLiveAdventure', 'exports.useLiveAdventure = function useLiveAdventure');

function harness(connected = true) {
  const handlers = new Map(), sent = [], timers = new Map(), states = [], effects = [];
  let nextTimer = 0, connectCalls = 0;
  const socket = {
    connected,
    on(name, callback) { handlers.set(name, callback); },
    off(name, callback) { if (handlers.get(name) === callback) handlers.delete(name); },
    emit(name, payload) { sent.push({ name, payload, connected: this.connected }); },
    connect() { connectCalls++; },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    require(name) {
      if (name === 'react') return {
        useCallback: callback => callback,
        useRef: current => ({ current }),
        useEffect: callback => effects.push(callback),
        useState(initial) {
          const slot = states.length; states.push(initial);
          return [initial, value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
        },
      };
      if (name === '../services/socket') return { getGameSocket: () => socket };
      throw Error(name);
    },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const live = module.exports.useLiveAdventure('ABC123', 'hero-1');
  const cleanups = effects.map(callback => callback());
  const fire = (name, payload) => handlers.get(name)?.(payload);
  const snapshot = () => fire('game_state', { room_code: 'ABC123', turn_number: 3, scene: { body: 'Saved scene' } });
  const confirm = (hero = 'hero-1') => fire('resume_success', { room: { code: 'ABC123' }, character_id: hero, player_id: 'p1' });
  return { live, socket, sent, timers, states, handlers, fire, snapshot, confirm,
    status: () => states[0], connectCalls: () => connectCalls,
    cleanup: () => cleanups.forEach(callback => callback?.()),
    expire: () => { for (const [id, timer] of [...timers]) if (timer.delay === 12000) { timers.delete(id); timer.callback(); } },
  };
}

function actions(h) {
  h.live.submitChoice('choice'); h.live.retryPendingTurn(); h.live.startAdventure();
  h.live.requestWrapUp(); h.live.submitMicroEventChoice('option');
  h.live.submitIntermissionScore(3, 'golf', 50); h.live.sendChat('hello');
}

test('offline actions never enter the socket send queue', () => {
  const h = harness(false); actions(h); assert.equal(h.sent.length, 0);
  h.live.restore(); assert.equal(h.connectCalls(), 1);
});
test('connection alone and partial restoration cannot unlock actions', () => {
  const h = harness(); actions(h); assert.equal(h.sent.length, 1);
  h.confirm(); actions(h); assert.equal(h.sent.length, 1);
  assert.equal(h.status(), 'resuming'); h.snapshot();
  assert.equal(h.status(), 'ready'); actions(h); assert.equal(h.sent.length, 8);
});
test('snapshot-first restoration waits for the correct Hero confirmation', () => {
  const h = harness(); h.snapshot(); h.confirm('other-hero');
  assert.equal(h.status(), 'resuming'); h.confirm(); assert.equal(h.status(), 'ready');
});
test('disconnect preserves scene but blocks every action until restored', () => {
  const h = harness(); h.confirm(); h.snapshot();
  h.socket.connected = false; h.fire('disconnect'); actions(h);
  assert.equal(h.status(), 'waiting'); assert.equal(h.states[2].scene.body, 'Saved scene');
  assert.equal(h.sent.length, 1);
  h.socket.connected = true; h.fire('connect'); actions(h);
  assert.equal(h.sent.length, 2); h.confirm(); h.snapshot(); h.live.submitChoice('next');
  assert.equal(h.sent.at(-1).name, 'submit_choice');
});
test('timeout enables manual restoration and repeated clicks do not duplicate requests', () => {
  const h = harness(); h.confirm(); h.expire(); assert.equal(h.status(), 'error');
  h.live.restore(); h.live.restore(); assert.equal(h.sent.length, 2);
  h.snapshot(); assert.equal(h.status(), 'resuming'); h.confirm(); assert.equal(h.status(), 'ready');
});
test('other rooms cannot satisfy restoration', () => {
  const h = harness(); h.confirm(); h.fire('game_state', { room_code: 'OTHER', turn_number: 3 });
  assert.equal(h.status(), 'resuming'); h.expire(); assert.equal(h.status(), 'error');
});
test('connection errors are actionable and cleanup removes handlers and watchdog', () => {
  const h = harness(); h.socket.connected = false; h.fire('connect_error');
  assert.equal(h.status(), 'error'); h.live.restore(); assert.equal(h.connectCalls(), 1);
  h.cleanup(); assert.equal(h.handlers.size, 0);
  assert.equal([...h.timers.values()].some(timer => timer.delay === 12000), false);
});
test('retryable generation errors cannot bypass the restoration gate', () => {
  const h = harness(); h.fire('game_error', { room_code: 'ABC123', retryable: true, message: 'Retry' });
  assert.equal(h.status(), 'resuming'); h.live.retryPendingTurn(); assert.equal(h.sent.length, 1);
});
