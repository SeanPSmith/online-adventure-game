import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { getOperations, setAIPause, terminateRoom, type OperationsSnapshot, type OperationsRoom } from "../../services/admin";

export function OperationsDashboard() {
 const [data, setData] = useState<OperationsSnapshot | null>(null);
 const [fetchError, setFetchError] = useState("");
 const [error, setError] = useState("");
 const [busy, setBusy] = useState(false);
 const [filter, setFilter] = useState("");
 const [inspect, setInspect] = useState("");
 const [ending, setEnding] = useState<OperationsRoom | null>(null);
 const [confirmation, setConfirmation] = useState("");
 const [pauseAction, setPauseAction] = useState<boolean | null>(null);
 const confirmationPanel = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (ending || pauseAction !== null) {
   confirmationPanel.current?.scrollIntoView({block: "center"});
   confirmationPanel.current?.querySelector<HTMLInputElement | HTMLButtonElement>("input, button")?.focus();
  }
 }, [ending, pauseAction]);
 const load = useCallback(async () => {
  try {setData(await getOperations()); setFetchError("");}
  catch(reason) {setFetchError(reason instanceof Error ? reason.message : "Operations unavailable.");}
 }, []);
 useEffect(() => {
  void load();
  const timer = window.setInterval(() => {if(!document.hidden) void load();}, 10000);
  return () => window.clearInterval(timer);
 }, [load]);
 async function mutate(action: () => Promise<unknown>) {
  setBusy(true); setError("");
  try {await action(); setEnding(null); setPauseAction(null); await load();}
  catch(reason) {setError(reason instanceof Error ? reason.message : "Operator action failed.");}
  finally {setBusy(false);}
 }
 const rooms = data?.rooms.filter(room => `${room.room_code} ${room.adventure_title} ${room.state} ${room.players.map(p => p.hero_name).join(" ")}`.toLowerCase().includes(filter.toLowerCase())) ?? [];
 return <Panel title="PLAYTEST OPERATIONS" className="operations-dashboard">
  <div className="admin-doc-toolbar"><button className="button" type="button" disabled={busy} onClick={() => void load()}>REFRESH OPERATIONS</button><button className="button" type="button" disabled={!data || busy} onClick={() => {setEnding(null); setPauseAction(!data?.ai_paused);}}>{data?.ai_paused ? "RESUME AI GENERATION" : "PAUSE AI GENERATION"}</button><span>{data ? `Updated ${new Date(data.generated_at).toLocaleTimeString()} // AI ${data.ai_paused ? "PAUSED" : "OPEN"}` : "Loading operations…"}</span></div>
  {fetchError ? <p role="alert" className="form-error">{fetchError} — displayed data may be stale.</p> : null}
  {error ? <p role="alert" className="form-error">{error}</p> : null}
  {data ? <>
   <div className="admin-stat-grid">
    <div><span>RETAINED STARTED RUNS</span><strong>{data.lifecycle.started_retained}</strong></div><div><span>ACTIVE / LOBBIES</span><strong>{data.lifecycle.active} / {data.lifecycle.lobbies}</strong></div>
    <div><span>COMPLETED / ABANDONED</span><strong>{data.lifecycle.completed} / {data.lifecycle.abandoned}</strong></div>
    <div><span>TRACKED RETRY CALL SHARE</span><strong>{data.metrics.retry_call_share === null ? "NO DATA" : `${data.metrics.retry_call_share}%`}</strong></div>
    <div><span>MONTH FAILURE RATE</span><strong>{data.metrics.failure_rate}%</strong></div><div><span>MONTH REPAIR CALL SHARE</span><strong>{data.metrics.repair_call_share}%</strong></div>
    <div><span>MONTH PENDING CALLS</span><strong>{data.metrics.pending}</strong></div><div><span>MONTH AVG AI LATENCY</span><strong>{(data.metrics.average_latency_ms / 1000).toFixed(1)}s</strong></div>
    <div><span>TODAY RESERVED COST</span><strong>${data.metrics.reserved_today_usd.toFixed(4)}</strong></div><div><span>QTE TIMEOUT RATE</span><strong>{data.qte.timeout_rate === null ? "NO DATA" : `${data.qte.timeout_rate}%`}</strong></div>
   </div>
   <p className="muted-copy">AI metrics use {data.period_key} (UTC). Retry call share uses calls marked since Pass 46; older calls are excluded. Repair call share counts schema/JSON repair operations. QTE metrics begin with Pass 46: {data.qte.timed_out}/{data.qte.resolved} resolved events had a timeout. Retained started runs combine available snapshots and archives; they are not an all-time funnel.</p>
   <label className="field-label"><span>FIND A ROOM / HERO / RECOVERY STATE</span><input type="search" value={filter} onChange={e => setFilter(e.target.value)} /></label>
   <div className="admin-live-room-list">{rooms.map(room => <article className="admin-live-room" key={room.room_code}>
    <div><span className="eyebrow">{room.state}</span><strong>{room.adventure_title}</strong><small>{room.room_code} // {room.play_mode} // TURN {room.turn_number} // {room.online_count}/{room.player_count} ONLINE</small></div>
    <div className="history-card-actions"><button className="button" type="button" aria-expanded={inspect === room.room_code} onClick={() => setInspect(inspect === room.room_code ? "" : room.room_code)}>INSPECT</button><button className="button" type="button" disabled={busy || room.state === "COMPLETE"} onClick={() => {setPauseAction(null); setEnding(room); setConfirmation("");}}>END ROOM</button></div>
    {inspect === room.room_code ? <div className="operations-room-detail"><p>Adventure: {room.adventure_id} // {room.started ? "Started" : "Lobby"} // QTE {room.pending_qte ? "pending" : "clear"}</p>{room.players.map(p => <p key={`${room.room_code}:${p.user_id}:${p.hero_name}`}>{p.hero_name} // {p.user_id} // {p.is_host ? "HOST" : "PARTNER"} // {p.is_online ? "ONLINE" : "OFFLINE"}</p>)}</div> : null}
   </article>)}</div>
   {!rooms.length ? <p className="muted-copy">No rooms match this view.</p> : null}
   <h3>MONTH SPEND BY ADVENTURE / ROOM</h3>
   <div className="operations-table-wrap" tabIndex={0}><table><thead><tr><th>Adventure / Room</th><th>Calls</th><th>Input / Output tokens</th><th>Estimated cost</th><th>Reserved</th><th>Failed</th></tr></thead><tbody>{data.adventures.map((row,index) => <tr key={index}><td>{row.adventure_id || "AUTHOR / UNSCOPED"}<br />{row.room_code || "—"}</td><td>{row.requests}</td><td>{row.input_tokens.toLocaleString()} / {row.output_tokens.toLocaleString()}</td><td>${row.estimated_cost_usd.toFixed(4)}</td><td>${row.reserved_usd.toFixed(4)}</td><td>{row.failed}</td></tr>)}</tbody></table></div>
   <h3>RECENT MONTH GENERATION FAILURES</h3>
   <p className="muted-copy">Failure types come from the usage ledger. No prompts or story text are logged. Cancelled and stale calls retain conservative estimated charges.</p>
   {!data.failures.length ? <p>No recorded failures this month.</p> : null}
   <div className="operations-table-wrap" tabIndex={0}><table><thead><tr><th>Time / Room</th><th>Operation / Model</th><th>Failure type</th><th>Latency</th></tr></thead><tbody>{data.failures.map(row => <tr key={row.event_id}><td>{new Date(row.occurred_at).toLocaleString()}<br />{row.room_code || "—"}</td><td>{row.operation}<br />{row.model}</td><td>{row.error_type || "Unknown"}<br /><small>{row.event_id}</small></td><td>{(row.latency_ms / 1000).toFixed(1)}s</td></tr>)}</tbody></table></div>
   <h3>RECENT OPERATOR ACTIONS</h3><div className="operations-table-wrap" tabIndex={0}><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{data.actions.map(row => <tr key={row.event_id}><td>{new Date(row.occurred_at).toLocaleString()}</td><td>{row.actor_label || row.actor_id}</td><td>{row.action}{Object.keys(row.details).length ? <details><summary>DETAILS</summary><pre>{JSON.stringify(row.details, null, 2)}</pre></details> : null}</td><td>{row.target_label || row.target_id}</td></tr>)}</tbody></table></div>
  </> : null}
  {pauseAction !== null ? <div ref={confirmationPanel} className="system-notice" role="group" aria-label="Confirm AI generation control"><p>{!pauseAction ? "Reopen paid generation? Existing quotas and daily ceilings still apply." : "Pause new AI calls for every account, including admins? Already admitted calls may finish. Saved adventures remain available; First Light and Arcade can still run."}</p><button className="button" type="button" disabled={busy} onClick={() => void mutate(() => setAIPause(Boolean(pauseAction)))}>CONFIRM {pauseAction ? "PAUSE" : "RESUME"}</button><button className="button" type="button" disabled={busy} onClick={() => setPauseAction(null)}>CANCEL</button></div> : null}
  {ending ? <div ref={confirmationPanel} className="system-notice" role="group" aria-label="Confirm ending room"><p>End {ending.adventure_title} for every player? This cancels the active generation task and archives the unfinished run. Hero progress remains; the room cannot be resumed.</p><label className="field-label"><span>TYPE ROOM CODE {ending.room_code}</span><input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button className="button" type="button" disabled={busy || confirmation.trim().toUpperCase() !== ending.room_code} onClick={() => void mutate(() => terminateRoom(ending.room_code, confirmation))}>END ROOM FOR ALL PLAYERS</button><button className="button" type="button" disabled={busy} onClick={() => setEnding(null)}>CANCEL</button></div> : null}
 </Panel>;
}
