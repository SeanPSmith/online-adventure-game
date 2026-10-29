import { useEffect, useState } from "react";

import "./inkscapeArchivePass6652.css";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import "./quillairoChronicleArchivePass6622.css";
import "./inkscapeChroniclesPass6654.css";
import { ShareMomentButton } from "../../components/game/ShareMomentButton";
import { ArchivedChronicleAudio } from "../../components/game/ArchivedChronicleAudio";
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
 const searchTerm = search.trim().toLowerCase();
 const rows = (library?.[shelf] ?? []).filter(row => [row.adventure_title, row.adventure_id, row.world_title, row.ending_label, row.play_mode, ...row.players.map(p => p.character_name)].join(" ").toLowerCase().includes(searchTerm));
 return <div className="q22-archive q22-journey-library">
  <PageTitle eyebrow="YOUR STORY LIBRARY" title="Your adventures" actions={<Link className="button" to="/game">Begin a new adventure →</Link>} />
  <section className="q22-archive-intro" aria-label="Adventure library introduction">
   <div className="q22-archive-intro-copy">
    <span className="q22-folio-label">SAVED ADVENTURES</span>
    <h2>Every journey leaves a trace.</h2>
    <p>Continue a journey in progress or revisit one you finished.</p>
   </div>
   <div className="q22-archive-ledger" aria-label="Saved adventure counts">
    <span className="q22-folio-label">YOUR COLLECTION</span>
    <strong>{library ? Object.values(library).reduce((total, entries) => total + entries.length, 0) : "—"}</strong>
    <span>adventures recorded</span>
   </div>
  </section>
  <Panel title="BROWSE ADVENTURES">
   <p>Progress is saved as you play. Resume with the same Hero and party.</p>
   <div className="history-card-actions q22-shelf-tabs" role="group" aria-label="Adventure status">
    {(["active", "completed", "abandoned"] as Shelf[]).map(value => <button type="button" className="button q22-shelf-tab" aria-pressed={shelf === value} onClick={() => setShelf(value)} key={value}>{value === "active" ? "In progress" : value === "completed" ? "Finished" : "Abandoned"} ({library?.[value].length ?? 0})</button>)}
   </div>
   <div className="q54-browser-tools">
    <label className="catalog-search-field q22-archive-search"><span>SEARCH YOUR ADVENTURES</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Adventure, world, or Hero" /></label>
    {search ? <button type="button" className="button q54-clear-search" onClick={() => setSearch("")}>Clear search</button> : null}
    {library && !error ? <p className="q54-results" role="status" aria-live="polite">Showing {rows.length} of {library[shelf].length} {shelf === "active" ? "in-progress" : shelf} {library[shelf].length === 1 ? "adventure" : "adventures"}</p> : null}
   </div>
   {error ? <div className="form-error" role="alert">{error} <button className="button" type="button" onClick={() => setReload(n => n + 1)}>TRY AGAIN</button></div> : null}
   {!library && !error ? <p role="status">Opening your library…</p> : null}
   {library && !error && !rows.length ? <div className="empty-state"><strong>{search ? "No matching adventures" : `No ${shelf} adventures`}</strong><span>{shelf === "active" ? "Choose an adventure on Home to begin." : shelf === "completed" ? "Finished stories will appear here." : "Adventures abandoned from this release onward appear here. They cannot be resumed."}</span></div> : null}
   <div className="history-grid">{rows.map(row => {
    const title = row.adventure_title || catalog.find(a => a.adventure_id === row.adventure_id)?.title || row.adventure_id;
    const text = row.recap || row.final_resolution || "Your party is assembled. Continue to begin the story.";
    return <article className="history-card q22-chronicle q54-chronicle-card" data-chronicle-status={shelf} key={`${row.room_code}:${row.character_id ?? shelf}`}>
     <span className="eyebrow q22-chronicle-status">{row.ending_label || (shelf === "active" ? "In progress" : shelf === "completed" ? "Finished" : "Abandoned")}</span><h2>{title}</h2>
     <div className="history-meta" aria-label="Adventure details">{row.world_title ? <span>{row.world_title}</span> : null}<span>{row.turn_count} TURNS{row.target_turns ? ` / ~${row.target_turns} EXPECTED` : ""}</span>{row.play_mode ? <span>{row.play_mode.toUpperCase()}</span> : null}{row.players.length ? <span>{row.players.map(p => p.character_name).join(" + ")}</span> : null}</div>
     <small>{shelf === "completed" ? "Completed" : "Last saved"}: {savedDate(row.completed_at || row.updated_at)}</small>
     <p>{shelf === "active" ? "Previously: " : ""}{text}</p>
     <div className="history-card-actions">
      {shelf === "active" ? <Link className="button button-primary" to={`/game/adventure/${encodeURIComponent(row.room_code)}?hero=${encodeURIComponent(row.character_id || "")}`}>{row.director_retry_required ? "RECOVER ADVENTURE" : "CONTINUE"}</Link> : null}
      {shelf === "completed" ? <><details><summary>READ CHRONICLE</summary><p>{row.final_resolution || row.recap}</p>{row.turn_history?.map((turn, index) => <section key={index}><strong>TURN {turn.turn_number} // {turn.scene_title}</strong><p>{turn.resolution}</p></section>)}</details><ArchivedChronicleAudio historyId={`${row.room_code}:${row.adventure_id}`} /><ShareMomentButton title={`${title} — Quillairo`} text={`${row.ending_label || ""} // ${text}`} url={`${window.location.origin}/`} label="Share chronicle" className="button button-quiet" /><Link className="button" to="/game">PLAY ANOTHER ADVENTURE</Link></> : null}
      {shelf === "abandoned" ? <span>Ended by {row.ended_by === "operator" ? "the operator" : "the host"}. Hero progress is preserved.</span> : null}
     </div>
    </article>;
   })}</div>
  </Panel>
 </div>;
}