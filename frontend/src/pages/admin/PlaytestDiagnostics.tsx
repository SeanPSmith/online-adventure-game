import { useCallback, useEffect, useState } from "react";
import { Panel } from "../../components/ui/Panel";
import { getPlaytestDiagnostics, type PlaytestDiagnosticsSnapshot } from "../../services/admin";

const money = (value: number | null) => value === null ? "NO DATA" : `$${value.toFixed(4)}`;
const duration = (value: number | null) => value === null ? "NO DATA" : `${(value / 1000).toFixed(1)}s`;

/** Operator-only: no story prose, personal biographies, or player IDs. */
export function PlaytestDiagnostics() {
  const [report, setReport] = useState<PlaytestDiagnosticsSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setBusy(true);
    try { setReport(await getPlaytestDiagnostics()); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Playtest metrics unavailable."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return <Panel title="PLAYTEST // COMPLETED ADVENTURES">
    <div className="admin-doc-toolbar">
      <button className="button" type="button" disabled={busy} onClick={() => void reload()}>{busy ? "LOADING…" : "REFRESH PLAYTEST METRICS"}</button>
      <span>READ-ONLY // LAST {report?.sample_limit ?? 20} COMPLETIONS</span>
    </div>
    {error ? <p className="form-error" role="alert">{error} — existing results may be stale.</p> : null}
    {report ? <>
      <div className="admin-stat-grid">
        <div><span>COMPLETED RUNS SAMPLED</span><strong>{report.summary.completed_runs}</strong></div>
        <div><span>WITH AI COST DATA</span><strong>{report.summary.runs_with_ai_metering}</strong></div>
        <div><span>WITH MOMENTUM DATA</span><strong>{report.summary.runs_with_progress_data}</strong></div>
        <div><span>LOW-PROGRESS CHAPTER SHARE</span><strong>{report.summary.low_progress_percent === null ? "NO DATA" : `${report.summary.low_progress_percent}%`}</strong></div>
        <div><span>RUNS WITH TWO STALLED BEATS</span><strong>{report.summary.runs_with_two_low_in_a_row}</strong></div>
        <div><span>SAMPLE AI COST ESTIMATE</span><strong>${report.summary.sample_estimated_ai_cost_usd.toFixed(4)}</strong></div>
      </div>
      <div className="operations-table-wrap" tabIndex={0}><table>
        <thead><tr><th>Adventure / Room</th><th>Turns</th><th>Low Progress</th><th>Director p50 / p90</th><th>Repair / Fail</th><th>AI estimate</th><th>GPT-6.1 same tokens*</th></tr></thead>
        <tbody>{report.runs.map(run => <tr key={run.room_code}>
          <td><strong>{run.adventure_title}</strong><br />{run.room_code}<br /><small>{run.models.join(", ") || "NO METER DATA"}</small></td>
          <td>{run.turns}</td>
          <td>{run.progress.low_progress_percent === null ? "NO DATA" : `${run.progress.low_progress_percent}%`}
            <br /><small>{run.progress.assessed_turns} assessed</small></td>
          <td>{duration(run.story_latency_p50_ms)} / {duration(run.story_latency_p90_ms)}</td>
          <td>{run.repair_calls} / {run.ai_failures}</td>
          <td>{money(run.estimated_ai_cost_usd)}</td>
          <td>{money(run.gpt61_same_tokens_usd)}<br /><small>{run.gpt61_comparable_calls} comparable calls</small></td>
        </tr>)}</tbody>
      </table></div>
      {!report.runs.length ? <p className="muted-copy">No completed adventure history yet. Finish a test adventure to populate this panel.</p> : null}
      <p className="muted-copy">* {report.limits.comparison} {report.limits.timing} {report.limits.costs} {report.limits.progress}</p>
    </> : <p className="muted-copy">Loading completed-run diagnostics…</p>}
  </Panel>;
}
