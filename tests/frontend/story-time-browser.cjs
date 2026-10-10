"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
function load(file, deps, globals = {}) {
  const source = read(file);
  const names = [...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(match => match[1]);
  const output = stripTypeScriptTypes(source)
    .replace(/import \{([\s\S]*?)\} from "([^"\n]+)";/g, 'const {$1} = require("$2");')
    .replace(/import\.meta\.url/g, '"file:///story-time"')
    .replace(/export (?=(?:async )?(?:function|const) )/g, "")
    + "\n" + names.map(name => `exports.${name}=${name};`).join("\n");
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => deps[name], ...globals }, { filename: file });
  return exports;
}

// Simulated Web Worker: tests consent, pending requests, progress and failures
// without downloading weights or requiring a GPU in CI.
let launched = 0;
let active = null;
class FakeWorker {
  constructor() { launched++; active = this; this.onmessage = null; this.onerror = null; }
  postMessage(data) { this.last = data; }
  emit(data) { this.onmessage({ data }); }
  terminate() { this.terminated = true; }
}
let approved = false;
const engine = load("frontend/src/services/storyTimeEngine.ts", {
  "./audioPreferences": { readAudioPreferences: () => ({ storyTimeApproved: approved }) },
}, { Worker: FakeWorker, URL, Map, Set, Promise, Error, DOMException, AbortController, console });

test("Story Time refuses any model download before the player consents", async () => {
  await assert.rejects(() => engine.prepareStoryTime(), /approve the model download/i);
  assert.equal(launched, 0);
});

test("consent starts one worker and reports progress before ready", async () => {
  approved = true;
  const events = [];
  const unsubscribe = engine.observeStoryTime(state => events.push(state));
  const a = engine.prepareStoryTime();
  const b = engine.prepareStoryTime();
  assert.equal(launched, 1);
  assert.equal(active.last.type, "init");
  active.emit({ type: "progress", status: "progress", percent: 40, file: "onnx/model.onnx" });
  assert.equal(events.at(-1).percent, 40);
  active.emit({ type: "ready" });
  await Promise.all([a, b]);
  assert.equal(events.at(-1).phase, "ready");
  unsubscribe();
});

test("audio is generated inside worker and can be interrupted", async () => {
  const abort = new AbortController();
  const pending = engine.synthesizeStoryTimeSpeech({ text: "Story words.", voice: "af_heart", speed: 1 }, abort.signal);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(active.last.type, "speak");
  assert.equal(active.last.text, "Story words.");
  active.emit({ type: "audio", id: active.last.id, blob: { type: "audio/wav", size: 21 } });
  assert.equal((await pending).size, 21);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(() => engine.synthesizeStoryTimeSpeech({ text: "No.", voice: "af_heart", speed: 1 }, cancelled.signal), /interrupted/i);
});

test("failed model load shows an error and can be retried", async () => {
  active.emit({ type: "error", message: "Insufficient memory" });
  const states = [];
  engine.observeStoryTime(state => states.push(state));
  assert.match(states.at(-1).message, /memory/i);
  const boot = engine.prepareStoryTime();
  assert.equal(launched, 2);
  active.emit({ type: "ready" });
  await boot;
});

test("disabling Story Time cancels a pending download and allows later restart", async () => {
  engine.stopStoryTimeEngine(); // Prior tests leave the model ready.
  const boot = engine.prepareStoryTime();
  const running = active;
  engine.stopStoryTimeEngine();
  await assert.rejects(() => boot, /switched off/i);
  assert.equal(running.terminated, true);
  assert.ok(launched >= 3);
  const next = engine.prepareStoryTime();
  active.emit({ type: "ready" });
  await next;
});

test("browser worker uses fp32 locally, with no speech server or microphone", () => {
  const worker = read("frontend/src/services/storyTimeWorker.ts");
  const narrator = read("frontend/src/services/storyNarrator.ts");
  const settings = read("frontend/src/pages/account/SettingsPage.tsx");
  assert.match(worker, /dtype: "fp32"/);
  assert.match(worker, /device.*webgpu/);
  assert.match(worker, /generated\.toBlob\(\)/);
  assert.doesNotMatch(narrator, /\/api\/narration\/speech/);
  assert.match(settings, /StoryTimeConsentCopy/);
  assert.match(settings, /DOWNLOAD &amp; ENABLE/);
  assert.doesNotMatch([worker, narrator, settings].join("\n"), /getUserMedia|SpeechRecognition/);
});


test("Story Time branding, transparent privacy and third-party license notice", () => {
  const privacy = read("frontend/src/pages/legal/PrivacyPage.tsx");
  const consent = read("frontend/src/components/ui/StoryTimeConsentCopy.tsx");
  const settings = read("frontend/src/pages/account/SettingsPage.tsx");
  const notice = read("frontend/public/legal/story-time-third-party-notices.txt");
  assert.match(settings, /STORY TIME \/\/ YOUR STORYTELLER/);
  assert.doesNotMatch(settings, /KOKORO \/\/ THE STORYTELLER/);
  assert.match(privacy, /third-party model host/);
  assert.match(privacy, /speech server/);
  assert.match(consent, /DOWNLOAD &amp; ENABLE/);
  assert.match(consent, /open-source notices/i);
  assert.match(notice, /Apache License/);
  assert.match(notice, /Kokoro 82M/);
  assert.ok(notice.length > 11000, "include complete Apache 2.0 license, not just a link");
});


test("Story Time worker validates voice IDs before invoking the narrator", async () => {
  const worker = read("frontend/src/services/storyTimeWorker.ts");
  // Run the real worker message handler against an in-memory model stand-in.
  // Invalid messages must never bypass the supported-voice allowlist.
  const compiled = stripTypeScriptTypes(worker).replace(
    /import \{ ([^}]+) \} from "([^"]+)";/g,
    (_all, symbols, moduleName) => `const { ${symbols} } = require(${JSON.stringify(moduleName)});`,
  );
  const seen = [];
  const events = [];
  const sandbox = {
    require(name) {
      if (name === "kokoro-js") return {
        KokoroTTS: { from_pretrained: async () => ({
          generate: async (_text, options) => {
            seen.push(options.voice);
            return { toBlob: () => ({ size: 10 }) };
          },
        }) },
      };
      if (name === "./audioPreferences") return {
        KOKORO_VOICES: [{ value: "af_heart" }, { value: "bm_george" }],
      };
      throw Error(`Unexpected worker import: ${name}`);
    },
    self: {
      addEventListener(_event, callback) { events.push(callback); },
      postMessage() {},
    },
    Promise, Error, String, console,
  };
  vm.runInNewContext(compiled, sandbox, { filename: "storyTimeWorker.ts" });
  assert.equal(events.length, 1);
  events[0]({ data: { type: "speak", id: 1, text: "A chapter", voice: "not_a_voice", speed: 1 } });
  events[0]({ data: { type: "speak", id: 2, text: "A choice", voice: "bm_george", speed: 1 } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, ["af_heart", "bm_george"]);
});
