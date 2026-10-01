import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  contentImportErrorMessage,
  importAuthorContent,
  listUsers,
  setAuthorAccess,
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

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    void loadUsers();
  }, [isAdmin, loadUsers]);

  const visibleUsers = useMemo(() => users, [users]);

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
