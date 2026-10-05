import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../state/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { returnTo?: string } | null;

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");

    try {
      await register(email, username, password);
      navigate("/login", { replace: true, state: { returnTo: state?.returnTo } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="auth-shell" aria-labelledby="register-heading">
      <div className="auth-intro">
        <span className="eyebrow">NEW PLAYER // ACCOUNT CREATION</span>
        <h1 id="register-heading">MAKE YOURSELF KNOWN.</h1>
        <p>
          Your account holds your Heroes, progression, invitations, and adventure history.
          Hero creation comes next.
        </p>
        {state?.returnTo ? <div className="auth-return-note">DESTINATION SAVED // {state.returnTo}</div> : null}
      </div>

      <div className="auth-card panel">
        <header className="panel-heading"><span>CREATE ACCOUNT</span><span>SESSION://NEW</span></header>
        <form className="form-stack panel-body" onSubmit={submit}>
          <label>
            <span>EMAIL</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            <span>USERNAME</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            <span>PASSWORD</span>
            <input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            <small>10+ CHARACTERS</small>
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <button className="button button-primary auth-submit" disabled={working}>
            {working ? "CREATING_" : "CREATE ACCOUNT"}
          </button>
          <div className="form-links">
            <Link to="/login" state={{ returnTo: state?.returnTo }}>ALREADY HAVE AN ACCOUNT?</Link>
          </div>
        </form>
      </div>
    </section>
  );
}
