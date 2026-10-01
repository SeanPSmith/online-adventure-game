import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../state/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

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
      navigate("/login", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="auth-card panel">
      <header className="panel-heading">CREATE ACCOUNT</header>
      <form className="form-stack panel-body" onSubmit={submit}>
        <label><span>EMAIL</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label><span>USERNAME</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
        <label><span>PASSWORD</span><input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <small>Password must be at least 10 characters.</small>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="button button-primary" disabled={working}>
          {working ? "CREATING_" : "CREATE ACCOUNT"}
        </button>
        <div className="form-links"><Link to="/login">ALREADY HAVE AN ACCOUNT?</Link></div>
      </form>
    </section>
  );
}
