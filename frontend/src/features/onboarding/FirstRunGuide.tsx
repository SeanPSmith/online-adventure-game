import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Panel } from "../../components/ui/Panel";
import { TerminalSelect } from "../../components/ui/TerminalSelect";
import { apiFetch } from "../../services/api";
import type { Character } from "../../services/characters";

interface Props {
 heroes: Character[];
 selectedHeroId: string;
 onSelectHero: (id: string) => void;
 connected: boolean;
 starterAvailable: boolean;
 creating: boolean;
 onStart: (mode: "solo" | "coop") => void;
}
export function FirstRunGuide({heroes, selectedHeroId, onSelectHero, connected, starterAvailable, creating, onStart}: Props) {
 const [visible, setVisible] = useState(false);
 const [mode, setMode] = useState<"solo" | "coop">("solo");
 const [error, setError] = useState("");
 const [saving, setSaving] = useState(false);
 useEffect(() => {
  let alive = true;
  void apiFetch<{show_guide: boolean}>("/api/player/onboarding").then(data => {if(alive) setVisible(data.show_guide);})
   .catch(() => { /* Home and the manual guide stay usable if preference loading fails. */ });
  return () => {alive = false;};
 }, []);
 async function dismiss() {
  setSaving(true); setError("");
  try {await apiFetch("/api/player/onboarding/dismiss", {method: "POST", headers: {"X-TOT-Account-Request": "1"}}); setVisible(false);}
  catch(reason) {setError(reason instanceof Error ? reason.message : "Could not save this preference.");}
  finally {setSaving(false);}
 }
 if(!visible) return <button className="button button-quiet" type="button" onClick={() => setVisible(true)}>HOW TO START</button>;
 return <Panel title="YOUR FIRST ADVENTURE" className="first-run-guide">
  <p>Tales of Two is a story you play through choices and dice, alone or with a friend. Create a Hero, choose a story, and see what happens.</p>
  <ol className="onboarding-steps">
   <li><h2>Choose your Hero</h2><p>A Hero is your character. Their abilities help with dice checks, and their progress carries between adventures.</p>
    {heroes.length ? <TerminalSelect value={selectedHeroId} onChange={onSelectHero} ariaLabel="Hero for your first adventure" options={heroes.map(hero => ({value: hero.character_id, label: `${hero.name} // LVL ${hero.level}`}))} /> : <p>No available Hero yet. Create one to start; you can use the balanced starting abilities.</p>}
    <Link className="button" to="/game/heroes/new?returnTo=%2Fgame">CREATE A HERO</Link>
   </li>
   <li><h2>Play alone or together</h2><div className="history-card-actions" role="group" aria-label="First adventure party mode">
    <button className={`button ${mode === "solo" ? "button-primary" : ""}`} type="button" aria-pressed={mode === "solo"} onClick={() => setMode("solo")}>SOLO</button>
    <button className={`button ${mode === "coop" ? "button-primary" : ""}`} type="button" aria-pressed={mode === "coop"} onClick={() => setMode("coop")}>WITH A FRIEND</button>
   </div><p>{mode === "solo" ? "Take every turn at your own pace." : "Open the lobby, invite your friend or share its room code, and wait for them to join with their own Hero. Each of you chooses an action every turn."}</p></li>
   <li><h2>Begin with First Light</h2><p>Bring a lost lantern home in Lantern Harbor. A World is the setting; an Adventure is one story in it. This gentle starter takes three turns, around 5–10 minutes, for 1–2 players.</p>
    <button className="button button-primary" type="button" disabled={!connected || !selectedHeroId || !starterAvailable || creating} onClick={() => onStart(mode)}>{creating ? "OPENING LOBBY_" : "OPEN STARTER LOBBY"}</button>
    <p className="muted-copy">{!connected ? "Connecting to the story network…" : !starterAvailable ? "Waiting for the adventure catalog…" : "In the lobby, press Get Started when your party is ready. Adventures save automatically; return through My Adventures."}</p>
   </li>
  </ol>
  {error ? <p className="form-error" role="alert">{error}</p> : null}
  <button className="button button-quiet" type="button" disabled={saving} onClick={() => void dismiss()}>{saving ? "SAVING_" : "SKIP GUIDE — BROWSE ADVENTURES"}</button>
 </Panel>;
}
