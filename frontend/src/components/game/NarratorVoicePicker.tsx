import { useEffect, useMemo, useRef, useState } from "react";
import { KOKORO_VOICES } from "../../services/audioPreferences";
import { pauseNarration } from "../../services/storyNarrator";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const GROUPS = ["Featured", "American Female", "American Male", "British Female", "British Male"] as const;

/** Personal voice selection. Samples are private, pre-generated S3 audio only;
 * merely browsing or pressing Preview never starts the GPU. */
export function NarratorVoicePicker({
  value, onChange, disabled = false,
}: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [previewing, setPreviewing] = useState("");
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const groups = useMemo(() => {
    const filter = search.trim().toLowerCase();
    return GROUPS.map(group => ({
      group,
      voices: KOKORO_VOICES.filter(v => {
        const category = v.featured && group === "Featured" ||
          !v.featured && group === `${v.accent} ${v.gender}`;
        return category && (!filter || `${v.value} ${v.label} ${v.accent} ${v.gender}`.toLowerCase().includes(filter));
      }),
    })).filter(row => row.voices.length > 0);
  }, [search]);
  function stopPreview() {
    requestRef.current?.abort();
    requestRef.current = null;
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.removeAttribute("src"); audioRef.current.load();
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setPreviewing("");
  }
  useEffect(() => () => {
    requestRef.current?.abort();
    audioRef.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);
  async function preview(voice: string) {
    if (previewing === voice) { stopPreview(); return; }
    stopPreview();
    const controller = new AbortController();
    requestRef.current = controller;
    setNotice("");
    setPreviewing(voice);
    try {
      const response = await fetch(`${API_BASE}/api/narration/previews/${voice}`, {
        credentials: "include", signal: controller.signal,
      });
      if (response.status === 404) throw new Error("Voice samples are still being prepared by an administrator.");
      if (!response.ok) throw new Error("That voice sample is temporarily unavailable.");
      const blob = await response.blob();
      if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("That sample is not playable.");
      if (controller.signal.aborted) return;
      pauseNarration(); // only pause the chapter when a playable sample exists.
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => { stopPreview(); };
      audio.onerror = () => { setNotice("Unable to play the sample."); stopPreview(); };
      await audio.play();
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice(error instanceof Error ? error.message : "Unable to play the sample.");
        stopPreview();
      }
    }
  }
  const selected = KOKORO_VOICES.find(v => v.value === value);
  return <div className="narrator-voice-picker">
    <button type="button" className="button narrator-voice-current" aria-expanded={open}
      aria-label="Choose your narrator voice" disabled={disabled} onClick={() => setOpen(!open)}>
      {selected?.label ?? "Choose a narrator"} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
    {open && !disabled ? <div className="narrator-voice-library">
      <label className="narrator-voice-filter">FIND YOUR VOICE
        <input aria-label="Search narrator voices" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search 28 English narrators" />
      </label>
      <div className="narrator-voice-results">
        {groups.map(({group,voices}) => <div key={group} className="narrator-voice-group">
          <strong>{group.toUpperCase()}</strong>
          {voices.map(voice => <div className="narrator-voice-option" key={`${group}:${voice.value}`}>
            <button type="button" className={`button button-quiet ${voice.value === value ? "is-selected" : ""}`}
              aria-pressed={voice.value === value} onClick={() => { onChange(voice.value); setNotice(""); }}>
              {voice.value === value ? "● " : "○ "}{voice.label}
            </button>
            <button type="button" className="button button-quiet" aria-label={`Preview ${voice.label}`}
              aria-pressed={previewing === voice.value} onClick={() => void preview(voice.value)}>
              {previewing === voice.value ? "STOP" : "▶ PLAY"}
            </button>
          </div>)}
        </div>)}
        {!groups.length && <small>No voices match your search.</small>}
      </div>
      <small>Voice changes take effect on the next narrated clip. Preview audio is served from a saved sample and will not wake the GPU.</small>
      {notice && <small role="status">{notice}</small>}
    </div> : null}
  </div>;
}
