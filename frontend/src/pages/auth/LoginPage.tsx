import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../state/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      const state = location.state as { returnTo?: string } | null;
      navigate(state?.returnTo ?? "/game", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="auth-card panel">
      <header className="panel-heading">SIGN IN</header>
      <form className="form-stack panel-body" onSubmit={submit}>
        <label>
          <span>EMAIL OR USERNAME</span>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
        </label>
        <label>
          <span>PASSWORD</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="button button-primary" disabled={working}>
          {working ? "SIGNING IN_" : "SIGN IN"}
        </button>
        <div className="form-links">
          <Link to="/forgot-password">FORGOT PASSWORD?</Link>
          <Link to="/register">CREATE ACCOUNT</Link>
        </div>
      </form>
    </section>
  );
}
