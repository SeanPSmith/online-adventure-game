import "./quillairoAiModels.css";
import { useEffect, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { getGlobalAiModels, saveGlobalAiModels } from "../../services/auth";

const MODEL_NAMES: Record<string, string> = {
  "gpt-5.6-sol": "GPT-5.6 Sol — established story model",
  "gpt-6.1-sol": "GPT-6.1 Sol — newest story model (test)",
  "gpt-5.6-luna": "GPT-5.6 Luna — established fast model",
  "gpt-6-luna": "GPT-6 Luna — newest fast model (test)",
};

export function GlobalAiModelSettings() {
  const [story, setStory] = useState("");
  const [recap, setRecap] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading global AI settings…");
  useEffect(() => {
    let mounted = true;
    void getGlobalAiModels().then((data) => {
      if (!mounted) return;
      setStory(data.story_model);
      setRecap(data.economy_model);
      setSaved(`${data.story_model}|${data.economy_model}`);
      setOptions(data.available_models);
      setMessage("");
    }).catch((error: unknown) => {
      if (mounted) setMessage(error instanceof Error ? error.message : "Model settings unavailable.");
    });
    return () => { mounted = false; };
  }, []);

  async function save() {
    if (!story || !recap || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await saveGlobalAiModels(story, recap);
      setStory(data.story_model);
      setRecap(data.economy_model);
      setSaved(`${data.story_model}|${data.economy_model}`);
      setMessage("Global AI preferences saved. The next requests will use these models.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving the AI models failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="quill-settings-block quill-settings-ai" id="quill-settings-ai">
    <Panel title="AI DIRECTOR · GLOBAL MODEL SELECTION">
      <p className="muted-copy">Administrator settings for the entire site. A change affects subsequent generation requests, not a turn already being written. Models must be enabled on your OpenAI API account.</p>
      <div className="quill-ai-model-grid">
        {([
          { label: "STORY DIRECTOR AI", value: story, onSelect: setStory, note: "Writes new chapters. More capable models may take longer." },
          { label: "RECAP / REPAIR / TIMEOUT RESCUE AI", value: recap, onSelect: setRecap, note: "Reads frozen dice facts and handles bounded retries; a fast model is recommended." },
        ]).map((group) => <div className="quill-ai-model-field" key={group.label}>
          <strong>{group.label}</strong>
          <div className="quill-ai-model-options" role="group" aria-label={group.label}>
            {options.map((model) => <button key={model} type="button"
              className={`quill-ai-model-option${group.value === model ? " is-selected" : ""}`}
              aria-pressed={group.value === model}
              disabled={busy}
              onClick={() => group.onSelect(model)}>
              {MODEL_NAMES[model] || model}
            </button>)}
          </div>
          <small>{group.note}</small>
        </div>)}
      </div>
      <div className="button-row">
        <button type="button" className="button button-primary" disabled={busy || !story || !recap || saved === `${story}|${recap}`} onClick={() => void save()}>{busy ? "SAVING…" : "SAVE GLOBAL AI MODELS"}</button>
      </div>
      {message ? <p className="system-notice" role="status">{message}</p> : null}
    </Panel>
  </div>;
}
