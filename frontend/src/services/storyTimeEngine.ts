/** Optional hosted Story Time. Never runs a model on the player's device. */
import { readAudioPreferences } from "./audioPreferences";

export type StoryTimePhase = "idle" | "downloading" | "ready" | "error";
export interface StoryTimeState { phase: StoryTimePhase; percent: number | null; message: string; }
export interface StoryTimeRequest { text: string; voice: string; speed: number; room_code?: string; }
/** Safe, non-identifying per-passage performance data from existing response headers. */
export interface StoryTimeRequestDiagnostic {
  source: "memory" | "s3" | "generated" | "unknown";
  requestMs: number;
  serverMs: number | null;
  inferenceMs: number | null;
}

function finiteNonnegativeMs(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

export function responseDiagnostic(response: Response, requestMs: number): StoryTimeRequestDiagnostic {
  // Headers may be inaccessible across an unconfigured CORS boundary.
  const read = (name: string) => response.headers?.get(name) ?? null;
  const value = read("X-Story-Time-Cache");
  const source: StoryTimeRequestDiagnostic["source"] =
    value === "memory" || value === "s3" || value === "generated" ? value : "unknown";
  return {
    source,
    requestMs: Math.max(0, Math.round(requestMs)),
    serverMs: finiteNonnegativeMs(read("X-Story-Time-Server-Ms")),
    inferenceMs: finiteNonnegativeMs(read("X-Story-Time-Inference-Ms")),
  };
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const current: StoryTimeState = { phase: "idle", percent: null, message: "" };
const listeners = new Set<(state: StoryTimeState) => void>();
let readiness: Promise<void> | null = null;
let generation = 0;
let startupController: AbortController | null = null;
const STARTUP_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 5_000;

function update(phase: StoryTimePhase, message = "") {
  Object.assign(current, { phase, message, percent: null });
  for (const listener of listeners) listener({ ...current });
}
export function observeStoryTime(fn: (state: StoryTimeState) => void) {
  listeners.add(fn); fn({ ...current });
  return () => { listeners.delete(fn); };
}
export function stopStoryTimeEngine() {
  ++generation;
  startupController?.abort();
  startupController = null;
  readiness = null;
  update("idle");
}

function interrupted(): DOMException {
  return new DOMException("Narration interrupted", "AbortError");
}

/** A cancelled listener must not wait for shared narrator startup. Do not
 * abort the shared startup when just one passage/room is cancelled.
 */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(interrupted());
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cleanup(); reject(interrupted()); };
    const cleanup = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, reason => { cleanup(); reject(reason); });
    if (signal.aborted) abort();
  });
}

function waitForPoll(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(interrupted()); return; }
    const abort = () => { clearTimeout(timer); reject(interrupted()); };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
export function prepareStoryTime(): Promise<void> {
  if (!readAudioPreferences().narrationEnabled) return Promise.reject(new Error("Enable Story Time first."));
  if (current.phase === "ready") return Promise.resolve();
  if (readiness) return readiness;
  const sequence = generation;
  const controller = new AbortController();
  startupController = controller;
  update("downloading", "CONNECTING TO STORY TIME_");
  let request: Promise<void>;
  request = (async () => {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (sequence === generation && !controller.signal.aborted) {
      const response = await fetch(`${API_BASE}/api/narration/status`, {
        credentials: "include", signal: controller.signal,
      });
      if (sequence !== generation || controller.signal.aborted) throw interrupted();
      if (!response.ok) throw new Error("Story Time is not available at the moment.");
      const status = await response.json() as { available?: boolean; state?: string };
      if (sequence !== generation || controller.signal.aborted) throw interrupted();
      if (status.available) {
        update("ready", "STORY TIME IS READY");
        return;
      }
      if (status.state === "budget_exhausted") throw new Error("Story Time's monthly allowance has been reached.");
      if (status.state !== "starting" && status.state !== "pending") {
        throw new Error("The storyteller is resting. Try again later.");
      }
      if (Date.now() >= deadline) throw new Error("The storyteller is taking longer to wake. Try again shortly.");
      update("downloading", "THE STORYTELLER IS AWAKENING_");
      await waitForPoll(POLL_INTERVAL_MS, controller.signal);
    }
    throw interrupted();
  })().catch(error => {
    if (sequence === generation && !controller.signal.aborted)
      update("error", error instanceof Error ? error.message : "Story Time unavailable.");
    throw error;
  }).finally(() => {
    if (readiness === request) readiness = null;
    if (startupController === controller) startupController = null;
  });
  readiness = request;
  return request;
}
export async function synthesizeStoryTimeSpeech(
  input: StoryTimeRequest,
  signal: AbortSignal,
  onDiagnostic?: (diagnostic: StoryTimeRequestDiagnostic) => void,
): Promise<Blob> {
  if (signal.aborted) throw new DOMException("Narration interrupted", "AbortError");
  // Count the entire listener wait, including narrator status/startup and 503 retries.
  const requestStarted = Date.now();
  await withAbort(prepareStoryTime(), signal);
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let response: Response;
  while (true) {
    if (signal.aborted) throw new DOMException("Narration interrupted", "AbortError");
    response = await fetch(`${API_BASE}/api/narration/speech`, {
      method: "POST", credentials: "include", signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, kind: "story" }),
    });
    if (response.ok) break;
    if (response.status !== 503 || Date.now() >= deadline) {
      throw new Error(response.status === 503
        ? "Story Time is taking too long to wake. Continue reading and try again."
        : "Story Time could not prepare this passage.");
    }
    // The game state is never gated by this asynchronous narration retry.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, 6_000);
      function onAbort() { clearTimeout(timer); reject(new DOMException("Narration interrupted", "AbortError")); }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  const blob = await response.blob();
  if (signal.aborted) throw interrupted();
  if (!blob.type.startsWith("audio/") || !blob.size) throw new Error("Invalid narration response.");
  // Only successful, uncancelled audio is counted. No text or account data is retained.
  onDiagnostic?.(responseDiagnostic(response, Date.now() - requestStarted));
  return blob;
}

/** Heartbeat only while an actual room with Story Time enabled is active. */
export async function keepStoryTimeAlive(roomCode: string, enabled = true): Promise<void> {
  if (!roomCode.trim()) return;
  try {
    await fetch(`${API_BASE}/api/narration/heartbeat`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_code: roomCode, enabled }),
    });
  } catch { /* Never interfere with gameplay. */ }
}
