/** Hosted Story Time playback: ordered, buffered MP3 chunks; never holds up gameplay.
 *  This is client-side lookahead, not low-latency PCM streaming from the server.
 *  Voice quality and server/S3 cache keys are unchanged at all playback rates.
 */
import { readAudioPreferences } from "./audioPreferences";
import { synthesizeStoryTimeSpeech, type StoryTimeRequestDiagnostic } from "./storyTimeEngine";

export type NarrationPhase = "idle" | "loading" | "buffering" | "playing" | "paused" | "error";
/** Browser-only timing cue. Passage timing estimates sentences, not word alignment. */
export interface NarrationCue { kind: "story" | "choice"; index: number; text: string; progress: number; }
export interface NarrationState { phase: NarrationPhase; label: string; error: string; cue: NarrationCue | null; }
export interface NarrationItem { text: string; label: string; kind: "story" | "choice"; }

const state: NarrationState = { phase: "idle", label: "", error: "", cue: null };
const subscribers = new Set<(value: NarrationState) => void>();
const cache = new Map<string, string>();
const CACHE_LIMIT = 24;
/** Session-only metrics: no prose, room code, identity, or network telemetry upload. */
export interface NarrationDiagnostics {
  localHits: number;
  memoryHits: number;
  s3Hits: number;
  generated: number;
  unknownResponses: number;
  lastSource: "local" | StoryTimeRequestDiagnostic["source"] | null;
  lastWaitMs: number | null;
  lastServerMs: number | null;
  lastInferenceMs: number | null;
}
const emptyDiagnostics = (): NarrationDiagnostics => ({
  localHits: 0, memoryHits: 0, s3Hits: 0, generated: 0, unknownResponses: 0,
  lastSource: null, lastWaitMs: null, lastServerMs: null, lastInferenceMs: null,
});
let diagnostics = emptyDiagnostics();
const diagnosticSubscribers = new Set<(value: NarrationDiagnostics) => void>();
export function observeNarrationDiagnostics(callback: (value: NarrationDiagnostics) => void): () => void {
  diagnosticSubscribers.add(callback);
  callback({ ...diagnostics });
  return () => { diagnosticSubscribers.delete(callback); };
}
export function resetNarrationDiagnostics() {
  diagnostics = emptyDiagnostics();
  for (const callback of diagnosticSubscribers) callback({ ...diagnostics });
}
function recordDiagnostic(source: NarrationDiagnostics["lastSource"], waitMs: number, serverMs: number | null, inferenceMs: number | null) {
  const field = source === "local" ? "localHits"
    : source === "memory" ? "memoryHits"
    : source === "s3" ? "s3Hits"
    : source === "generated" ? "generated" : "unknownResponses";
  diagnostics = { ...diagnostics, [field]: diagnostics[field] + 1,
    lastSource: source, lastWaitMs: Math.max(0, Math.round(waitMs)),
    lastServerMs: serverMs, lastInferenceMs: inferenceMs };
  for (const callback of diagnosticSubscribers) callback({ ...diagnostics });
}
// Play the current chunk while preparing up to two subsequent chunks.
// Keep the window bounded: uncontrolled prefetch would overwhelm CPU Kokoro.
export const NARRATION_LOOKAHEAD = 2;
let adventureVoice: string | null = null;
export function setAdventureNarratorVoice(voice: string | null) { adventureVoice = voice; }
let audio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;
let sequence = 0;
let pending: AbortController | null = null;
let pausedBetweenChunks = false;
const resumeWaiters = new Set<() => void>();

/** Dramatic transitions are only between distinct spoken units. Story chunks
 * continue immediately; pauses between their cached MP3s sound unnatural.
 * This never changes synthesis text, voice, speed, or shared S3 cache keys.
 */
export function narrationTransitionMs(
  previous: NarrationItem | undefined,
  next: NarrationItem,
  enabled: boolean,
  speed: number,
): number {
  if (!enabled || !previous) return 0;
  let duration = 0;
  if (previous.kind === "story" && next.kind === "choice") duration = 480;
  else if (previous.kind === "choice" && next.kind === "choice" && previous.label !== next.label) duration = 280;
  if (!duration) return 0;
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? Math.max(0.5, Math.min(2, speed)) : 1;
  return Math.round(duration / safeSpeed);
}


export function observeNarration(callback: (value: NarrationState) => void): () => void {
  subscribers.add(callback);
  callback({ ...state });
  return () => { subscribers.delete(callback); };
}

function publish(phase: NarrationPhase, label = "", error = "", cue: NarrationCue | null = null) {
  Object.assign(state, { phase, label, error, cue });
  for (const callback of subscribers) callback({ ...state });
}

function player(): HTMLAudioElement {
  if (!audio) audio = new Audio();
  return audio;
}

function releasePauseWaiters() {
  for (const resolve of resumeWaiters) resolve();
  resumeWaiters.clear();
}

export function adjustNarrationVolume() {
  if (audio) {
    const prefs = readAudioPreferences();
    audio.volume = prefs.narrationVolume / 100;
    audio.playbackRate = prefs.narrationSpeed;
    audio.preservesPitch = true;
  }
}

