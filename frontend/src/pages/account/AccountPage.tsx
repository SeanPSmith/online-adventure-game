import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { SettingsPage } from "./SettingsPage";
import * as authApi from "../../services/auth";
import { useAuth } from "../../state/AuthContext";
import { useModal } from "../../state/ModalContext";

const ACCOUNT_TABS = ["profile", "preferences", "notifications", "security", "billing"] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

function isAccountTab(value: string | null): value is AccountTab {
  return ACCOUNT_TABS.includes(value as AccountTab);
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "The account service did not respond.";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProfileTab() {
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setEmail(user?.email ?? "");
    setUsername(user?.username ?? "");
  }, [user?.email, user?.username]);

  const dirty = email.trim() !== (user?.email ?? "") || username.trim() !== (user?.username ?? "");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || !password) return;
    setBusy(true);
    setStatus("");
    try {
      await authApi.updateProfile(email.trim(), username.trim(), password);
      await refresh();
      setPassword("");
      setStatus("(^_^)/ ACCOUNT DETAILS UPDATED");
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-tab-stack">
      <Panel title="PLAYER PROFILE">
        <form className="account-form" onSubmit={(event) => void save(event)}>
          <div className="account-form-grid">
            <label className="account-field">
              <span>USERNAME</span>
              <input
                className="input"
                value={username}
                minLength={3}
                maxLength={24}
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
              />
              <small>3–24 characters // letters, numbers, underscore, hyphen</small>
            </label>

            <label className="account-field">
              <span>EMAIL</span>
              <input
                className="input"
                type="email"
                value={email}
                maxLength={254}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
              <small>Used for sign-in and future account delivery features.</small>
            </label>
          </div>

          <label className="account-field account-confirm-field">
            <span>CURRENT PASSWORD // REQUIRED TO SAVE IDENTITY CHANGES</span>
            <input
              className="input"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="ENTER CURRENT PASSWORD"
            />
          </label>

          <div className="account-form-actions">
            <button className="button button-primary" type="submit" disabled={busy || !dirty || !password}>
              {busy ? "SAVING..." : "SAVE PROFILE"}
            </button>
            <span className="muted-copy">Identity changes are protected by your current password.</span>
          </div>

          {status ? <div className="system-notice account-inline-status">{status}</div> : null}
        </form>
      </Panel>

      <Panel title="ACCOUNT RECORD">
        <div className="data-grid account-data-grid">
          <div><b>STATUS</b><span>{user?.is_active ? "ACTIVE" : "INACTIVE"}</span></div>
          <div><b>MEMBER SINCE</b><span>{formatDate(user?.created_at)}</span></div>
          <div><b>PLAYER ID</b><span>{user?.user_id ?? "—"}</span></div>
          <div><b>ACCESS</b><span>{user?.permissions.length ? user.permissions.join(" // ").toUpperCase() : "PLAYER"}</span></div>
        </div>
      </Panel>
    </div>
  );
}

function DeleteAccountDialog({ username }: { username: string }) {
  const { closeModal } = useModal();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const exact = confirmation.trim().toLowerCase() === username.toLowerCase();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!exact || !password || busy) return;
    setBusy(true);
    setStatus("");
    try {
      await authApi.deleteAccount(password, confirmation.trim());
      closeModal();
      window.location.assign("/");
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
      setBusy(false);
    }
  }

  return (
    <form className="account-delete-dialog" onSubmit={(event) => void submit(event)}>
      <p>
        This permanently removes your Tales of Two account, sign-in credentials, Heroes, notification
        registrations, and personal history identity. Shared published author content may remain with
        deleted-account attribution so other adventures do not break.
      </p>
      <div className="account-danger-callout">
        TYPE <strong>{username}</strong> AND ENTER YOUR CURRENT PASSWORD TO CONTINUE.
      </div>
      <label className="account-field">
        <span>CONFIRM USERNAME</span>
        <input
          className="input"
          value={confirmation}
          autoComplete="off"
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      <label className="account-field">
        <span>CURRENT PASSWORD</span>
        <input
          className="input"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {status ? <div className="system-notice account-inline-status">{status}</div> : null}
      <div className="modal-action-row account-delete-actions">
        <button className="button" type="button" onClick={closeModal} disabled={busy}>CANCEL</button>
        <button className="button account-delete-button" type="submit" disabled={busy || !exact || !password}>
          {busy ? "DELETING..." : "DELETE ACCOUNT PERMANENTLY"}
        </button>
      </div>
    </form>
  );
}

