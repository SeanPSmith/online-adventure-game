import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { confirmPasswordReset } from "../../services/auth";
import { QuillairoAuthFrame } from "./QuillairoAuthFrame";

/** The reset token travels in the URL fragment (never sent to servers or in Referer). It is read once
 *  and removed from the address bar so it does not linger in history or screenshots. */
function readToken(hash: string): string {
  const match = /(?:^#|&)token=([A-Za-z0-9_-]+)/.exec(hash);
  return match ? match[1] : "";
}

export function ResetPasswordPage() {
  const location = useLocation();
  const [token] = useState(() => readToken(location.hash));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (token && window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setWorking(true);
    try { const result = await confirmPasswordReset(token, password); setDone(result.message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We could not change your password. Try again."); }
    finally { setWorking(false); }
  }

  return <QuillairoAuthFrame title="Choose a new password." intro="Pick something only you know. You will be signed out everywhere else." overline="ACCOUNT RECOVERY">
    {done ? <div className="qpub-auth-fields qpub-recovery">
      <p role="status"><strong>Password changed.</strong> {done}</p>
      <Link className="qpub-button qpub-button-primary qpub-auth-action" to="/login">Sign in <span aria-hidden="true">↗</span></Link>
    </div> : !token ? <div className="qpub-auth-fields qpub-recovery">
      <p role="alert"><strong>This reset link is incomplete.</strong> Open the link from your email again, or request a new one.</p>
      <Link className="qpub-button qpub-button-primary qpub-auth-action" to="/forgot-password">Request a new link <span aria-hidden="true">↗</span></Link>
    </div> : <form className="qpub-auth-fields" onSubmit={submit} aria-label="Choose a new password">
      <label htmlFor="qpub-reset-password">New password <small>At least 10 characters</small></label>
      <div className="qpub-password"><input id="qpub-reset-password" type={showPassword ? "text" : "password"} minLength={10} maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required autoFocus /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div>
      <label htmlFor="qpub-reset-confirm">Confirm new password</label>
      <input id="qpub-reset-confirm" type={showPassword ? "text" : "password"} minLength={10} maxLength={256} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      {error ? <div className="qpub-form-error" role="alert">{error}{error.includes("invalid or has expired") ? <> <Link to="/forgot-password">Request a new link.</Link></> : null}</div> : null}
      <button className="qpub-button qpub-button-primary qpub-auth-action" type="submit" disabled={working}>{working ? "Saving…" : "Change password"}<span aria-hidden="true">↗</span></button>
    </form>}
  </QuillairoAuthFrame>;
}
