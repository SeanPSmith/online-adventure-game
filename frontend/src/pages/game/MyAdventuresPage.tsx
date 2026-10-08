import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { ShareMomentButton } from "../../components/game/ShareMomentButton";
import { apiFetch } from "../../services/api";
import { useGameSocket } from "../../state/GameSocketContext";
type Shelf = "active" | "completed" | "abandoned";
interface Journey {
 ended_by?: string; room_code: string; character_id?: string; adventure_id: string; adventure_title?: string;
 world_title?: string; target_turns?: number; turn_history?: {turn_number: number; scene_title: string; resolution: string}[]; turn_count: number; updated_at?: string; completed_at?: string; play_mode?: string;
 recap: string; final_resolution?: string; ending_label?: string; director_retry_required?: boolean;
 players: {character_name: string; character_id: string}[];
}
type Library = Record<Shelf, Journey[]>;
function savedDate(raw?: string) {
 if (!raw) return "Date unavailable";
 const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
 return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}
export function MyAdventuresPage() {
 const {adventures, catalog} = useGameSocket();
 const [library, setLibrary] = useState<Library | null>(null);
 const [shelf, setShelf] = useState<Shelf>("active");
 const [search, setSearch] = useState("");
 const [error, setError] = useState("");
 const [reload, setReload] = useState(0);
 useEffect(() => {
  let alive = true; setError("");
  void apiFetch<Library>("/api/player/adventures").then(data => {if(alive) setLibrary(data);})
   .catch(reason => {if(alive) setError(reason instanceof Error ? reason.message : "Your library could not be opened.");});
  return () => {alive = false;};
 }, [adventures, reload]);
 const rows = (library?.[shelf] ?? []).filter(row => [row.adventure_title, row.adventure_id, ...row.players.map(p => p.character_name)].join(" ").toLowerCase().includes(search.toLowerCase()));
 return <>
  <PageTitle eyebrow="YOUR STORY LIBRARY" title="MY ADVENTURES" actions={<Link className="button" to="/game">START AN ADVENTURE</Link>} />
  <Panel title="YOUR JOURNEYS">
   <p>Adventures save automatically as you play. Continue with the same Hero and party, or revisit a finished Chronicle.</p>
   <div className="history-card-actions" role="group" aria-label="Adventure status">
    {(["active", "completed", "abandoned"] as Shelf[]).map(value => <button type="button" className={`button ${shelf === value ? "button-primary" : ""}`} aria-pressed={shelf === value} onClick={() => setShelf(value)} key={value}>{value.toUpperCase()} ({library?.[value].length ?? 0})</button>)}
   </div>
   <label className="catalog-search-field"><span>SEARCH YOUR ADVENTURES</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Adventure or Hero name" /></label>
   {error ? <div className="form-error" role="alert">{error} <button className="button" type="button" onClick={() => setReload(n => n + 1)}>TRY AGAIN</button></div> : null}
   {!library && !error ? <p role="status">OPENING YOUR LIBRARY_</p> : null}
   {library && !error && !rows.length ? <div className="empty-state"><strong>{search ? "NO MATCHING ADVENTURES" : `NO ${shelf.toUpperCase()} ADVENTURES`}</strong><span>{shelf === "active" ? "Choose an adventure on Home to begin." : shelf === "completed" ? "Finished stories will appear here." : "Adventures abandoned from this release onward appear here. They cannot be resumed."}</span></div> : null}
   <div className="history-grid">{rows.map(row => {
    const title = row.adventure_title || catalog.find(a => a.adventure_id === row.adventure_id)?.title || row.adventure_id;
    const text = row.recap || row.final_resolution || "Your party is assembled. Continue to begin the story.";
    return <article className="history-card" key={`${row.room_code}:${row.character_id ?? shelf}`}>
     <span className="eyebrow">{row.ending_label || shelf.toUpperCase()}</span><h2>{title}</h2>
     <div className="history-meta"><span>{row.world_title}</span><span>{row.turn_count} TURNS{row.target_turns ? ` / ~${row.target_turns} EXPECTED` : ""}</span><span>{row.play_mode?.toUpperCase()}</span><span>{row.players.map(p => p.character_name).join(" + ")}</span></div>
     <small>{shelf === "completed" ? "Completed" : "Last saved"}: {savedDate(row.completed_at || row.updated_at)}</small>
     <p>{shelf === "active" ? "Previously: " : ""}{text}</p>
     <div className="history-card-actions">
      {shelf === "active" ? <Link className="button button-primary" to={`/game/adventure/${encodeURIComponent(row.room_code)}?hero=${encodeURIComponent(row.character_id || "")}`}>{row.director_retry_required ? "RECOVER ADVENTURE" : "CONTINUE"}</Link> : null}
      {shelf === "completed" ? <><details><summary>READ CHRONICLE</summary><p>{row.final_resolution || row.recap}</p>{row.turn_history?.map((turn, index) => <section key={index}><strong>TURN {turn.turn_number} // {turn.scene_title}</strong><p>{turn.resolution}</p></section>)}</details><ShareMomentButton title={`${title} — Tales of Two`} text={`${row.ending_label || ""} // ${text}`} url={`${window.location.origin}/`} label="SHARE CHRONICLE" className="button button-quiet" /><Link className="button" to="/game">PLAY ANOTHER ADVENTURE</Link></> : null}
      {shelf === "abandoned" ? <span>Ended by {row.ended_by === "operator" ? "the operator" : "the host"}. Hero progress is preserved.</span> : null}
     </div>
    </article>;
   })}</div>
  </Panel>
 </>;
}
