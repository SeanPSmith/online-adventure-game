import { useEffect, useMemo, useRef, useState } from "react";
import { narratorVoiceLabel, readAudioPreferences } from "../../services/audioPreferences";
import { TerminalSelect } from "../ui/TerminalSelect";
import { listArchivedNarration, archivedNarrationUrl, type ArchivedNarrationClip } from "../../services/characters";

/** Only available to a logged-in participant of a completed adventure. */
export function ArchivedChronicleAudio({ historyId }: { historyId: string }) {
  const [recorded, setRecorded] = useState<ArchivedNarrationClip[] | null>(null);
  const [preferredVoice, setPreferredVoice] = useState(() => readAudioPreferences().narrationVoice);
  // Co-op players can record multiple voices for the same passage. Present
  // one continuous track, selecting the preferred version where available.
  const clips = useMemo(() => {
    if (!recorded) return null;
    const selected = new Map<string, ArchivedNarrationClip>();
    for (const clip of recorded) {
      const key = `${clip.turn_number}:${clip.position}`;
      const current = selected.get(key);
      if (!current || (clip.voice === preferredVoice && current.voice !== preferredVoice)) selected.set(key, clip);
    }
    return [...selected.values()];
  }, [recorded, preferredVoice]);
  const availableVoices = useMemo(() => [...new Set((recorded ?? []).map(clip => clip.voice))], [recorded]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const player = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    return () => { if (player.current) player.current.pause(); };
  }, []);

  useEffect(() => {
    if (!playing || !player.current || !clips?.length) return;
    const el = player.current;
    void el.play().catch(() => { setPlaying(false); setError("Press PLAY to resume narration."); });
  }, [index, clips, playing]);

  async function openArchive() {
    setError("");
    try {
      const response = await listArchivedNarration(historyId);
      setRecorded(response.clips);
      setIndex(0);
      setPlaying(false);
    } catch {
      setError("The Chronicle audio could not be opened.");
    }
  }

  return (
    <div className="chronicle-audio">
      {clips === null ? (
        <button className="button button-quiet" type="button" onClick={() => void openArchive()}>
          LISTEN TO CHRONICLE
        </button>
      ) : clips.length === 0 ? (
        <p className="muted-copy">No saved narration for this Chronicle. Older adventures aren't backfilled.</p>
      ) : (
        <div>
          <span className="eyebrow">CHRONICLE AUDIO // {index + 1} OF {clips.length}</span>
          {availableVoices.length > 1 ? <div className="chronicle-voice-track">
            <span>PREFERRED NARRATOR TRACK</span>
            <TerminalSelect ariaLabel="Preferred Chronicle narrator track" value={preferredVoice}
              options={[
                ...(!availableVoices.includes(preferredVoice)
                  ? [{ value: preferredVoice, label: "YOUR CURRENT VOICE" }] : []),
                ...availableVoices.map(voice => ({ value: voice, label: narratorVoiceLabel(voice) })),
              ]}
              onChange={voice => {
                player.current?.pause();
                setPlaying(false);
                setIndex(0);
                setPreferredVoice(voice);
              }} />
            <small>Each scene plays once, favoring your selected voice when recorded.</small>
          </div> : null}
          <p className="muted-copy">TURN {clips[index].turn_number} · {clips[index].kind.toUpperCase()} · {narratorVoiceLabel(clips[index].voice)}</p>
          <audio ref={player} controls preload="none" src={archivedNarrationUrl(historyId, clips[index].clip_id)}
            onPlay={() => setPlaying(true)}
            onError={() => { setPlaying(false); setError("This saved audio clip is unavailable."); }}
            onEnded={() => {
              if (index + 1 < clips.length) { setPlaying(true); setIndex(current => current + 1); }
              else setPlaying(false);
            }}
          >Your browser does not support MP3 playback.</audio>
          <div className="history-card-actions">
            <button type="button" className="button button-quiet" disabled={index === 0}
              onClick={() => { setPlaying(false); setIndex(i => i - 1); }}>PREVIOUS</button>
            <button type="button" className="button button-quiet" disabled={index + 1 === clips.length}
              onClick={() => { setPlaying(false); setIndex(i => i + 1); }}>NEXT</button>
          </div>
        </div>
      )}
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </div>
  );
}
