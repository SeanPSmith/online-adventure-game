import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../state/AuthContext";
import { QuillairoAuthFrame } from "./QuillairoAuthFrame";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { returnTo?: string } | null;
  const requestedReturn = new URLSearchParams(location.search).get("returnTo");
  // The server only supplies this one trusted return path. Never allow
  // arbitrary external or protocol-relative redirects from a query parameter.
  const state = routeState ?? (requestedReturn === "/author-console"
    ? { returnTo: requestedReturn }
    : null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError("");
    try { await login(identifier, password); navigate(state?.returnTo ?? "/game", { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed."); }
    finally { setWorking(false); }
  }

  return <QuillairoAuthFrame title="Return to your story." intro="Sign in to continue your adventure or begin a new one." overline="A PLACE FOR EVERY STORY">
    <form className="qpub-auth-fields" onSubmit={submit} aria-label="Sign in">
      {state?.returnTo ? <p className="qpub-auth-return">Your destination will be restored after sign in.</p> : null}
      <label htmlFor="qpub-login-name">Email or username</label>
      <input id="qpub-login-name" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoFocus />
      <label htmlFor="qpub-login-password">Password</label>
      <div className="qpub-password"><input id="qpub-login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div>
      <Link className="qpub-forgot" to="/forgot-password">Forgot password?</Link>
      {error ? <div className="qpub-form-error" role="alert">{error}</div> : null}
      <button className="qpub-button qpub-button-primary qpub-auth-action" type="submit" disabled={working}>{working ? "Signing in…" : "Continue the journey"}<span aria-hidden="true">↗</span></button>
      <Link className="qpub-button qpub-button-secondary qpub-auth-action" to="/register" state={{ returnTo: state?.returnTo }}>Create an account <span aria-hidden="true">↗</span></Link>
      <p className="qpub-auth-footer">New to Quillairo? <Link to="/#story-preview">See a sample story</Link> before you begin.</p>
    </form>
  </QuillairoAuthFrame>;
}
