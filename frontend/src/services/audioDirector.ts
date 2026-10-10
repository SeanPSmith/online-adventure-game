import { readAudioPreferences } from "./audioPreferences";

/** SFX only. Never request microphones or play narration here. */
export type SoundCue =
  | "ui" | "chapter" | "lock" | "dice-roll" | "success" | "failure"
  | "critical" | "critical-fail" | "xp" | "level-up" | "injury" | "death"
  | "qte-start" | "qte-success" | "qte-neutral" | "qte-fail" | "arcade";

type Tone = readonly [frequency: number, duration: number, gain: number, wave?: OscillatorType, delay?: number];
const PALETTE: Record<SoundCue, readonly Tone[]> = {
  ui: [[470, .045, .13, "triangle"]],
  chapter: [[330, .13, .16, "sine"], [494, .15, .12, "sine", .10]],
  lock: [[340, .07, .19, "triangle"], [270, .08, .15, "triangle", .07]],
  "dice-roll": [[150, .055, .10, "triangle"], [205, .055, .10, "triangle", .075], [260, .07, .10, "triangle", .15]],
  success: [[390, .11, .15], [587, .17, .15, "sine", .12]],
  failure: [[250, .13, .15, "triangle"], [185, .17, .14, "triangle", .12]],
  critical: [[390, .11, .16], [587, .12, .16, "sine", .10], [784, .25, .17, "sine", .22]],
  "critical-fail": [[320, .14, .17, "triangle"], [210, .22, .18, "triangle", .13]],
  xp: [[640, .08, .12, "sine"], [880, .1, .11, "sine", .08]],
  "level-up": [[440, .11, .15], [554, .12, .15, "sine", .11], [659, .14, .15, "sine", .23], [880, .24, .18, "sine", .37]],
  injury: [[140, .2, .18, "triangle"]],
  death: [[180, .46, .22, "sine"], [135, .55, .13, "sine", .3]],
  "qte-start": [[580, .06, .12, "sine"], [730, .075, .11, "sine", .1]],
  "qte-success": [[500, .085, .14, "sine"], [730, .12, .12, "sine", .08]],
  "qte-neutral": [[440, .1, .11, "sine"]],
  "qte-fail": [[300, .1, .15, "triangle"], [230, .12, .13, "triangle", .1]],
  arcade: [[510, .055, .1, "square"], [730, .06, .085, "square", .07]],
};

let context: AudioContext | null = null;
const played = new Set<string>();
const MAX_KEYS = 800;
const recent = new Map<SoundCue, number>();

// Session-scoped IDs make reconnect/reload idempotent without disabling future turns.
function alreadyPlayed(id: string): boolean {
  if (played.has(id)) return true;
  try { return sessionStorage.getItem(`tot:sound:${id}`) === "1"; } catch { return false; }
}
function markPlayed(id: string) {
  if (played.size >= MAX_KEYS) played.clear();
  played.add(id);
  try { sessionStorage.setItem(`tot:sound:${id}`, "1"); } catch { /* optional */ }
}

export function activateAudioFromGesture(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!context) {
      const Constructor = window.AudioContext;
      if (!Constructor) return false;
      context = new Constructor();
    }
    if (context.state === "suspended") void context.resume().catch(() => {});
    return true;
  } catch { return false; }
}

/** No implicit audio initialization: player must enable audio via a real gesture. */
export function playSound(cue: SoundCue, eventId?: string): boolean {
  const settings = readAudioPreferences();
  if (!settings.effectsEnabled || !context || context.state === "closed") return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  if (eventId && alreadyPlayed(eventId)) return false;
  const nowMs = Date.now();
  if (!eventId && nowMs - (recent.get(cue) ?? 0) < 75) return false;
  const mixer = (settings.masterVolume / 100) *
    ((cue === "arcade" ? settings.arcadeVolume : settings.effectsVolume) / 100);
  if (mixer <= 0) return false;
  try {
    const now = context.currentTime;
    // Quiet synthesized chimes; hard cap per-tone peak and <= 4 oscillators per cue.
    for (const [freq, duration, gain, wave = "sine", delay = 0] of PALETTE[cue]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(freq, now + delay);
      envelope.gain.setValueAtTime(0.0001, now + delay);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * mixer), now + delay + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + .025);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    }
    recent.set(cue, nowMs);
    if (eventId) markPlayed(eventId);
    return true;
  } catch { return false; }
}

/** Test helper also releases audio resources when navigating away from the application. */
export async function closeAudioDirector() {
  const current = context;
  context = null;
  if (current && current.state !== "closed") await current.close();
}
