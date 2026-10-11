/** Optional hosted Story Time. Never runs a model on the player's device. */
import { readAudioPreferences } from "./audioPreferences";

export type StoryTimePhase = "idle" | "downloading" | "ready" | "error";
export interface StoryTimeState { phase: StoryTimePhase; percent: number | null; message: string; }
export interface StoryTimeRequest { text: string; voice: string; speed: number; }

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const current: StoryTimeState = { phase: "idle", percent: null, message: "" };
const listeners = new Set<(state: StoryTimeState) => void>();
let readiness: Promise<void> | null = null;
let generation = 0;
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
  readiness = null;
  update("idle");
}
export function prepareStoryTime(): Promise<void> {
  if (!readAudioPreferences().narrationEnabled) return Promise.reject(new Error("Enable Story Time first."));
  if (current.phase === "ready") return Promise.resolve();
  if (readiness) return readiness;
  const sequence = generation;
  update("downloading", "CONNECTING TO STORY TIME_");
  let request: Promise<void>;
  request = (async () => {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (sequence === generation) {
      const response = await fetch(`${API_BASE}/api/narration/status`, { credentials: "include" });
      if (!response.ok) throw new Error("Story Time is not available at the moment.");
      const status = await response.json() as { available?: boolean; state?: string };
      if (status.available) {
        if (sequence === generation) update("ready", "STORY TIME IS READY");
        return;
      }
      if (status.state === "budget_exhausted") throw new Error("Story Time's monthly allowance has been reached.");
      if (status.state !== "starting" && status.state !== "pending") {
        throw new Error("The storyteller is resting. Try again later.");
      }
      if (Date.now() >= deadline) throw new Error("The storyteller is taking longer to wake. Try again shortly.");
      update("downloading", "THE STORYTELLER IS AWAKENING_");
      await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  })().catch(error => {
    if (sequence === generation) update("error", error instanceof Error ? error.message : "Story Time unavailable.");
    throw error;
  }).finally(() => { if (readiness === request) readiness = null; });
  readiness = request;
  return request;
}
export async function synthesizeStoryTimeSpeech(input: StoryTimeRequest, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted) throw new DOMException("Narration interrupted", "AbortError");
  await prepareStoryTime();
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
  if (!blob.type.startsWith("audio/") || !blob.size) throw new Error("Invalid narration response.");
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
