/** Story Time: opt-in, full fp32 Kokoro inference in the player's own browser. */
import { readAudioPreferences } from "./audioPreferences";

export type StoryTimePhase = "idle" | "downloading" | "ready" | "error";
export interface StoryTimeState { phase: StoryTimePhase; percent: number | null; message: string; }
export interface StoryTimeRequest { text: string; voice: string; speed: number; }

const current: StoryTimeState = { phase: "idle", percent: null, message: "" };
const listeners = new Set<(state: StoryTimeState) => void>();
let worker: Worker | null = null;
let start: Promise<void> | null = null;
let startedResolve: (() => void) | null = null;
let startedReject: ((reason: Error) => void) | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (value: Blob) => void; reject: (reason: Error) => void }>();

export function observeStoryTime(fn: (state: StoryTimeState) => void): () => void {
  listeners.add(fn);
  fn({ ...current });
  return () => { listeners.delete(fn); };
}

function update(phase: StoryTimePhase, message = "", percent: number | null = null) {
  Object.assign(current, { phase, message, percent });
  for (const listener of listeners) listener({ ...current });
}

function failure(message: string) {
  const error = new Error(message);
  startedReject?.(error);
  startedResolve = null;
  startedReject = null;
  for (const task of pending.values()) task.reject(error);
  pending.clear();
  start = null;
  worker?.terminate();
  worker = null;
  update("error", message);
}

/** Stop local inference and any in-flight download when a player switches Story Time off. */
export function stopStoryTimeEngine(): void {
  const interrupted = new Error("Story Time switched off.");
  startedReject?.(interrupted);
  startedResolve = null;
  startedReject = null;
  for (const task of pending.values()) task.reject(interrupted);
  pending.clear();
  start = null;
  worker?.terminate();
  worker = null;
  update("idle");
}

/** Never start downloading unless the player has explicitly approved it. */
export function prepareStoryTime(): Promise<void> {
  if (!readAudioPreferences().storyTimeApproved) return Promise.reject(new Error("Enable Story Time and approve the model download first."));
  if (current.phase === "ready" && worker) return Promise.resolve();
  if (start) return start;
  if (typeof Worker === "undefined") {
    update("error", "This browser cannot run the Story Time voice engine.");
    return Promise.reject(new Error(current.message));
  }
  update("downloading", "PREPARING YOUR STORYTELLER...");
  start = new Promise<void>((resolve, reject) => { startedResolve = resolve; startedReject = reject; });
  try {
    worker = new Worker(new URL("./storyTimeWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{
      type: "progress" | "ready" | "error" | "audio" | "speechError";
      status?: string; percent?: number | null; file?: string; message?: string; id?: number; blob?: Blob;
    }>) => {
      const data = event.data;
      if (data.type === "progress") {
        const label = data.status === "fallback" ? "GPU unavailable; preparing CPU narration" :
          data.status === "progress" ? "DOWNLOADING STORY TIME MODEL" : "LOADING STORY TIME";
        update("downloading", data.file && data.status === "fallback" ? data.file : label,
          typeof data.percent === "number" && Number.isFinite(data.percent) ? Math.max(0, Math.min(100, data.percent)) : null);
      } else if (data.type === "ready") {
        update("ready", "STORY TIME IS READY");
        startedResolve?.(); startedResolve = null; startedReject = null;
      } else if (data.type === "error") {
        failure(data.message || "The narrator could not load. Check available device memory and retry.");
      } else if (data.type === "audio" && typeof data.id === "number" && data.blob) {
        const task = pending.get(data.id); pending.delete(data.id); task?.resolve(data.blob);
      } else if (data.type === "speechError" && typeof data.id === "number") {
        const task = pending.get(data.id); pending.delete(data.id);
        task?.reject(new Error(data.message || "Unable to read that passage."));
      }
    };
    worker.onerror = () => failure("Story Time stopped unexpectedly. Your device may need more free memory.");
    worker.postMessage({ type: "init" });
  } catch (error) { failure(error instanceof Error ? error.message : "Story Time could not start."); }
  return start ?? Promise.reject(new Error("Story Time could not start."));
}

export async function synthesizeStoryTimeSpeech(input: StoryTimeRequest, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted) throw new DOMException("Narration interrupted", "AbortError");
  await prepareStoryTime();
  if (!worker || signal.aborted) throw new DOMException("Narration interrupted", "AbortError");
  const id = ++nextId;
  return new Promise<Blob>((resolve, reject) => {
    const abort = () => { pending.delete(id); reject(new DOMException("Narration interrupted", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    pending.set(id, {
      resolve: blob => { signal.removeEventListener("abort", abort); resolve(blob); },
      reject: error => { signal.removeEventListener("abort", abort); reject(error); },
    });
    worker!.postMessage({ type: "speak", id, ...input });
  });
}
