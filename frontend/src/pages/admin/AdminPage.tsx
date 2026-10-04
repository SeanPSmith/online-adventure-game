import { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminPage.css";
import { Link, Navigate } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  contentImportErrorMessage,
  getAdminAnalytics,
  getAdminProjectDocumentation,
  importAuthorContent,
  listUsers,
  setAuthorAccess,
  type AdminAnalyticsSnapshot,
  type AdminProjectDocumentation,
  type ContentImportReport,
} from "../../services/admin";
import type { User } from "../../services/auth";
import { useAuth } from "../../state/AuthContext";

function permissionLabel(user: User) {
  if (user.permissions.includes("admin")) return "SUPERUSER";
  if (user.permissions.includes("author")) return "AUTHOR";
  return "PLAYER";
}

interface LegacyContentBundle {
  format?: string;
  authors?: Array<{
    username?: string;
    email?: string;
  }>;
  [key: string]: unknown;
}

export function AdminPage() {
  const { user, refresh } = useAuth();
  const isAdmin = user?.permissions.includes("admin") ?? false;

  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingUserId, setWorkingUserId] = useState("");
  const [bundle, setBundle] = useState<LegacyContentBundle | null>(null);
  const [bundleName, setBundleName] = useState("");
  const [authorMap, setAuthorMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importReport, setImportReport] = useState<ContentImportReport | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsSnapshot | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [projectDocs, setProjectDocs] = useState<AdminProjectDocumentation | null>(null);
  const [projectDocsOpen, setProjectDocsOpen] = useState(false);
  const [projectDocsLoading, setProjectDocsLoading] = useState(false);
  const [projectDocsError, setProjectDocsError] = useState("");
  const [projectDocsSearch, setProjectDocsSearch] = useState("");

  const loadUsers = useCallback(async (query = "") => {
    setLoading(true);
    setError("");

    try {
      const response = await listUsers(query);
      setUsers(response.users);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin user list unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const snapshot = await getAdminAnalytics();
      setAnalytics(snapshot);
      setAnalyticsError("");
    } catch (reason) {
      setAnalyticsError(
        reason instanceof Error ? reason.message : "Control-room telemetry unavailable.",
      );
    }
  }, []);

  const loadProjectDocs = useCallback(async () => {
    setProjectDocsLoading(true);
    setProjectDocsError("");

    try {
      const documentation = await getAdminProjectDocumentation();
      setProjectDocs(documentation);
    } catch (reason) {
      setProjectDocsError(
        reason instanceof Error ? reason.message : "Project documentation unavailable.",
      );
    } finally {
      setProjectDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    void loadUsers();
    void loadAnalytics();

    const interval = window.setInterval(() => {
      void loadAnalytics();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [isAdmin, loadAnalytics, loadUsers]);

  const visibleUsers = useMemo(() => users, [users]);
  const maxDailyTurns = useMemo(
    () => Math.max(1, ...(analytics?.daily_activity.map((day) => day.turns) ?? [1])),
    [analytics],
  );
  const visibleProjectDocSections = useMemo(() => {
    if (!projectDocs) return [];
    const query = projectDocsSearch.trim().toLowerCase();
    if (!query) return projectDocs.sections;

    return projectDocs.sections.filter((section) =>
      `${section.title}\n${section.content}`.toLowerCase().includes(query),
    );
  }, [projectDocs, projectDocsSearch]);

  if (!isAdmin) {
    return <Navigate to="/game" replace />;
  }

  async function toggleAuthor(target: User) {
    const currentlyAuthor = target.permissions.includes("author");
    setWorkingUserId(target.user_id);
    setError("");

    try {
      await setAuthorAccess(target.user_id, !currentlyAuthor);
      await loadUsers(search);
      if (target.user_id === user?.user_id) await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Permission update failed.");
    } finally {
      setWorkingUserId("");
    }
  }

  async function readBundle(file: File | null) {
    setBundle(null);
    setBundleName("");
    setAuthorMap({});
    setImportError("");
    setImportReport(null);

    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as LegacyContentBundle;
      setBundle(parsed);
      setBundleName(file.name);

      const initialMap: Record<string, string> = {};
      for (const author of parsed.authors ?? []) {
        const username = String(author.username ?? "").trim();
        if (username) initialMap[username] = username;
      }
      setAuthorMap(initialMap);
    } catch {
      setImportError("That file is not valid JSON.");
    }
  }

  async function runImport() {
    if (!bundle) return;

    setImporting(true);
    setImportError("");
    setImportReport(null);

    try {
      const report = await importAuthorContent(bundle, authorMap);
      setImportReport(report);
    } catch (reason) {
      setImportError(contentImportErrorMessage(reason));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="SUPERUSER" title="CONTROL ROOM" />

      <div className="admin-control-actions">
        <Link className="button primary" to="/game/arcade">ARCADE LAB</Link>
        <button
          className={`button ${projectDocsOpen ? "primary" : "subtle"}`}
          type="button"
          onClick={() => {
            const nextOpen = !projectDocsOpen;
            setProjectDocsOpen(nextOpen);
            if (nextOpen && !projectDocs) void loadProjectDocs();
          }}
        >
          {projectDocsOpen ? "CLOSE PROJECT DOCS" : "PROJECT DOCS"}
        </button>
        <button className="button subtle" type="button" onClick={() => void loadAnalytics()}>
          REFRESH TELEMETRY
        </button>
        <span className="admin-live-pulse">LIVE // 10 SEC REFRESH</span>
      </div>

      {projectDocsOpen ? (
        <Panel title="PROJECT DOCUMENTATION // CANONICAL MASTER">
          <div className="admin-doc-shell">
            <div className="admin-doc-toolbar">
              <input
                value={projectDocsSearch}
                onChange={(event) => setProjectDocsSearch(event.target.value)}
                placeholder="Search project documentation"
                aria-label="Search project documentation"
              />
              <button className="button subtle" type="button" onClick={() => void loadProjectDocs()}>
                RELOAD
              </button>
              <button
                className="button subtle"
                type="button"
                disabled={!projectDocs}
                onClick={() => {
                  if (projectDocs) void navigator.clipboard?.writeText(projectDocs.content);
                }}
              >
                COPY MARKDOWN
              </button>
            </div>

            {projectDocsLoading ? <p className="muted-copy">READING THE MASTER FILE_</p> : null}
            {projectDocsError ? <div className="form-error">{projectDocsError}</div> : null}

            {projectDocs ? (
              <>
                <div className="admin-doc-meta">
                  <span>{projectDocs.filename}</span>
                  <span>{projectDocs.sections.length} SECTIONS</span>
                  <span>PACKAGED {new Date(projectDocs.updated_at).toLocaleString()}</span>
                </div>

                {projectDocs.intro ? <pre className="admin-doc-intro">{projectDocs.intro}</pre> : null}

                <div className="admin-doc-sections">
                  {visibleProjectDocSections.map((section, index) => (
                    <details
                      className="admin-doc-section"
                      key={section.id}
                      open={!projectDocsSearch && index === 0}
                    >
                      <summary>{section.title}</summary>
                      <pre>{section.content}</pre>
                    </details>
                  ))}
                </div>

                {visibleProjectDocSections.length === 0 ? (
                  <div className="admin-doc-empty">NO DOCUMENTATION SECTION MATCHES THAT SEARCH.</div>
                ) : null}
              </>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="LIVE OPERATIONS">
        {analyticsError ? <div className="form-error">{analyticsError}</div> : null}

        <div className="admin-stat-grid">
          <div><span>ONLINE PLAYERS</span><strong>{analytics?.live.online_players ?? "—"}</strong></div>
          <div><span>LIVE ROOMS</span><strong>{analytics?.live.rooms ?? "—"}</strong></div>
          <div><span>RECENT USERS</span><strong>{analytics?.accounts.recently_active_users ?? "—"}</strong></div>
          <div><span>REGISTERED</span><strong>{analytics?.accounts.registered_users ?? "—"}</strong></div>
          <div><span>ADVENTURES COMPLETE</span><strong>{analytics?.totals.adventures_completed ?? "—"}</strong></div>
          <div><span>RESOLVED TURNS</span><strong>{analytics?.totals.turns_completed ?? "—"}</strong></div>
          <div><span>AVG TURNS / RUN</span><strong>{analytics?.totals.average_turns ?? "—"}</strong></div>
          <div><span>AUTHORS</span><strong>{analytics?.accounts.authors ?? "—"}</strong></div>
        </div>

        <div className="admin-live-room-list">
          {(analytics?.live.rooms_detail ?? []).map((room) => (
            <article className="admin-live-room" key={room.room_code}>
              <div>
                <span className="eyebrow">{room.state}</span>
                <strong>{room.adventure_title}</strong>
                <small>ROOM {room.room_code} // {room.play_mode.toUpperCase()} // TURN {room.turn_number}</small>
              </div>
              <div className="admin-live-players">
                {room.players.map((player) => (
                  <span key={`${room.room_code}-${player.user_id}-${player.hero_name}`}>
                    {player.is_online ? "●" : "○"} {player.username} / {player.hero_name}
                    {player.is_host ? " [HOST]" : ""}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {analytics && analytics.live.rooms_detail.length === 0 ? (
            <div className="empty-state"><strong>THE TAVERN IS QUIET.</strong><span>No rooms are active right now.</span></div>
          ) : null}
        </div>
      </Panel>

      <Panel title="PLAY ACTIVITY // LAST 14 COMPLETION DAYS">
        <div className="admin-activity-chart">
          {(analytics?.daily_activity ?? []).map((day) => (
            <div className="admin-activity-day" key={day.day}>
              <span>{day.day.slice(5)}</span>
              <div className="admin-activity-track">
                <i style={{ width: `${Math.max(4, (day.turns / maxDailyTurns) * 100)}%` }} />
              </div>
              <strong>{day.turns}T / {day.adventures}A</strong>
            </div>
          ))}
        </div>
      </Panel>

      <div className="admin-ranking-grid">
        <Panel title="POPULAR ADVENTURES">
          <div className="admin-ranking-list">
            {(analytics?.popular_adventures ?? []).map((adventure, index) => (
              <div key={adventure.adventure_id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span><strong>{adventure.adventure_title}</strong><small>{adventure.completions} completions // {adventure.turns} turns // avg {adventure.average_turns}</small></span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="TOP PLAYERS // BY TURNS">
          <div className="admin-ranking-list">
            {(analytics?.top_players ?? []).map((player, index) => (
              <div key={player.user_id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span><strong>{player.username}</strong><small>{player.turns_played} turns // {player.adventures_completed} adventures // {player.intermission_wins} arcade wins</small></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="RECENT COMPLETIONS">
        <div className="admin-recent-list">
          {(analytics?.recent_completions ?? []).map((entry) => (
            <div key={entry.history_id}>
              <span><strong>{entry.adventure_title}</strong><small>{entry.heroes || "UNKNOWN HEROES"}</small></span>
              <span>{entry.turn_count} TURNS</span>
              <span>{entry.ending_label || "COMPLETE"}</span>
              <time>{entry.completed_at ? new Date(entry.completed_at).toLocaleString() : ""}</time>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="AUTHOR ACCESS">
        <p className="muted-copy">
          Granting Author access also grants Publish. This console cannot create another
          administrator; superuser authority remains bootstrap-only.
        </p>

        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            void loadUsers(search);
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search username or email"
            aria-label="Search users"
          />
          <button className="button" type="submit">SEARCH</button>
          <button
            className="button subtle"
            type="button"
            onClick={() => {
              setSearch("");
              void loadUsers("");
            }}
          >
            ALL USERS
          </button>
        </form>

        {loading ? <p className="muted-copy">READING THE ACCOUNT LEDGER_</p> : null}
        {error ? <div className="form-error">{error}</div> : null}

        <div className="admin-user-list">
          {visibleUsers.map((target) => {
            const isTargetAdmin = target.permissions.includes("admin");
            const hasAuthor = target.permissions.includes("author");
            const busy = workingUserId === target.user_id;

            return (
              <article className="admin-user-row" key={target.user_id}>
                <div>
                  <span className="eyebrow">{permissionLabel(target)}</span>
                  <strong>{target.username}</strong>
                  <small>{target.email}</small>
                </div>
                <div className="admin-user-permissions">
                  {target.permissions.length
                    ? target.permissions.map((permission) => (
                        <span className="admin-permission-chip" key={permission}>
                          {permission.toUpperCase()}
                        </span>
                      ))
                    : <span className="muted-copy">NO SPECIAL ACCESS</span>}
                </div>
                <button
                  className={`button ${hasAuthor ? "subtle" : "primary"}`}
                  type="button"
                  disabled={busy || isTargetAdmin}
                  onClick={() => void toggleAuthor(target)}
                  title={
                    isTargetAdmin
                      ? "Administrator author access is protected."
                      : hasAuthor
                        ? "Revoke Author and Publish access"
                        : "Grant Author and Publish access"
                  }
                >
                  {busy ? "UPDATING_" : hasAuthor ? "REVOKE AUTHOR" : "GRANT AUTHOR"}
                </button>
              </article>
            );
          })}
        </div>

        {!loading && !error && visibleUsers.length === 0 ? (
          <div className="empty-state">
            <strong>NO MATCHING ACCOUNT.</strong>
            <span>The player must register before you can approve them.</span>
          </div>
        ) : null}
      </Panel>

      <Panel title="LEGACY AUTHOR CONTENT">
        <p className="muted-copy">
          Import a portable Author bundle exported from the old SQLite database. The
          importer preserves document IDs, versions, publication state, generated stories,
          and ownership by username. It refuses the entire import if a legacy author does
          not yet have a cloud account.
        </p>

        <div className="admin-import-controls">
          <label className="button subtle admin-file-picker">
            SELECT CONTENT BUNDLE
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void readBundle(event.target.files?.[0] ?? null)}
            />
          </label>
          <span>{bundleName || "NO BUNDLE SELECTED"}</span>
          <button
            className="button primary"
            type="button"
            disabled={!bundle || importing}
            onClick={() => void runImport()}
          >
            {importing ? "IMPORTING_" : "IMPORT CONTENT"}
          </button>
        </div>

        {bundle && Object.keys(authorMap).length ? (
          <div className="admin-author-map">
            <strong>LEGACY OWNERSHIP MAP</strong>
            <span className="muted-copy">
              Leave a username unchanged when the cloud account uses the same name.
              Change the destination when your new account name differs from the old one.
            </span>
            {Object.entries(authorMap).map(([legacyUsername, destinationUsername]) => (
              <label key={legacyUsername}>
                <span>{legacyUsername}</span>
                <span aria-hidden="true">→</span>
                <input
                  value={destinationUsername}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAuthorMap((current) => ({
                      ...current,
                      [legacyUsername]: value,
                    }));
                  }}
                  aria-label={`Cloud username for ${legacyUsername}`}
                />
              </label>
            ))}
          </div>
        ) : null}

        {importError ? <div className="form-error">{importError}</div> : null}

        {importReport ? (
          <div className="admin-import-report">
            <strong>THE ARCHIVE HAS BEEN RESTORED.</strong>
            <span>Authors: {importReport.authors_resolved.join(", ") || "none"}</span>
            {Object.entries(importReport.ownership_map)
              .filter(([legacy, current]) => legacy !== current)
              .map(([legacy, current]) => (
                <span key={legacy}>Ownership: {legacy} → {current}</span>
              ))}
            <span>
              Documents: {importReport.documents.inserted} inserted / {importReport.documents.skipped} already present
            </span>
            <span>
              Versions: {importReport.versions.inserted} inserted / {importReport.versions.skipped} already present
            </span>
            <span>
              Generated stories: {importReport.generated_adventures.inserted} inserted / {importReport.generated_adventures.skipped} already present
            </span>
            {importReport.restart_required ? (
              <span>Restart the backend once so newly imported approved stories are registered in the live catalog.</span>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </>
  );
}
