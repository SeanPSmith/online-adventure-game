/** Kokoro speech playback. No microphone, speech recognition, or voice recording. */
import { readAudioPreferences } from "./audioPreferences";
import { synthesizeStoryTimeSpeech } from "./storyTimeEngine";

export type NarrationPhase = "idle" | "loading" | "playing" | "paused" | "error";
export interface NarrationState { phase: NarrationPhase; label: string; error: string; }
export interface NarrationItem { text: string; label: string; kind: "story" | "choice"; }

const state: NarrationState = { phase: "idle", label: "", error: "" };
const subscribers = new Set<(value: NarrationState) => void>();
const cache = new Map<string, string>();
const CACHE_LIMIT = 24;
let audio: HTMLAudioElement | null = null;
let sequence = 0;
let pending: AbortController | null = null;

export function observeNarration(callback: (value: NarrationState) => void): () => void {
  subscribers.add(callback);
  callback({ ...state });
  return () => { subscribers.delete(callback); };
}

function publish(phase: NarrationPhase, label = "", error = "") {
  Object.assign(state, { phase, label, error });
  for (const callback of subscribers) callback({ ...state });
}

function player(): HTMLAudioElement {
  if (!audio) audio = new Audio();
  return audio;
}

export function adjustNarrationVolume() {
  if (audio) audio.volume = readAudioPreferences().narrationVolume / 100;
}

export function stopNarration() {
  ++sequence;
  pending?.abort();
  pending = null;
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio.removeAttribute("src");
    audio.load();
  }
  publish("idle");
}

export function pauseNarration() {
  if (state.phase !== "playing" || !audio) return;
  audio.pause();
  publish("paused", state.label);
}

export async function resumeNarration() {
  if (state.phase !== "paused" || !audio) return;
  try {
    await audio.play();
    publish("playing", state.label);
  } catch {
    publish("error", "", "Browser blocked playback. Press READ to retry.");
  }
}

function cleaned(text: string): string {
  return text.replace(/\*\*|__|`|^#{1,6}\s/gm, "").replace(/\s+/g, " ").trim();
}

/** Chunk long scenes so every request stays under the server's 1,800 character limit. */
export function splitPassage(text: string, maxLength = 1300): string[] {
  const value = cleaned(text);
  if (!value) return [];
  const pieces: string[] = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let at = remaining.lastIndexOf(". ", maxLength);
    if (at < maxLength / 2) at = remaining.lastIndexOf(" ", maxLength);
    if (at < maxLength / 2) at = maxLength;
    else if (remaining.slice(at, at + 2) === ". ") at += 1;
    pieces.push(remaining.slice(0, at).trim());
    remaining = remaining.slice(at).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function keyFor(item: NarrationItem): string {
  const prefs = readAudioPreferences();
  return JSON.stringify([item.text, prefs.narrationVoice, prefs.narrationSpeed]);
}

async function fetchSpeech(item: NarrationItem, signal: AbortSignal): Promise<string> {
  const key = keyFor(item);
  const old = cache.get(key);
  if (old) {
    cache.delete(key);
    cache.set(key, old);
    return old;
  }
  const prefs = readAudioPreferences();
  const blob = await synthesizeStoryTimeSpeech({
    text: item.text, voice: prefs.narrationVoice, speed: prefs.narrationSpeed,
  }, signal);
  if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Story Time returned invalid audio.");
  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  while (cache.size > CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (!first) break;
    const previous = cache.get(first);
    cache.delete(first);
    if (previous) URL.revokeObjectURL(previous);
  }
  return url;
}

export async function playNarration(items: NarrationItem[]): Promise<void> {
  stopNarration();
  if (!items.length || !readAudioPreferences().narrationEnabled || !readAudioPreferences().storyTimeApproved) return;
  const identity = sequence;
  const controller = new AbortController();
  pending = controller;
  for (const item of items) {
    if (identity !== sequence) return;
    publish("loading", item.label);
    try {
      const url = await fetchSpeech(item, controller.signal);
      if (identity !== sequence) return;
      const element = player();
      element.src = url;
      adjustNarrationVolume();
      // Install onended BEFORE calling play(): very short clips can finish
      // immediately, otherwise the queue could wait forever.
      const finished = new Promise<void>((resolve, reject) => {
        element.onended = () => resolve();
        element.onerror = () => reject(new Error("Audio playback was interrupted."));
        controller.signal.addEventListener("abort", () => resolve(), { once: true });
      });
      await element.play();
      if (identity !== sequence) return;
      publish("playing", item.label);
      await finished;
      element.onended = null;
      element.onerror = null;
    } catch (reason) {
      if (identity !== sequence) return;
      publish("error", "", reason instanceof Error ? reason.message : "Narration unavailable.");
      return;
    }
  }
  if (identity === sequence) publish("idle");
}

export function sceneNarrationItems(body: string, choices: readonly { label: string }[], includeChoices: boolean): NarrationItem[] {
  const story = splitPassage(body).map((text, index) => ({ text, label: `CHAPTER ${index + 1}`, kind: "story" as const }));
  return includeChoices ? [...story, ...choiceNarrationItems(choices)] : story;
}

export function choiceNarrationItems(choices: readonly { label: string }[]): NarrationItem[] {
  return choices.flatMap((choice, index) => splitPassage(`Option ${index + 1}. ${choice.label}`).map(text => ({
    text, label: `CHOICE ${index + 1}`, kind: "choice" as const,
  })));
}
