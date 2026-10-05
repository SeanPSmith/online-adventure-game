import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../state/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { returnTo?: string } | null;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");

    try {
      await login(identifier, password);
      navigate(state?.returnTo ?? "/game", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="auth-shell" aria-labelledby="login-heading">
      <div className="auth-intro">
        <span className="eyebrow">PLAYER ACCESS // EXISTING ACCOUNT</span>
        <h1 id="login-heading">WELCOME BACK.</h1>
        <p>
          Sign in and return to your Heroes, active journeys, Chronicles, and shared rooms.
        </p>
        {state?.returnTo ? <div className="auth-return-note">RETURN PATH SAVED // {state.returnTo}</div> : null}
      </div>

      <div className="auth-card panel">
        <header className="panel-heading"><span>SIGN IN</span><span>SESSION://AUTH</span></header>
        <form className="form-stack panel-body" onSubmit={submit}>
          <label>
            <span>EMAIL OR USERNAME</span>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            <span>PASSWORD</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <button className="button button-primary auth-submit" disabled={working}>
            {working ? "SIGNING IN_" : "SIGN IN"}
          </button>
          <div className="form-links">
            <Link to="/forgot-password">ACCOUNT RECOVERY</Link>
            <Link to="/register" state={{ returnTo: state?.returnTo }}>CREATE ACCOUNT</Link>
          </div>
        </form>
      </div>
    </section>
  );
}
