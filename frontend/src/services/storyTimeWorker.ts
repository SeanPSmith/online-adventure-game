/** Full-precision local story narration. Never sends story text to a speech server. */
import { KokoroTTS } from "kokoro-js";
import { KOKORO_VOICES } from "./audioPreferences";

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
type TTS = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>;
let model: TTS | null = null;
let loading: Promise<TTS> | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function initialize(): Promise<TTS> {
  if (model) return model;
  if (loading) return loading;
  loading = (async () => {
    let device: "webgpu" | "wasm" = "wasm";
    try {
      if (typeof navigator !== "undefined" && "gpu" in navigator) {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
        if (gpu && await gpu.requestAdapter()) device = "webgpu";
      }
    } catch { /* Not every mobile browser exposes a working GPU adapter. */ }
    const load = (using: "wasm" | "webgpu") => KokoroTTS.from_pretrained(MODEL, {
      dtype: "fp32", device: using,
      progress_callback: (info: { status?: string; progress?: number; file?: string }) => {
        self.postMessage({ type: "progress", status: info.status ?? "loading", percent: typeof info.progress === "number" ? Math.round(info.progress) : null, file: info.file ?? "" });
      },
    });
    try {
      return await load(device);
    } catch (error) {
      if (device !== "webgpu") throw error;
      self.postMessage({ type: "progress", status: "fallback", percent: null, file: "WebGPU unavailable. Trying CPU." });
      return load("wasm");
    }
  })();
  try {
    model = await loading;
    self.postMessage({ type: "ready" });
    return model;
  } catch (error) {
    loading = null;
    self.postMessage({ type: "error", message: `Story Time could not load on this device: ${errorMessage(error)}` });
    throw error;
  }
}

self.addEventListener("message", (event: MessageEvent<
  | { type: "init" }
  | { type: "speak"; id: number; text: string; voice: string; speed: number }
>) => {
  const item = event.data;
  if (item.type === "init") { void initialize().catch(() => {}); return; }
  if (item.type !== "speak") return;
  void (async () => {
    try {
      const engine = await initialize();
      // A worker message can contain any string. Only allow supported voices;
      // preserve Kokoro's typed voice union without an unsafe type assertion.
      const voice = KOKORO_VOICES.find(option => option.value === item.voice)?.value ?? "af_heart";
      const generated = await engine.generate(item.text, { voice, speed: item.speed });
      const blob = generated.toBlob();
      self.postMessage({ type: "audio", id: item.id, blob });
    } catch (error) {
      self.postMessage({ type: "speechError", id: item.id, message: errorMessage(error) });
    }
  })();
});