export function stopNarration() {
  ++sequence;
  pending?.abort();
  pending = null;
  pausedBetweenChunks = false;
  releasePauseWaiters();
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio.ontimeupdate = null;
    audio.removeAttribute("src");
    audio.load();
  }
  activeUrl = null;
  publish("idle");
}

export function pauseNarration() {
  if (state.phase === "buffering" || state.phase === "loading") {
    pausedBetweenChunks = true;
    publish("paused", state.label);
  } else if (state.phase === "playing" && audio) {
    audio.pause();
    publish("paused", state.label, "", state.cue);
  }
}

export async function resumeNarration() {
  if (state.phase !== "paused") return;
  if (pausedBetweenChunks) {
    pausedBetweenChunks = false;
    publish("buffering", state.label);
    releasePauseWaiters();
    return;
  }
  if (!audio) return;
  const identity = sequence;
  try {
    await audio.play();
    if (identity === sequence) publish("playing", state.label, "", state.cue);
  } catch {
    if (identity === sequence) publish("error", "", "Browser blocked playback. Press READ to retry.");
  }
}

function cleaned(text: string): string {
  return text.replace(/\*\*|__|`|^#{1,6}\s/gm, "").replace(/\s+/g, " ").trim();
}

/** Exact same chunk boundaries as the server's finalized-scene prefetch. */
export function splitPassage(text: string, maxLength = 280): string[] {
  const value = cleaned(text);
  if (!value) return [];
  const pieces: string[] = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let at = remaining.lastIndexOf(". ", maxLength - 1);
    if (at < maxLength / 2) at = remaining.lastIndexOf(" ", maxLength);
    if (at < maxLength / 2) at = maxLength;
    else if (remaining.slice(at, at + 2) === ". ") at += 1;
    pieces.push(remaining.slice(0, at).trim());
    remaining = remaining.slice(at).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function keyFor(item: NarrationItem, voice: string): string {
  return JSON.stringify([item.text, voice]);
}

function rememberAudio(key: string, url: string) {
  cache.set(key, url);
  // Never revoke the source of the clip that is currently playing.
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    if (cache.get(oldest) === activeUrl) {
      cache.delete(oldest);
      cache.set(oldest, activeUrl);
      continue;
    }
    const evicted = cache.get(oldest);
    cache.delete(oldest);
    if (evicted) URL.revokeObjectURL(evicted);
  }
}

async function fetchSpeech(item: NarrationItem, voice: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new Error("Narration interrupted.");
  const key = keyFor(item, voice);
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    if (!signal.aborted) recordDiagnostic("local", 0, null, null);
    return cached;
  }
  // Capture metadata for the successful response, not while a request is in flight.
  // A cancelled chapter cannot increase the displayed performance counters.
  const networkCapture: { value: StoryTimeRequestDiagnostic | null } = { value: null };
  const started = Date.now();
  const blob = await synthesizeStoryTimeSpeech(
    { text: item.text, voice, speed: 1 }, signal,
    (value) => { networkCapture.value = value; },
  );
  if (signal.aborted) throw new Error("Narration interrupted.");
  if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Story Time returned invalid audio.");
  const url = URL.createObjectURL(blob);
  rememberAudio(key, url);
  recordDiagnostic(networkCapture.value?.source ?? "unknown", networkCapture.value?.requestMs ?? Date.now() - started,
    networkCapture.value?.serverMs ?? null, networkCapture.value?.inferenceMs ?? null);
  return url;
}

type Prepared = { url: string; error?: never } | { error: unknown; url?: never };

async function waitForUnpause(identity: number): Promise<void> {
  while (identity === sequence && pausedBetweenChunks) {
    await new Promise<void>(resolve => resumeWaiters.add(resolve));
  }
}

/** Abortable and pause-aware, including while transitioning between choices.
 * Timing affects only local playback, not the game or the network requests.
 */
async function waitForNarrationBeat(durationMs: number, identity: number, signal: AbortSignal) {
  let remaining = durationMs;
  while (remaining > 0 && identity === sequence && !signal.aborted) {
    await waitForUnpause(identity);
    if (identity !== sequence || signal.aborted) return;
    const slice = Math.min(remaining, 50);
    const started = Date.now();
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, slice);
      signal.addEventListener("abort", done, { once: true });
    });
    remaining -= Math.min(slice, Math.max(0, Date.now() - started));
  }
}

export async function playNarration(items: NarrationItem[]): Promise<void> {
  stopNarration();
  if (!items.length || !readAudioPreferences().narrationEnabled || !readAudioPreferences().storyTimeApproved) return;
  const identity = sequence;
  const controller = new AbortController();
  pending = controller;
  // Freeze the room voice for this entire playback, including prefetched chunks.
  const voice = adventureVoice ?? readAudioPreferences().narrationVoice;
  const prepared = new Map<number, Promise<Prepared>>();
  function fillWindow(index: number) {
    for (let i = index; i < Math.min(items.length, index + NARRATION_LOOKAHEAD + 1); i++) {
      if (prepared.has(i)) continue;
      // A settled result avoids unhandled rejections if a future chunk is
      // aborted before its turn to play, or if the player leaves the room.
      const job = fetchSpeech(items[i], voice, controller.signal).then(
        (url): Prepared => ({ url }),
        (error): Prepared => ({ error }),
      );
      prepared.set(i, job);
    }
  }

  try {
    fillWindow(0);
    for (let index = 0; index < items.length; index++) {
      if (identity !== sequence) return;
      const item = items[index];
      if (!pausedBetweenChunks) publish(index === 0 ? "loading" : "buffering", item.label);
      fillWindow(index);
      const result = await prepared.get(index)!;
      if (identity !== sequence) return;
      prepared.delete(index);
      if ("error" in result) throw result.error;
      if (state.phase === "paused") pausedBetweenChunks = true;
      await waitForUnpause(identity);
      if (identity !== sequence) return;

      const preference = readAudioPreferences();
      const beat = narrationTransitionMs(items[index - 1], item, preference.narrationDramaticPacing !== false, preference.narrationSpeed);
      if (beat) {
        publish("buffering", `BREATH // ${item.label}`);
        await waitForNarrationBeat(beat, identity, controller.signal);
        await waitForUnpause(identity);
        if (identity !== sequence || controller.signal.aborted) return;
      }

      const element = player();
      activeUrl = result.url!;
      element.src = activeUrl;
      adjustNarrationVolume();
      // Install handlers BEFORE play(). A short cached clip can finish in
      // the same microtask; never lose its ended notification.
      let onAbort: (() => void) | null = null;
      let onEnded: (() => void) | null = null;
      let onError: (() => void) | null = null;
      let onTimeUpdate: (() => void) | null = null;
      // Settle, rather than reject, this promise: an error may fire before
      // audio.play() resolves. Unobserved early rejections crash some browsers.
      const finished = new Promise<"ended" | "error" | "aborted">((resolve) => {
        onEnded = () => resolve("ended");
        onError = () => resolve("error");
        element.onended = onEnded;
        element.onerror = onError;
        // Never expose story text here. The page gates every cue on chapterReleased.
        // timeupdate follows HTMLAudioElement playbackRate automatically (0.5x..2x).
        onTimeUpdate = () => {
          if (identity !== sequence || (state.phase !== "playing" && state.phase !== "paused")) return;
          const duration = element.duration;
          if (!Number.isFinite(duration) || duration <= 0) return;
          const progress = Math.max(0, Math.min(1, element.currentTime / duration));
          if (Math.abs(progress - (state.cue?.progress ?? 0)) >= 0.02) {
            publish(state.phase, item.label, "", { kind: item.kind, index, text: item.text, progress });
          }
        };
        element.ontimeupdate = onTimeUpdate;
        onAbort = () => resolve("aborted");
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      try {
        // Some browsers leave play() pending when another chapter replaces
        // the source. Race it against ended/error/abort; gameplay and later
        // narration must never wait for a stale browser promise.
        const playback = Promise.resolve().then(() => element.play()).then(
          () => "started" as const,
        );
        const first = await Promise.race([playback, finished]);
        if (identity !== sequence || controller.signal.aborted) return;
        if (first === "started" && state.phase !== "paused") {
          publish("playing", item.label, "", {
            kind: item.kind, index, text: item.text, progress: 0,
          });
        }
        // The clip can finish or error before play() settles. `finished`
        // always resolves, so there is no unobserved rejection window.
        const outcome = first === "started" ? await finished : first;
        if (identity !== sequence || controller.signal.aborted) return;
        if (outcome === "error") throw new Error("Audio playback was interrupted.");
      } finally {
        // A newer narration may have reused the same <audio> element while
        // an old play() promise was pending. Never clear its event handlers.
        if (element.onended === onEnded) element.onended = null;
        if (element.onerror === onError) element.onerror = null;
        if (element.ontimeupdate === onTimeUpdate) element.ontimeupdate = null;
        if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      }
      if (identity !== sequence) return;
      if (state.phase === "paused") pausedBetweenChunks = true;
    }
    if (identity === sequence) publish("idle");
  } catch (reason) {
    if (identity === sequence) publish("error", "", reason instanceof Error ? reason.message : "Narration unavailable.");
  } finally {
    if (identity === sequence) {
      pending = null;
      activeUrl = null;
    }
  }
}

export function sceneNarrationItems(body: string, choices: readonly { label: string }[], includeChoices: boolean): NarrationItem[] {
  const story = splitPassage(body).map((text, index, chunks) => ({
    text, label: `STORY ${index + 1}/${chunks.length}`, kind: "story" as const,
  }));
  return includeChoices ? [...story, ...choiceNarrationItems(choices)] : story;
}

export function choiceNarrationItems(choices: readonly { label: string }[]): NarrationItem[] {
  return choices.flatMap((choice, index) => splitPassage(`Option ${index + 1}. ${choice.label}`).map(text => ({
    text, label: `CHOICE ${index + 1}`, kind: "choice" as const,
  })));
}