function SecurityTab() {
  const { user } = useAuth();
  const { openModal } = useModal();
  const [security, setSecurity] = useState<authApi.SecurityStatus | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("LOADING SESSION SECURITY...");

  async function refreshSecurity() {
    try {
      const next = await authApi.getSecurityStatus();
      setSecurity(next);
      setStatus("");
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    }
  }

  useEffect(() => {
    void refreshSecurity();
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus(`(^_^)/ ${response.message.toUpperCase()}`);
      await refreshSecurity();
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  async function logoutOthers() {
    setBusy(true);
    setStatus("");
    try {
      const response = await authApi.logoutOtherSessions();
      setStatus(`(^_^)/ ${response.revoked_sessions} OTHER SESSION${response.revoked_sessions === 1 ? "" : "S"} DISCONNECTED`);
      await refreshSecurity();
    } catch (reason) {
      setStatus(`:/ ${errorMessage(reason)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-tab-stack">
      <Panel title="PASSWORD">
        <form className="account-form" onSubmit={(event) => void changePassword(event)}>
          <div className="account-form-grid account-security-grid">
            <label className="account-field">
              <span>CURRENT PASSWORD</span>
              <input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="account-field">
              <span>NEW PASSWORD</span>
              <input className="input" type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <small>Minimum 10 characters.</small>
            </label>
            <label className="account-field">
              <span>CONFIRM NEW PASSWORD</span>
              <input className="input" type="password" minLength={10} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              {confirmPassword && newPassword !== confirmPassword ? <small className="account-field-error">PASSWORDS DO NOT MATCH</small> : null}
            </label>
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || !currentPassword || newPassword.length < 10 || newPassword !== confirmPassword}
          >
            {busy ? "UPDATING..." : "CHANGE PASSWORD"}
          </button>
        </form>
      </Panel>

      <Panel title="ACTIVE SESSIONS">
        <div className="account-session-layout">
          <div className="data-grid account-data-grid">
            <div><b>AUTH PROVIDER</b><span>{security?.provider.toUpperCase() ?? "—"}</span></div>
            <div><b>ACTIVE SESSIONS</b><span>{security?.active_sessions ?? "—"}</span></div>
            <div><b>THIS SESSION STARTED</b><span>{formatDate(security?.current_session_created_at)}</span></div>
            <div><b>SESSION EXPIRES</b><span>{formatDate(security?.current_session_expires_at)}</span></div>
          </div>
          <button className="button" type="button" disabled={busy || !security} onClick={() => void logoutOthers()}>
            SIGN OUT OTHER DEVICES
          </button>
        </div>
      </Panel>

      {status ? <div className="system-notice account-inline-status">{status}</div> : null}

      <Panel title="DANGER ZONE" className="account-danger-panel">
        <div className="account-danger-row">
          <div>
            <strong>DELETE TALES OF TWO ACCOUNT</strong>
            <p>This cannot be undone. Your current password and username are required.</p>
          </div>
          <button
            className="button account-delete-button"
            type="button"
            onClick={() => openModal({
              title: "DELETE ACCOUNT // PERMANENT",
              body: <DeleteAccountDialog username={user?.username ?? ""} />,
              actions: <span className="muted-copy">DESTRUCTIVE ACCOUNT ACTION</span>,
            })}
          >
            DELETE ACCOUNT
          </button>
        </div>
      </Panel>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="account-tab-stack">
      <Panel title="BILLING // EARLY ACCESS">
        <div className="billing-status-card">
          <div className="billing-plan-mark">T2</div>
          <div>
            <span className="eyebrow">CURRENT ACCESS</span>
            <h2>EARLY ACCESS // NO BILLING</h2>
            <p>
              Tales of Two does not have a billing provider connected yet. This tab is intentionally
              reserved so subscriptions, invoices, payment methods, or usage plans can land here without
              redesigning the Account Center later.
            </p>
          </div>
        </div>
        <div className="data-grid account-data-grid billing-data-grid">
          <div><b>PLAN</b><span>EARLY ACCESS</span></div>
          <div><b>STATUS</b><span>NO BILLING REQUIRED</span></div>
          <div><b>PAYMENT METHOD</b><span>NONE ON FILE</span></div>
          <div><b>NEXT CHARGE</b><span>$0.00</span></div>
        </div>
        <button className="button" type="button" disabled>MANAGE BILLING // NOT YET ENABLED</button>
      </Panel>
    </div>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get("tab");
  const activeTab: AccountTab = isAccountTab(queryTab) ? queryTab : "profile";

  const tabLabel = useMemo(() => activeTab.toUpperCase(), [activeTab]);

  function chooseTab(tab: AccountTab) {
    const next = new URLSearchParams(searchParams);
    if (tab === "profile") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <PageTitle
        eyebrow={`ACCOUNT CENTER // ${tabLabel}`}
        title={user?.username ? `PLAYER // ${user.username}` : "PLAYER ACCOUNT"}
      />

      <div className="account-command-bar">
        <div>
          <span className="eyebrow">ACCOUNT STATUS</span>
          <strong>{user?.is_active ? "ONLINE // ACTIVE" : "INACTIVE"}</strong>
        </div>
        <div>
          <span className="eyebrow">MEMBER SINCE</span>
          <strong>{formatDate(user?.created_at)}</strong>
        </div>
        <div>
          <span className="eyebrow">ACCESS</span>
          <strong>{user?.permissions.includes("admin") ? "ADMIN" : user?.permissions.includes("author") ? "AUTHOR" : "PLAYER"}</strong>
        </div>
      </div>

      <nav className="account-tabs" role="tablist" aria-label="Account settings sections">
        {ACCOUNT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => chooseTab(tab)}
          >
            <span>{tab.toUpperCase()}</span>
            <small>
              {tab === "profile" ? "IDENTITY" : tab === "preferences" ? "DISPLAY" : tab === "notifications" ? "ALERTS" : tab === "security" ? "ACCESS" : "PLAN"}
            </small>
          </button>
        ))}
      </nav>

      <section className="account-tab-content" role="tabpanel">
        {activeTab === "profile" ? <ProfileTab /> : null}
        {activeTab === "preferences" ? <SettingsPage section="preferences" /> : null}
        {activeTab === "notifications" ? <SettingsPage section="notifications" /> : null}
        {activeTab === "security" ? <SecurityTab /> : null}
        {activeTab === "billing" ? <BillingTab /> : null}
      </section>
    </>
  );
}
