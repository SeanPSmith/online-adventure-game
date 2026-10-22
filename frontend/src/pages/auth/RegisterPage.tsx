import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../state/AuthContext";
import { QuillairoAuthFrame } from "./QuillairoAuthFrame";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const state = location.state as { returnTo?: string } | null;
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError("");
    try { await register(email, username, password); navigate("/login", { replace: true, state: { returnTo: state?.returnTo } }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Registration failed."); }
    finally { setWorking(false); }
  }
  return <QuillairoAuthFrame title="Begin a new journey." intro="Your account will hold your Heroes, adventures, and the choices you've made." overline="A STORY OF YOUR OWN">
    <form className="qpub-auth-fields" onSubmit={submit} aria-label="Create an account">
      {state?.returnTo ? <p className="qpub-auth-return">Your invitation or destination will be waiting after registration.</p> : null}
      <label htmlFor="qpub-signup-email">Email address</label><input id="qpub-signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      <label htmlFor="qpub-signup-username">Username</label><input id="qpub-signup-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      <label htmlFor="qpub-signup-password">Password <small>At least 10 characters</small></label>
      <div className="qpub-password"><input id="qpub-signup-password" type={showPassword ? "text" : "password"} minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div>
      {error ? <div className="qpub-form-error" role="alert">{error}</div> : null}
      <button className="qpub-button qpub-button-primary qpub-auth-action" type="submit" disabled={working}>{working ? "Creating account…" : "Create your account"}<span aria-hidden="true">↗</span></button>
      <p className="qpub-auth-footer">Already have an account? <Link to="/login" state={{ returnTo: state?.returnTo }}>Return to your story.</Link></p>
    </form>
  </QuillairoAuthFrame>;
}
